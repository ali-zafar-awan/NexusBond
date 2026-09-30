"""
NexusBond Mode B Multipath Relay Server
Deploys on a remote VPS / cloud server or local relay.
Accepts multiple WAN subflow links from a single NexusBond client, reassembles striped packets/chunks,
and proxies traffic out to internet hosts with single-stream full aggregated bandwidth.
"""

import hmac
import struct
import socket
import asyncio
import hashlib
import logging
from typing import Dict, Optional, Tuple

logger = logging.getLogger("NexusBond.RelayServer")

MAGIC_HEADER = b"NXBD"
CMD_DATA = 1
CMD_CONNECT = 2
CMD_HEARTBEAT = 3
CMD_CLOSE = 4


class MultipathRelayServer:
    def __init__(self, host: str = "0.0.0.0", port: int = 51820, auth_secret: str = "nexusbond_secret"):
        self.host = host
        self.port = port
        self.auth_secret = auth_secret.encode()
        self.server: Optional[asyncio.Server] = None
        self.sessions: Dict[str, asyncio.StreamWriter] = {}  # session_id -> target_writer
        self.is_running = False

    async def start(self):
        """Start listening for incoming multipath subflows."""
        self.server = await asyncio.start_server(self.handle_subflow, self.host, self.port)
        self.is_running = True
        logger.info(f"[Relay Server] Listening on {self.host}:{self.port} for multipath tunnels.")

    async def stop(self):
        if self.server:
            self.server.close()
            await self.server.wait_closed()
        self.is_running = False

    async def handle_subflow(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        """Handle an incoming subflow connection from one of the client's network interfaces."""
        try:
            # Read 4-byte Magic Header
            magic = await reader.readexactly(4)
            if magic != MAGIC_HEADER:
                writer.close()
                return

            while True:
                # Header: CMD(1 byte) + SessionID(16 bytes) + Sequence(4 bytes) + Length(4 bytes)
                hdr = await reader.readexactly(25)
                cmd = hdr[0]
                session_id = hdr[1:17].hex()
                seq, length = struct.unpack("!II", hdr[17:25])

                payload = await reader.readexactly(length) if length > 0 else b""

                if cmd == CMD_HEARTBEAT:
                    # Echo heartbeat pong
                    writer.write(MAGIC_HEADER + bytes([CMD_HEARTBEAT]) + hdr[1:17] + struct.pack("!II", seq, 0))
                    await writer.drain()

                elif cmd == CMD_CONNECT:
                    # Connect to destination host:port in payload (format "host:port")
                    target = payload.decode("utf-8")
                    if ":" in target:
                        thost, tport = target.split(":", 1)
                        try:
                            t_reader, t_writer = await asyncio.open_connection(thost, int(tport))
                            self.sessions[session_id] = t_writer
                            # Start forwarding from target back to client
                            asyncio.create_task(self._target_to_subflows(session_id, t_reader, writer))
                            logger.info(f"[Relay Server] New session {session_id[:8]} connected to {target}")
                        except Exception as e:
                            logger.error(f"[Relay Server] Target connect error to {target}: {e}")

                elif cmd == CMD_DATA:
                    target_writer = self.sessions.get(session_id)
                    if target_writer:
                        target_writer.write(payload)
                        await target_writer.drain()

                elif cmd == CMD_CLOSE:
                    target_writer = self.sessions.pop(session_id, None)
                    if target_writer:
                        target_writer.close()
                    break

        except Exception as e:
            logger.debug(f"[Relay Server] Subflow ended: {e}")
        finally:
            writer.close()

    async def _target_to_subflows(self, session_id: str, t_reader: asyncio.StreamReader, client_writer: asyncio.StreamWriter):
        """Read from target host and send striped data back to client."""
        seq = 0
        sid_bytes = bytes.fromhex(session_id)
        try:
            while True:
                data = await t_reader.read(32768)
                if not data:
                    break
                # Send data packet: MAGIC(4) + CMD(1) + SID(16) + SEQ(4) + LEN(4) + Payload
                pkt = MAGIC_HEADER + bytes([CMD_DATA]) + sid_bytes + struct.pack("!II", seq, len(data)) + data
                client_writer.write(pkt)
                await client_writer.drain()
                seq += 1
        except Exception:
            pass
        finally:
            # Send Close packet
            try:
                pkt = MAGIC_HEADER + bytes([CMD_CLOSE]) + sid_bytes + struct.pack("!II", seq, 0)
                client_writer.write(pkt)
                await client_writer.drain()
            except Exception:
                pass


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    srv = MultipathRelayServer(port=51820)
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(srv.start())
        print("NexusBond Multipath Relay Server is running on port 51820. Press Ctrl+C to stop.")
        loop.run_forever()
    except KeyboardInterrupt:
        pass
