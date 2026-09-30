"""
Failover & Resilience Manager
Detects sub-second interface failures, reroutes live connections to standby or peer healthy adapters,
and records telemetry events for user visibility.
"""

import time
import logging
from typing import Dict, List, Optional, Callable, Any
from pydantic import BaseModel
from ..interfaces.detector import NetworkInterfaceInfo

logger = logging.getLogger("NexusBond.Failover")


class FailoverEvent(BaseModel):
    timestamp: float
    failed_interface_id: str
    failed_interface_name: str
    target_interface_id: str
    target_interface_name: str
    reason: str
    active_streams_rerouted: int


class FailoverManager:
    def __init__(self, timeout_ms: int = 1000):
        self.timeout_ms = timeout_ms
        self.events: List[FailoverEvent] = []
        self.active_streams: Dict[str, str] = {}  # stream_id -> interface_id
        self.event_callbacks: List[Callable[[FailoverEvent], Any]] = []

    def register_callback(self, callback: Callable[[FailoverEvent], Any]):
        self.event_callbacks.append(callback)

    def record_stream(self, stream_id: str, interface_id: str):
        self.active_streams[stream_id] = interface_id

    def remove_stream(self, stream_id: str):
        self.active_streams.pop(stream_id, None)

    def check_and_failover(
        self,
        interfaces: List[NetworkInterfaceInfo],
        healthy_fallback: Optional[NetworkInterfaceInfo]
    ) -> List[FailoverEvent]:
        """Examine interface states and trigger failover for any degraded or dead interfaces."""
        new_events: List[FailoverEvent] = []
        if not healthy_fallback:
            return new_events

        for iface in interfaces:
            if iface.status == "Down" or iface.loss_percent >= 90.0 or iface.latency_ms > 800.0:
                # Count affected streams
                affected_streams = [sid for sid, if_id in self.active_streams.items() if if_id == iface.id]
                if affected_streams:
                    # Reroute streams to fallback
                    for sid in affected_streams:
                        self.active_streams[sid] = healthy_fallback.id

                    event = FailoverEvent(
                        timestamp=time.time(),
                        failed_interface_id=iface.id,
                        failed_interface_name=iface.name,
                        target_interface_id=healthy_fallback.id,
                        target_interface_name=healthy_fallback.name,
                        reason=f"High packet loss ({iface.loss_percent}%) / RTT timeout ({iface.latency_ms}ms)",
                        active_streams_rerouted=len(affected_streams)
                    )
                    self.events.append(event)
                    if len(self.events) > 100:
                        self.events.pop(0)

                    logger.warning(
                        f"[Failover Triggered] Rerouted {len(affected_streams)} streams from {iface.name} to {healthy_fallback.name}"
                    )
                    for cb in self.event_callbacks:
                        try:
                            cb(event)
                        except Exception as e:
                            logger.debug(f"Event callback error: {e}")
                    new_events.append(event)

        return new_events
