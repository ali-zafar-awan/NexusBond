"""
Network Interface Detector
Discovers, classifies, and continuously monitors active network adapters, subnets, and gateways.
Uses cached fast OS queries with zero-blocking psutil polling for sub-millisecond API responses.
"""

import sys
import time
import socket
import logging
import platform
import subprocess
import ipaddress
import threading
from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel, Field

import psutil

logger = logging.getLogger("NexusBond.Detector")


class NetworkInterfaceInfo(BaseModel):
    id: str
    name: str
    friendly_name: str
    ip_address: str
    netmask: Optional[str] = None
    gateway: Optional[str] = None
    mac_address: Optional[str] = None
    interface_type: str = "Ethernet"
    status: str = "Up"
    speed_mbps: int = 0
    is_default_gateway: bool = False
    is_wireless: bool = False
    is_virtual: bool = False
    metric: int = 25
    bytes_sent: int = 0
    bytes_recv: int = 0
    tx_speed_bps: float = 0.0
    rx_speed_bps: float = 0.0
    latency_ms: float = 20.0
    loss_percent: float = 0.0
    weight: float = 1.0


class NetworkInterfaceDetector:
    def __init__(self):
        self.os_type = platform.system()
        self.last_io_counters: Dict[str, Tuple[int, int, float]] = {}
        self.known_adapters: Dict[str, NetworkInterfaceInfo] = {}
        self.cached_win_meta: Dict[str, dict] = {}
        self.cached_gateways: Dict[str, str] = {}
        self.last_heavy_scan_time: float = 0.0
        self._lock = threading.Lock()

        # Run initial quick scan
        self._refresh_metadata()

    def _refresh_metadata(self):
        """Fetch PowerShell metadata in non-blocking background thread."""
        now = time.time()
        if now - self.last_heavy_scan_time < 10.0 and self.cached_gateways:
            return

        def _worker():
            with self._lock:
                try:
                    if self.os_type == "Windows":
                        # Fast netsh / route query
                        ps_gw = """
                        Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Select-Object InterfaceAlias, NextHop | ConvertTo-Json -Compress
                        """
                        res = subprocess.run(
                            ["powershell", "-NoProfile", "-Command", ps_gw],
                            capture_output=True,
                            text=True,
                            timeout=2
                        )
                        if res.returncode == 0 and res.stdout.strip():
                            import json
                            data = json.loads(res.stdout.strip())
                            if isinstance(data, dict):
                                data = [data]
                            for route in data:
                                alias = route.get("InterfaceAlias")
                                nexthop = route.get("NextHop")
                                if alias and nexthop and nexthop != "0.0.0.0":
                                    self.cached_gateways[alias] = nexthop
                except Exception:
                    pass
                self.last_heavy_scan_time = time.time()

        t = threading.Thread(target=_worker, daemon=True)
        t.start()

    def detect_interfaces(self) -> List[NetworkInterfaceInfo]:
        """Instantaneous non-blocking interface discovery."""
        current_time = time.time()
        self._refresh_metadata()
        
        try:
            stats = psutil.net_if_stats()
            addrs = psutil.net_if_addrs()
            io_counters = psutil.net_io_counters(pernic=True)
        except Exception:
            return list(self.known_adapters.values())

        detected: List[NetworkInterfaceInfo] = []

        for iface_name, iface_stats in stats.items():
            if not iface_stats.isup:
                continue

            lower_name = iface_name.lower()
            if "loopback" in lower_name or "npcap" in lower_name or "hyper-v" in lower_name or "docker" in lower_name:
                continue

            iface_addrs = addrs.get(iface_name, [])
            ipv4_addr = None
            netmask = None
            mac_addr = None

            for addr in iface_addrs:
                if addr.family == socket.AF_INET and not addr.address.startswith("127."):
                    ipv4_addr = addr.address
                    netmask = addr.netmask
                elif addr.family == psutil.AF_LINK:
                    mac_addr = addr.address

            if not ipv4_addr:
                continue

            iface_type = "Ethernet"
            is_wireless = False
            is_virtual = False

            if "wi-fi" in lower_name or "wifi" in lower_name or "wlan" in lower_name or "wireless" in lower_name:
                iface_type = "Wi-Fi"
                is_wireless = True
            elif "cellular" in lower_name or "mobile" in lower_name or "lte" in lower_name or "5g" in lower_name:
                iface_type = "Cellular"
            elif "tap" in lower_name or "tun" in lower_name or "wireguard" in lower_name or "vpn" in lower_name:
                iface_type = "VPN"
                is_virtual = True
            elif "bluetooth" in lower_name:
                iface_type = "Bluetooth Tether"

            # I/O Counters
            tx_speed = 0.0
            rx_speed = 0.0
            bytes_sent = 0
            bytes_recv = 0

            if iface_name in io_counters:
                ioc = io_counters[iface_name]
                bytes_sent = ioc.bytes_sent
                bytes_recv = ioc.bytes_recv

                if iface_name in self.last_io_counters:
                    prev_sent, prev_recv, prev_ts = self.last_io_counters[iface_name]
                    delta_t = max(0.001, current_time - prev_ts)
                    tx_speed = max(0.0, (bytes_sent - prev_sent) * 8.0 / delta_t)
                    rx_speed = max(0.0, (bytes_recv - prev_recv) * 8.0 / delta_t)

                self.last_io_counters[iface_name] = (bytes_sent, bytes_recv, current_time)

            gw = self.cached_gateways.get(iface_name)

            # Preserve latency and loss from known adapters
            existing = self.known_adapters.get(ipv4_addr)
            lat = existing.latency_ms if existing else 20.0
            loss = existing.loss_percent if existing else 0.0
            status_val = existing.status if existing else "Up"

            info = NetworkInterfaceInfo(
                id=ipv4_addr,
                name=iface_name,
                friendly_name=iface_name,
                ip_address=ipv4_addr,
                netmask=netmask,
                gateway=gw,
                mac_address=mac_addr,
                interface_type=iface_type,
                status=status_val,
                speed_mbps=iface_stats.speed if iface_stats.speed > 0 else 100,
                is_default_gateway=bool(gw),
                is_wireless=is_wireless,
                is_virtual=is_virtual,
                bytes_sent=bytes_sent,
                bytes_recv=bytes_recv,
                tx_speed_bps=tx_speed,
                rx_speed_bps=rx_speed,
                latency_ms=lat,
                loss_percent=loss,
                weight=1.0
            )
            detected.append(info)

        self.known_adapters = {iface.id: iface for iface in detected}
        return detected

    def verify_independent_subnets(self, interfaces: List[NetworkInterfaceInfo]) -> Tuple[bool, List[str]]:
        subnets_seen = {}
        warnings = []
        for iface in interfaces:
            if iface.ip_address and iface.netmask:
                try:
                    network = ipaddress.IPv4Network(f"{iface.ip_address}/{iface.netmask}", strict=False)
                    if network in subnets_seen:
                        warnings.append(
                            f"Interfaces '{iface.name}' and '{subnets_seen[network].name}' share subnet {network}."
                        )
                    else:
                        subnets_seen[network] = iface
                except Exception:
                    pass
        return len(warnings) == 0, warnings
