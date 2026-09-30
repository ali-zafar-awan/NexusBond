"""
NexusBond Standalone Multi-Interface Benchmarking CLI (v2.0)
Strictly real measured network throughput across all active physical interfaces (Zero Fake Data).
"""

import sys
import os
import time
import concurrent.futures

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core_engine.interfaces.detector import NetworkInterfaceDetector
from core_engine.interfaces.socket_binder import BoundSocketFactory


def _measure_socket_speed(iface) -> float:
    start_t = time.perf_counter()
    downloaded = 0
    sock = None
    try:
        sock = BoundSocketFactory.create_tcp_socket(iface.ip_address, iface.name)
        sock.settimeout(5.0)
        sock.connect(("speed.cloudflare.com", 80))
        req = f"GET /__down?bytes=5000000 HTTP/1.1\r\nHost: speed.cloudflare.com\r\nUser-Agent: NexusBond-CLI\r\nConnection: close\r\n\r\n"
        sock.sendall(req.encode())
        while True:
            chunk = sock.recv(32768)
            if not chunk:
                break
            downloaded += len(chunk)
        elapsed = max(0.001, time.perf_counter() - start_t)
        return round((downloaded * 8.0 / elapsed) / 1_000_000.0, 2)
    except Exception:
        return 0.0
    finally:
        if sock:
            try:
                sock.close()
            except Exception:
                pass


def benchmark():
    detector = NetworkInterfaceDetector()
    interfaces = detector.detect_interfaces()

    print("================================================================")
    print("           NEXUSBOND MULTI-WAN BENCHMARK UTILITY (v2.0)          ")
    print("================================================================")
    print(f"Discovered {len(interfaces)} active network interfaces:\n")

    results = []
    for idx, iface in enumerate(interfaces, 1):
        print(f"[{idx}/{len(interfaces)}] Testing individual link: {iface.name} ({iface.ip_address})...", end="", flush=True)
        mbps = _measure_socket_speed(iface)
        if mbps > 0:
            print(f" Done! -> {mbps} Mbps")
            results.append((iface.name, mbps))
        else:
            print(" Failed / Unreachable (0.00 Mbps)")
            results.append((iface.name, 0.0))

    # Simultaneous multi-socket measurement across all active interfaces
    print("\n[>>] Testing Simultaneous Bonded Multi-Socket Aggregation...", end="", flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(interfaces)) as executor:
        simultaneous_futures = [executor.submit(_measure_socket_speed, iface) for iface in interfaces]
        simultaneous_results = [f.result() for f in simultaneous_futures]
        bonded_measured = round(sum(simultaneous_results), 2)
    print(f" Done! -> {bonded_measured} Mbps")

    print("\n----------------- Summary of Measured Speeds -------------------")
    for name, mbps in results:
        print(f" • {name:<30} : {mbps:>7.2f} Mbps")
    total_individual_sum = sum(r[1] for r in results)
    print("----------------------------------------------------------------")
    print(f" • Individual Links Sum         : {total_individual_sum:>7.2f} Mbps")
    print(f" • Simultaneous Bonded Aggregate: {bonded_measured:>7.2f} Mbps (Real Measured)")
    print("================================================================\n")


if __name__ == "__main__":
    benchmark()
