"""
Unit Tests for Dynamic WRR, Latency Router, and Failover
"""

import pytest
from core_engine.interfaces.detector import NetworkInterfaceInfo
from core_engine.scheduler.dynamic_wrr import DynamicWeightedRoundRobinScheduler
from core_engine.scheduler.latency_router import LatencyAwareRouter, TrafficProfile
from core_engine.scheduler.failover import FailoverManager
from core_engine.config import AdapterConfig


def test_dynamic_wrr_weights():
    scheduler = DynamicWeightedRoundRobinScheduler()
    ifaces = [
        NetworkInterfaceInfo(
            id="192.168.1.10",
            name="Wi-Fi",
            friendly_name="Wi-Fi",
            ip_address="192.168.1.10",
            speed_mbps=100,
            latency_ms=10.0,
            loss_percent=0.0
        ),
        NetworkInterfaceInfo(
            id="192.168.2.10",
            name="5G Tether",
            friendly_name="5G Tether",
            ip_address="192.168.2.10",
            speed_mbps=300,
            latency_ms=25.0,
            loss_percent=0.0
        )
    ]
    weights = scheduler.compute_weights(ifaces)
    assert len(weights) == 2
    assert weights["192.168.1.10"] > 0
    assert weights["192.168.2.10"] > 0
    assert sum(weights.values()) == pytest.approx(1.0, 0.01)


def test_latency_router_classification():
    # Gaming / DNS / SSH
    assert LatencyAwareRouter.classify_target("dns.google", 53) == TrafficProfile.INTERACTIVE
    assert LatencyAwareRouter.classify_target("server.com", 22) == TrafficProfile.INTERACTIVE
    assert LatencyAwareRouter.classify_target("csgo.valve.net", 27015) == TrafficProfile.INTERACTIVE

    # Bulk Downloads
    assert LatencyAwareRouter.classify_target("speedtest.net", 80) == TrafficProfile.BULK_DOWNLOAD
    assert LatencyAwareRouter.classify_target("cdn.github.com", 443) == TrafficProfile.BULK_DOWNLOAD

    # Streaming
    assert LatencyAwareRouter.classify_target("video.youtube.com", 443) == TrafficProfile.STREAMING


def test_failover_trigger():
    failover_mgr = FailoverManager(timeout_ms=1000)
    failover_mgr.record_stream("stream_1", "192.168.1.10")
    failover_mgr.record_stream("stream_2", "192.168.1.10")

    bad_iface = NetworkInterfaceInfo(
        id="192.168.1.10",
        name="Wi-Fi",
        friendly_name="Wi-Fi",
        ip_address="192.168.1.10",
        status="Down",
        loss_percent=100.0,
        latency_ms=999.0
    )
    fallback_iface = NetworkInterfaceInfo(
        id="192.168.2.10",
        name="5G Tether",
        friendly_name="5G Tether",
        ip_address="192.168.2.10",
        status="Up",
        loss_percent=0.0,
        latency_ms=20.0
    )

    events = failover_mgr.check_and_failover([bad_iface], fallback_iface)
    assert len(events) == 1
    assert events[0].active_streams_rerouted == 2
    assert failover_mgr.active_streams["stream_1"] == "192.168.2.10"
