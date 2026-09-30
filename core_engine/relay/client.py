"""
NexusBond Mode B Multipath Relay Client
Connects to the cloud VPS Relay server via multiple simultaneous subflows (one per physical network adapter),
striping packets/chunks across all links to achieve 100% single-stream bandwidth aggregation.
"""

import uuid
import struct
import asyncio
import logging
from typing import Dict, List, Optional, Tuple
from ..interfaces.detector import NetworkInterfaceInfo
from ..interfaces.socket_binder import BoundSocketFactory

logger = logging.getLogger("NexusBond.RelayClient")

MAGIC_HEADER = b"NXBD"
CMD_DATA = 1
CMD_CONNECT = 2
CMD_HEARTBEAT = 3
CMD_CLOSE = 4


class SubflowChannel:
    def __init__(self, interface: NetworkInterfaceInfo, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        self.interface = interface
        self.reader = reader
        self.writer = writer
        self.is_active = True
        self.bytes_sent = 0
        self.bytes_recv = 0


class MultipathRelayClient:
    def __init__(self, server_host: str = "127.0.0.1", server_port: int = 51820):
        self.server_host = server_host
        self.server_port = server_port
        self.channels: Dict[str, SubflowChannel] = {}  # iface_id -> SubflowChannel
        self.is_connected = False
        self.round_robin_idx = 0

    async def connect_all_interfaces(self, interfaces: List[NetworkInterfaceInfo]):
        """Establish a dedicated subflow tunnel to the relay server on each active interface."""
        tasks = []
        for iface in interfaces:
            if iface.status != "Down":
                tasks.append(self._connect_subflow(iface))
        results = await asyncio.gather(*tasks, return_exceptions=True)
        self.is_connected = len(self.channels) > 0
        logger.info(f"[Relay Client] Connected {len(self.channels)} subflows to relay {self.server_host}:{self.server_port}")

    async def _connect_subflow(self, iface: NetworkInterfaceInfo):
        try:
            reader, writer = await BoundSocketFactory.open_bound_connection(
                dest_host=self.server_host,
                dest_port=self.server_port,
                source_ip=iface.ip_address,
                interface_name=iface.name,
                timeout=5.0
            )
            # Send initial magic header
            writer.write(MAGIC_HEADER)
            await writer.drain()

            channel = SubflowChannel(iface, reader, writer)
            self.channels[iface.id] = channel
            logger.info(f"[Relay Client] Subflow established on {iface.name} ({iface.ip_address})")
        except Exception as e:
            logger.debug(f"[Relay Client] Failed subflow on {iface.name}: {e}")

    def select_next_channel(self) -> Optional[SubflowChannel]:
        """Distribute packets across available subflows."""
        active = [c for c in self.channels.values() if c.is_active]
        if not active:
            return None
        self.round_robin_idx = (self.round_robin_idx + 1) % len(active)
        return active[self.round_robin_idx]

    async def send_striped_data(self, session_id: bytes, seq: int, data: bytes):
        """Send data chunk over the next scheduled subflow link."""
        channel = self.select_next_channel()
        if not channel:
            return False

        try:
            pkt = MAGIC_HEADER + bytes([CMD_DATA]) + session_id + struct.pack("!II", seq, len(data)) + data
            channel.writer.write(pkt)
            await channel.writer.drain()
            channel.bytes_sent += len(data)
            return True
        except Exception as e:
            logger.debug(f"[Relay Client] Send error: {e}")
            channel.is_active = False
            return False

    async def close(self):
        for ch in self.channels.values():
            try:
                ch.writer.close()
            except Exception:
                pass
        self.channels.clear()
        self.is_connected = False
