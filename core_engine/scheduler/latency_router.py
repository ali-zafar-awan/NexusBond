"""
Latency-Aware Traffic Classifier & Router
Routes low-latency sensitive applications (gaming, VoIP, DNS, SSH, interactive web) to the lowest ping interface,
and directs bulk high-throughput streams (downloads, video streaming, torrents) across aggregated high-bandwidth links.
"""

from enum import Enum
from typing import List, Optional, Tuple
from ..interfaces.detector import NetworkInterfaceInfo


class TrafficProfile(str, Enum):
    INTERACTIVE = "interactive"    # Gaming, DNS, SSH, VoIP (Needs Lowest Latency & Jitter)
    STREAMING = "streaming"        # Video, Audio (Needs Moderate Latency & Stable Throughput)
    BULK_DOWNLOAD = "bulk"         # Steam, ISOs, Updates, File Transfers (Needs Maximum Bandwidth)
    GENERAL = "general"            # Web Browsing, API requests (Dynamic WRR)


class LatencyAwareRouter:
    # Port signatures for traffic classification
    INTERACTIVE_PORTS = {53, 22, 123, 5060, 5061, 3074, 27015, 27016, 27017, 27018, 27019, 27020}
    STREAMING_PORTS = {1935, 8000, 8080, 8443, 8554}

    @classmethod
    def classify_target(cls, dest_host: str, dest_port: int) -> TrafficProfile:
        """Classify traffic by destination port, host pattern, or payload profile."""
        if dest_port in cls.INTERACTIVE_PORTS or dest_port in range(27000, 27050):
            return TrafficProfile.INTERACTIVE
        
        lower_host = dest_host.lower()
        if any(kw in lower_host for kw in ["speedtest", "fast.com", "download", "cdn", "github-releases", "steam"]):
            return TrafficProfile.BULK_DOWNLOAD

        if any(kw in lower_host for kw in ["twitch", "youtube", "netflix", "spotify"]):
            return TrafficProfile.STREAMING

        return TrafficProfile.GENERAL

    @staticmethod
    def select_lowest_latency_interface(interfaces: List[NetworkInterfaceInfo]) -> Optional[NetworkInterfaceInfo]:
        """Find the active interface with the lowest recorded RTT latency."""
        healthy = [iface for iface in interfaces if iface.status == "Up"]
        if not healthy:
            healthy = [iface for iface in interfaces if iface.status != "Down"]
        if not healthy:
            return interfaces[0] if interfaces else None
        
        return min(healthy, key=lambda iface: iface.latency_ms)

    @staticmethod
    def select_highest_bandwidth_interface(interfaces: List[NetworkInterfaceInfo]) -> Optional[NetworkInterfaceInfo]:
        """Find the active interface with the highest link capacity."""
        healthy = [iface for iface in interfaces if iface.status != "Down"]
        if not healthy:
            return interfaces[0] if interfaces else None
        
        return max(healthy, key=lambda iface: (iface.speed_mbps, -iface.latency_ms))
