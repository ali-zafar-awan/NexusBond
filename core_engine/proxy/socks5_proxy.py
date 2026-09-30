"""
High-Concurrency SOCKS5 Multi-WAN Proxy Server
Implements RFC 1928 SOCKS5 protocol and dynamically binds outbound TCP streams to scheduled network interfaces.
"""

import uuid
import struct
import socket
import asyncio
import logging
from typing import Callable, Optional
from ..interfaces.socket_binder import BoundSocketFactory
from ..interfaces.detector import NetworkInterfaceInfo

logger = logging.getLogger("NexusBond.Socks5")


class Socks5Server:
    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 1080,
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
        """Start listening for local SOCKS5 client applications."""
        self.server = await asyncio.start_server(self.handle_client, self.host, self.port)
        self.is_running = True
        logger.info(f"[SOCKS5] Multi-WAN Proxy server listening on {self.host}:{self.port}")

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
            # 1. SOCKS5 Greeting Handshake
            header = await client_reader.readexactly(2)
            version, nmethods = header[0], header[1]
            if version != 5:
                client_writer.close()
                return
            methods = await client_reader.readexactly(nmethods)

            # Reply: NO_AUTH_REQUIRED (0x00)
            client_writer.write(b"\x05\x00")
            await client_writer.drain()

            # 2. SOCKS5 Request
            req_header = await client_reader.readexactly(4)
            ver, cmd, _, atyp = req_header[0], req_header[1], req_header[2], req_header[3]

            if cmd != 1:  # Only CONNECT command supported
                # Command not supported (0x07)
                client_writer.write(b"\x05\x07\x00\x01\x00\x00\x00\x00\x00\x00")
                await client_writer.drain()
                client_writer.close()
                return

            dest_addr = ""
            if atyp == 1:  # IPv4
                dest_raw = await client_reader.readexactly(4)
                dest_addr = socket.inet_ntoa(dest_raw)
            elif atyp == 3:  # Domain name
                domain_len = (await client_reader.readexactly(1))[0]
                dest_addr = (await client_reader.readexactly(domain_len)).decode("utf-8", errors="ignore")
            elif atyp == 4:  # IPv6
                dest_raw = await client_reader.readexactly(16)
                dest_addr = socket.inet_ntop(socket.AF_INET6, dest_raw)
            else:
                client_writer.close()
                return

            dest_port = struct.unpack("!H", await client_reader.readexactly(2))[0]

            # 3. Schedule outbound interface
            if self.interface_selector:
                chosen_iface = self.interface_selector(dest_addr, dest_port)

            source_ip = chosen_iface.ip_address if chosen_iface else "0.0.0.0"
            iface_name = chosen_iface.name if chosen_iface else None

            if self.on_stream_open and chosen_iface:
                self.on_stream_open(stream_id, chosen_iface.id)

            # 4. Connect to remote destination bound to chosen interface
            try:
                remote_reader, remote_writer = await BoundSocketFactory.open_bound_connection(
                    dest_host=dest_addr,
                    dest_port=dest_port,
                    source_ip=source_ip,
                    interface_name=iface_name,
                    timeout=5.0
                )
            except Exception as e:
                logger.debug(f"[SOCKS5] Outbound connect failed via {source_ip} to {dest_addr}:{dest_port}: {e}")
                # Host unreachable (0x04)
                client_writer.write(b"\x05\x04\x00\x01\x00\x00\x00\x00\x00\x00")
                await client_writer.drain()
                client_writer.close()
                return

            # Reply: SUCCESS (0x00)
            client_writer.write(b"\x05\x00\x00\x01\x7f\x00\x00\x01\x04\x38")
            await client_writer.drain()

            # 5. Bidirectional high-speed forwarding
            await asyncio.gather(
                self._pipe(client_reader, remote_writer, stream_id, "upload", chosen_iface),
                self._pipe(remote_reader, client_writer, stream_id, "download", chosen_iface),
                return_exceptions=True
            )

        except Exception as e:
            logger.debug(f"[SOCKS5] Client error: {e}")
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
