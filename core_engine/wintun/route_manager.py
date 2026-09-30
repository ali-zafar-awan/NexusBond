"""
Windows Routing Table Manager
Controls network interface metrics and default route allocations to ensure
traffic can be scheduled cleanly across multiple physical gateways without routing conflicts.
"""

import logging
import platform
import subprocess
from typing import Dict, List, Optional
from ..interfaces.detector import NetworkInterfaceInfo

logger = logging.getLogger("NexusBond.RouteManager")


class WindowsRouteManager:
    def __init__(self):
        self.os_type = platform.system()
        self.saved_metrics: Dict[str, int] = {}  # iface_name -> metric

    def equalize_interface_metrics(self, interfaces: List[NetworkInterfaceInfo]):
        """Set all active interface metrics to the same balanced value to prevent OS from favoring a single link."""
        if self.os_type != "Windows":
            return

        for iface in interfaces:
            try:
                # Set InterfaceMetric to 25 for equalized multi-WAN
                cmd = f"powershell -NoProfile -Command \"Set-NetIPInterface -InterfaceAlias '{iface.name}' -InterfaceMetric 25 -ErrorAction SilentlyContinue\""
                subprocess.run(cmd, shell=True, capture_output=True, timeout=3)
            except Exception as e:
                logger.debug(f"Metric adjust note for {iface.name}: {e}")

    def restore_default_metrics(self):
        """Restore automatic metrics on shutdown."""
        if self.os_type != "Windows":
            return

        try:
            cmd = "powershell -NoProfile -Command \"Set-NetIPInterface -AutomaticMetric Enabled -ErrorAction SilentlyContinue\""
            subprocess.run(cmd, shell=True, capture_output=True, timeout=3)
            logger.info("[RouteManager] Restored automatic network metrics.")
        except Exception as e:
            logger.debug(f"Metric restore error: {e}")
