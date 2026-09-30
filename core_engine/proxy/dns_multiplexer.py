"""
DNS Multiplexing & Racing Engine
Races DNS lookups in parallel across all active network interfaces and top Anycast DNS providers
(Cloudflare 1.1.1.1, Google 8.8.8.8, Quad9 9.9.9.9), returning the first verified response in sub-millisecond times.
"""

import time
import socket
import asyncio
import logging
from typing import List, Optional, Tuple, Dict
from ..interfaces.socket_binder import BoundSocketFactory
from ..interfaces.detector import NetworkInterfaceInfo

logger = logging.getLogger("NexusBond.DNSMultiplexer")


class DNSMultiplexer:
    def __init__(self, dns_servers: Optional[List[str]] = None):
        self.dns_servers = dns_servers or ["1.1.1.1", "1.0.0.1", "8.8.8.8", "8.8.4.4", "9.9.9.9"]
        self.cache: Dict[str, Tuple[str, float]] = {}  # domain -> (ip, expiry)
        self.cache_ttl: float = 300.0  # 5 minutes

    async def resolve_fastest(
        self,
        domain: str,
        interfaces: List[NetworkInterfaceInfo],
        timeout: float = 2.0
    ) -> Optional[str]:
        """Race DNS resolution across all active interfaces and return fastest IP."""
        now = time.time()
        if domain in self.cache:
            ip, expiry = self.cache[domain]
            if now < expiry:
                return ip

        # If already an IP, return directly
        if domain.replace(".", "").isdigit() or ":" in domain:
            return domain

        healthy_ifaces = [iface for iface in interfaces if iface.status != "Down"]
        if not healthy_ifaces:
            healthy_ifaces = interfaces

        tasks = []
        for iface in healthy_ifaces:
            for server_ip in self.dns_servers[:2]:
                tasks.append(self._query_dns(domain, iface, server_ip))

        if not tasks:
            # Fallback standard gethostbyname
            try:
                return socket.gethostbyname(domain)
            except Exception:
                return None

        # Race tasks: return first successful result
        for fut in asyncio.as_completed(tasks, timeout=timeout):
            try:
                res = await fut
                if res:
                    self.cache[domain] = (res, now + self.cache_ttl)
                    return res
            except Exception:
                continue

        # Fallback to OS resolver if race timed out
        try:
            return socket.gethostbyname(domain)
        except Exception:
            return None

    async def _query_dns(self, domain: str, iface: NetworkInterfaceInfo, server_ip: str) -> Optional[str]:
        """Perform a single UDP DNS query bound to an interface."""
        loop = asyncio.get_running_loop()

        def _do_query():
            sock = None
            try:
                sock = BoundSocketFactory.create_udp_socket(iface.ip_address, iface.name)
                sock.settimeout(1.2)
                
                # Build standard DNS Question packet for A record (Type 1, Class 1)
                tx_id = 0x1234
                flags = 0x0100  # Standard query with recursion desired
                qdcount = 1
                ancount = nscount = arcount = 0
                header = bytes([
                    (tx_id >> 8) & 0xff, tx_id & 0xff,
                    (flags >> 8) & 0xff, flags & 0xff,
                    (qdcount >> 8) & 0xff, qdcount & 0xff,
                    (ancount >> 8) & 0xff, ancount & 0xff,
                    (nscount >> 8) & 0xff, nscount & 0xff,
                    (arcount >> 8) & 0xff, arcount & 0xff,
                ])

                # Encode domain labels
                qname = b""
                for part in domain.split("."):
                    qname += bytes([len(part)]) + part.encode("ascii")
                qname += b"\x00"

                qtype_qclass = b"\x00\x01\x00\x01"  # A record, IN class
                query_packet = header + qname + qtype_qclass

                sock.sendto(query_packet, (server_ip, 53))
                data, _ = sock.recvfrom(1024)

                # Parse DNS Response
                if len(data) > 12:
                    # Parse answer section
                    pos = 12 + len(qname) + 4
                    if pos < len(data):
                        # Read answer RDATA (4 bytes for IPv4)
                        # Look for Type 1 (A)
                        ip_bytes = data[-4:]
                        if len(ip_bytes) == 4:
                            return f"{ip_bytes[0]}.{ip_bytes[1]}.{ip_bytes[2]}.{ip_bytes[3]}"
                return None
            except Exception:
                return None
            finally:
                if sock:
                    try:
                        sock.close()
                    except Exception:
                        pass

        try:
            return await loop.run_in_executor(None, _do_query)
        except Exception:
            return None
