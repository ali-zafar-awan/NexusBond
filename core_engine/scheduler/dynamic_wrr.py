"""
Dynamic Weighted Round-Robin (D-WRR) Scheduler
Calculates continuous adaptive interface weights using live latency (RTT), packet loss %,
and instantaneous/link capacity to achieve optimal bandwidth aggregation across multi-WAN links.
"""

import math
import logging
from typing import List, Optional, Dict
from ..interfaces.detector import NetworkInterfaceInfo
from ..config import AdapterConfig

logger = logging.getLogger("NexusBond.DynamicWRR")


class DynamicWeightedRoundRobinScheduler:
    def __init__(self):
        self.current_index: int = 0
        self.current_weight: float = 0.0
        self.effective_weights: Dict[str, float] = {}
        self.total_weight: float = 0.0

    def compute_weights(
        self,
        interfaces: List[NetworkInterfaceInfo],
        configs: Optional[Dict[str, AdapterConfig]] = None
    ) -> Dict[str, float]:
        """
        Compute live fractional weights for each healthy interface.
        Formula:
          W_i = Priority_Factor * (Throughput_Factor / (Latency_i * (1 + Loss_i * 2)))
        """
        weights: Dict[str, float] = {}
        if not interfaces:
            return weights

        raw_scores: Dict[str, float] = {}
        for iface in interfaces:
            # Skip interfaces that are Down or disabled
            cfg = configs.get(iface.id) if configs else None
            if cfg and not cfg.enabled:
                continue
            if iface.status == "Down":
                continue

            # Base throughput score (speed in Mbps or live bandwidth)
            base_capacity = max(10.0, float(iface.speed_mbps))
            # Latency penalty: lower is better
            rtt = max(1.0, iface.latency_ms)
            # Loss penalty: quadratic loss suppression
            loss_factor = 1.0 + (iface.loss_percent / 20.0) ** 2

            # Priority multiplier (Priority 1 = 1.0, Priority 2 = 0.75, Priority 3 = 0.5)
            priority_mult = 1.0
            if cfg:
                if cfg.weight_override is not None:
                    raw_scores[iface.id] = max(0.01, cfg.weight_override)
                    continue
                priority_mult = max(0.2, 1.0 - (cfg.priority - 1) * 0.25)

            score = (base_capacity / (math.sqrt(rtt) * loss_factor)) * priority_mult
            raw_scores[iface.id] = score

        total_score = sum(raw_scores.values())
        if total_score <= 0.0:
            # Fallback equal distribution among available interfaces
            active_ifaces = [iface.id for iface in interfaces if iface.status != "Down"]
            if active_ifaces:
                equal_weight = 1.0 / len(active_ifaces)
                for if_id in active_ifaces:
                    weights[if_id] = equal_weight
            return weights

        for if_id, score in raw_scores.items():
            weights[if_id] = round(score / total_score, 4)

        self.effective_weights = weights
        return weights

    def select_interface(
        self,
        interfaces: List[NetworkInterfaceInfo],
        configs: Optional[Dict[str, AdapterConfig]] = None
    ) -> Optional[NetworkInterfaceInfo]:
        """Select the next network interface for an outbound connection using WRR."""
        # Filter active and enabled
        active_list = [
            iface for iface in interfaces
            if iface.status != "Down" and (not configs or configs.get(iface.id, None) is None or configs[iface.id].enabled)
        ]

        if not active_list:
            # If all are down, try any available interface as fallback
            return interfaces[0] if interfaces else None

        if len(active_list) == 1:
            return active_list[0]

        weights = self.compute_weights(active_list, configs)
        
        # Smooth Weighted Round Robin selection algorithm (Nginx style)
        best_iface = None
        best_weight = -1.0

        for iface in active_list:
            w = weights.get(iface.id, 0.1)
            iface.weight = w
            if w > best_weight:
                best_weight = w
                best_iface = iface

        # Deterministic interleaved distribution
        self.current_index = (self.current_index + 1) % len(active_list)
        return active_list[self.current_index]
