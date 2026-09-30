"""
Unit Tests for SOCKS5 & HTTP Proxy Subsystems
"""

import socket
import pytest
import asyncio
from core_engine.proxy.socks5_proxy import Socks5Server
from core_engine.proxy.http_transparent import HttpTransparentProxy
from core_engine.interfaces.detector import NetworkInterfaceInfo


@pytest.mark.asyncio
async def test_socks5_server_lifecycle():
    server = Socks5Server(host="127.0.0.1", port=11080)
    await server.start()
    assert server.is_running is True

    # Test TCP handshake
    reader, writer = await asyncio.open_connection("127.0.0.1", 11080)
    # Send SOCKS5 greeting (VER=5, NMETHODS=1, METHOD=0)
    writer.write(b"\x05\x01\x00")
    await writer.drain()

    resp = await reader.readexactly(2)
    assert resp == b"\x05\x00"

    writer.close()
    await writer.wait_closed()
    await server.stop()
    assert server.is_running is False


@pytest.mark.asyncio
async def test_http_proxy_lifecycle():
    server = HttpTransparentProxy(host="127.0.0.1", port=18080)
    await server.start()
    assert server.is_running is True
    await server.stop()
    assert server.is_running is False
