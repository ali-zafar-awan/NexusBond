"""
Interface Health Monitor & Latency Prober
Performs continuous 500ms heartbeat RTT probing, packet loss calculations, and link health tracking.
"""

import time
import socket
import asyncio
import logging
from typing import Dict, List, Optional, Tuple
from .detector import NetworkInterfaceInfo
from .socket_binder import BoundSocketFactory

logger = logging.getLogger("NexusBond.HealthProber")

# Fast Anycast DNS IP targets used for RTT probing
PROBE_TARGETS = [
    ("1.1.1.1", 53),
    ("8.8.8.8", 53),
    ("9.9.9.9", 53),
]


class InterfaceHealthRecord:
    def __init__(self, interface_id: str):
        self.interface_id = interface_id
        self.latency_history: List[float] = []
        self.loss_window: List[bool] = []  # True = success, False = dropped
        self.current_latency_ms: float = 20.0
        self.jitter_ms: float = 2.0
        self.loss_percent: float = 0.0
        self.status: str = "Up"  # "Up", "Degraded", "Down"
        self.last_probe_time: float = 0.0
        self.consecutive_failures: int = 0

    def update_result(self, success: bool, latency_ms: float):
        self.last_probe_time = time.time()
        self.loss_window.append(success)
        if len(self.loss_window) > 20:
            self.loss_window.pop(0)

        loss_count = self.loss_window.count(False)
        self.loss_percent = (loss_count / len(self.loss_window)) * 100.0

        if success:
            self.consecutive_failures = 0
            self.latency_history.append(latency_ms)
            if len(self.latency_history) > 10:
                self.latency_history.pop(0)

            # Calculate EWMA latency
            if len(self.latency_history) == 1:
                self.current_latency_ms = latency_ms
            else:
                self.current_latency_ms = (self.current_latency_ms * 0.7) + (latency_ms * 0.3)

            if len(self.latency_history) >= 2:
                self.jitter_ms = abs(self.latency_history[-1] - self.latency_history[-2])

            if self.loss_percent > 30.0 or self.current_latency_ms > 350.0:
                self.status = "Degraded"
            else:
                self.status = "Up"
        else:
            self.consecutive_failures += 1
            if self.consecutive_failures >= 3:
                self.status = "Down"
                self.current_latency_ms = 999.0
            else:
                self.status = "Degraded"


class InterfaceHealthMonitor:
    def __init__(self, probe_interval_ms: int = 500):
        self.probe_interval_ms = probe_interval_ms
        self.records: Dict[str, InterfaceHealthRecord] = {}
        self.is_running = False
        self._task: Optional[asyncio.Task] = None

    def get_record(self, interface_id: str) -> InterfaceHealthRecord:
        if interface_id not in self.records:
            self.records[interface_id] = InterfaceHealthRecord(interface_id)
        return self.records[interface_id]

    async def probe_single_interface(self, iface: NetworkInterfaceInfo) -> Tuple[bool, float]:
        """Send a lightweight UDP/TCP handshake probe through iface source IP."""
        loop = asyncio.get_running_loop()
        target_ip, target_port = PROBE_TARGETS[0]
        start_time = time.perf_counter()

        def _do_probe():
            sock = None
            try:
                sock = BoundSocketFactory.create_udp_socket(iface.ip_address, iface.name)
                sock.settimeout(0.4)
                # Standard DNS Header query for "." root
                dns_query = b"\xaa\xbb\x01\x00\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x00\x01"
                sock.sendto(dns_query, (target_ip, target_port))
                sock.recvfrom(512)
                elapsed = (time.perf_counter() - start_time) * 1000.0
                return True, elapsed
            except Exception:
                # Fallback to direct TCP connection probe
                try:
                    tsock = BoundSocketFactory.create_tcp_socket(iface.ip_address, iface.name)
                    tsock.settimeout(0.4)
                    tsock.connect((target_ip, 53))
                    elapsed = (time.perf_counter() - start_time) * 1000.0
                    tsock.close()
                    return True, elapsed
                except Exception:
                    return False, 999.0
            finally:
                if sock:
                    try:
                        sock.close()
                    except Exception:
                        pass

        try:
            return await loop.run_in_executor(None, _do_probe)
        except Exception:
            return False, 999.0

    async def start(self, get_interfaces_fn):
        """Start the background 500ms continuous probe loop."""
        self.is_running = True
        while self.is_running:
            try:
                interfaces: List[NetworkInterfaceInfo] = get_interfaces_fn()
                tasks = []
                for iface in interfaces:
                    tasks.append(self._probe_and_record(iface))
                if tasks:
                    await asyncio.gather(*tasks, return_exceptions=True)
            except Exception as e:
                logger.debug(f"Prober loop error: {e}")
            await asyncio.sleep(self.probe_interval_ms / 1000.0)

    async def _probe_and_record(self, iface: NetworkInterfaceInfo):
        rec = self.get_record(iface.id)
        success, latency = await self.probe_single_interface(iface)
        rec.update_result(success, latency)
        iface.latency_ms = round(rec.current_latency_ms, 1)
        iface.loss_percent = round(rec.loss_percent, 1)
        iface.status = rec.status

    def stop(self):
        self.is_running = False
