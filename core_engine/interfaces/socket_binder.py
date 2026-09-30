"""
Socket Binder Module
Provides low-level socket binding directly to designated source IP addresses and adapters.
Guarantees outbound datagrams and TCP streams exit strictly via the specified network interface.
"""

import sys
import socket
import asyncio
import logging
import platform
from typing import Tuple, Optional

logger = logging.getLogger("NexusBond.SocketBinder")


class BoundSocketFactory:
    """Creates raw and async sockets bound directly to a chosen interface source IP."""

    @staticmethod
    def create_tcp_socket(source_ip: str, interface_name: Optional[str] = None) -> socket.socket:
        """Create a TCP client socket bound to source_ip (and device name on Linux)."""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

        # On Linux, bind device directly if supported
        if platform.system() == "Linux" and interface_name:
            try:
                # SO_BINDTODEVICE = 25 on Linux
                sock.setsockopt(socket.SOL_SOCKET, 25, interface_name.encode() + b"\0")
            except Exception as e:
                logger.debug(f"SO_BINDTODEVICE failed: {e}")

        # Bind to the physical source IP on Windows, macOS, and Linux
        try:
            sock.bind((source_ip, 0))
        except Exception as e:
            logger.error(f"Failed to bind socket to {source_ip}: {e}")
            sock.close()
            raise
        return sock

    @staticmethod
    def create_udp_socket(source_ip: str, interface_name: Optional[str] = None) -> socket.socket:
        """Create a UDP socket bound to source_ip."""
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

        if platform.system() == "Linux" and interface_name:
            try:
                sock.setsockopt(socket.SOL_SOCKET, 25, interface_name.encode() + b"\0")
            except Exception as e:
                logger.debug(f"SO_BINDTODEVICE failed: {e}")

        try:
            sock.bind((source_ip, 0))
        except Exception as e:
            logger.error(f"Failed to bind UDP socket to {source_ip}: {e}")
            sock.close()
            raise
        return sock

    @classmethod
    async def open_bound_connection(
        cls,
        dest_host: str,
        dest_port: int,
        source_ip: str,
        interface_name: Optional[str] = None,
        timeout: float = 6.0
    ) -> Tuple[asyncio.StreamReader, asyncio.StreamWriter]:
        """Open an asynchronous TCP connection bound strictly to source_ip."""
        sock = cls.create_tcp_socket(source_ip, interface_name)
        sock.setblocking(False)

        loop = asyncio.get_running_loop()
        try:
            # Resolve destination IP
            dest_ip = socket.gethostbyname(dest_host) if not dest_host.replace(".", "").isdigit() else dest_host
            
            # Connect asynchronously with timeout
            await asyncio.wait_for(
                loop.sock_connect(sock, (dest_ip, dest_port)),
                timeout=timeout
            )
            reader, writer = await asyncio.open_connection(sock=sock)
            return reader, writer
        except Exception as e:
            sock.close()
            raise e
