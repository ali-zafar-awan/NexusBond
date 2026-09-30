"""
HTTP & HTTPS Forward Multi-WAN Proxy
Handles standard HTTP requests and HTTPS CONNECT tunnels, routing requests across aggregated interfaces.
"""

import uuid
import asyncio
import logging
from typing import Callable, Optional
from ..interfaces.socket_binder import BoundSocketFactory
from ..interfaces.detector import NetworkInterfaceInfo

logger = logging.getLogger("NexusBond.HttpProxy")


class HttpTransparentProxy:
    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 8080,
        interface_selector: Optional[Callable[[str, int], Optional[NetworkInterfaceInfo]]] = None,
        on_stream_open: Optional[Callable[[str, str], None]] = None,
        on_stream_close: Optional[Callable[[str], None]] = None,
        on_bytes_transferred: Optional[Callable[[str, int, int], None]] = None,
    ):
        self.host = host
        self.port = port
        self.interface_selector = interface_selector
        self.on_stream_open = on_stream_open
        self.on_stream_close = on_stream_close
        self.on_bytes_transferred = on_bytes_transferred
        self.server: Optional[asyncio.Server] = None
        self.is_running = False

    async def start(self):
        self.server = await asyncio.start_server(self.handle_client, self.host, self.port)
        self.is_running = True
        logger.info(f"[HTTP] Multi-WAN Forward Proxy listening on {self.host}:{self.port}")

    async def stop(self):
        if self.server:
            self.server.close()
            await self.server.wait_closed()
        self.is_running = False

    async def handle_client(self, client_reader: asyncio.StreamReader, client_writer: asyncio.StreamWriter):
        stream_id = str(uuid.uuid4())
        chosen_iface: Optional[NetworkInterfaceInfo] = None
        remote_writer: Optional[asyncio.StreamWriter] = None

        try:
            line = await client_reader.readline()
            if not line:
                client_writer.close()
                return

            req_line = line.decode("utf-8", errors="ignore").strip()
            parts = req_line.split(" ")
            if len(parts) < 2:
                client_writer.close()
                return

            method, url = parts[0], parts[1]

            # Parse destination host and port
            if method.upper() == "CONNECT":
                # HTTPS Tunneling
                if ":" in url:
                    dest_host, dest_port_str = url.split(":", 1)
                    dest_port = int(dest_port_str)
                else:
                    dest_host, dest_port = url, 443

                # Read remaining request headers until empty line
                while True:
                    h = await client_reader.readline()
                    if h in (b"\r\n", b"\n", b""):
                        break
            else:
                # Plain HTTP
                if url.startswith("http://"):
                    url_clean = url[7:]
                    dest_host = url_clean.split("/")[0].split(":")[0]
                    dest_port = 80
                    if ":" in url_clean.split("/")[0]:
                        dest_port = int(url_clean.split("/")[0].split(":")[1])
                else:
                    dest_host = url.split("/")[0].split(":")[0]
                    dest_port = 80

            if self.interface_selector:
                chosen_iface = self.interface_selector(dest_host, dest_port)

            source_ip = chosen_iface.ip_address if chosen_iface else "0.0.0.0"
            iface_name = chosen_iface.name if chosen_iface else None

            if self.on_stream_open and chosen_iface:
                self.on_stream_open(stream_id, chosen_iface.id)

            # Connect outbound
            remote_reader, remote_writer = await BoundSocketFactory.open_bound_connection(
                dest_host=dest_host,
                dest_port=dest_port,
                source_ip=source_ip,
                interface_name=iface_name,
                timeout=5.0
            )

            if method.upper() == "CONNECT":
                # 200 Connection Established
                client_writer.write(b"HTTP/1.1 200 Connection Established\r\n\r\n")
                await client_writer.drain()
            else:
                # Forward the first line and headers to remote server
                remote_writer.write(line)
                await remote_writer.drain()

            # Bidirectional pipe
            await asyncio.gather(
                self._pipe(client_reader, remote_writer, stream_id, "upload", chosen_iface),
                self._pipe(remote_reader, client_writer, stream_id, "download", chosen_iface),
                return_exceptions=True
            )

        except Exception as e:
            logger.debug(f"[HTTP Proxy] Request error: {e}")
        finally:
            if self.on_stream_close:
                self.on_stream_close(stream_id)
            try:
                client_writer.close()
            except Exception:
                pass
            if remote_writer:
                try:
                    remote_writer.close()
                except Exception:
                    pass

    async def _pipe(
        self,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
        stream_id: str,
        direction: str,
        iface: Optional[NetworkInterfaceInfo]
    ):
        try:
            while True:
                data = await reader.read(65536)
                if not data:
                    break
                writer.write(data)
                await writer.drain()

                if self.on_bytes_transferred and iface:
                    if direction == "download":
                        self.on_bytes_transferred(iface.id, 0, len(data))
                    else:
                        self.on_bytes_transferred(iface.id, len(data), 0)
        except Exception:
            pass
