"""
Unit Tests for Interface Detection & Subnet Verification
"""

import pytest
from core_engine.interfaces.detector import NetworkInterfaceDetector, NetworkInterfaceInfo


def test_detector_initialization():
    detector = NetworkInterfaceDetector()
    assert detector is not None
    interfaces = detector.detect_interfaces()
    assert isinstance(interfaces, list)


def test_subnet_verification():
    detector = NetworkInterfaceDetector()
    
    # Disjoint subnets (Valid)
    ifaces_ok = [
        NetworkInterfaceInfo(
            id="192.168.1.50",
            name="Wi-Fi",
            friendly_name="Wi-Fi",
            ip_address="192.168.1.50",
            netmask="255.255.255.0",
            speed_mbps=300
        ),
        NetworkInterfaceInfo(
            id="192.168.43.100",
            name="USB Tether",
            friendly_name="USB Tether",
            ip_address="192.168.43.100",
            netmask="255.255.255.0",
            speed_mbps=150
        ),
    ]
    ok, warnings = detector.verify_independent_subnets(ifaces_ok)
    assert ok is True
    assert len(warnings) == 0

    # Overlapping subnets (Collision)
    ifaces_colliding = [
        NetworkInterfaceInfo(
            id="192.168.1.50",
            name="Wi-Fi",
            friendly_name="Wi-Fi",
            ip_address="192.168.1.50",
            netmask="255.255.255.0",
            speed_mbps=300
        ),
        NetworkInterfaceInfo(
            id="192.168.1.55",
            name="Ethernet",
            friendly_name="Ethernet",
            ip_address="192.168.1.55",
            netmask="255.255.255.0",
            speed_mbps=1000
        ),
    ]
    ok, warnings = detector.verify_independent_subnets(ifaces_colliding)
    assert ok is False
    assert len(warnings) > 0
