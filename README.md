# NexusBond 🌐⚡
### Intelligent Multi-WAN Internet Bonding & Traffic Aggregation System

NexusBond aggregates multiple physical and virtual network adapters (Wi-Fi, Ethernet, USB 4G/5G Tethering, Starlink) into a single high-throughput, fault-tolerant connection with sub-second failover.

---

## ⚡ Quick Start

### 1. Launch All Subsystems
Double-click [`scripts/start-all.bat`](file:///d:/NexusBond/scripts/start-all.bat) or run:
```bash
d:\NexusBond\scripts\start-all.bat
```

### 2. Access the Dashboard
Open your browser to:
**[http://localhost:5173](http://localhost:5173)**

### 3. Proxy Endpoints
- **SOCKS5 Multi-WAN Proxy:** `127.0.0.1:1080`
- **HTTP/HTTPS Proxy:** `127.0.0.1:8080`
- **Control API & Telemetry:** `http://127.0.0.1:5000`

---

## 🏗️ Architecture & Features

- **Dynamic Weighted Round-Robin (WRR):** Interleaves streams across physical adapters based on real-time RTT latency and capacity.
- **Latency-Aware Traffic Routing:** Automatically routes gaming, VoIP, and DNS traffic to the lowest-ping interface while routing bulk downloads to high-bandwidth links.
- **Sub-Second Failover:** Reroutes live streams in $<1000$ms if an adapter drops link or experiences packet loss.
- **Parallel DNS Racing:** Races DNS lookups across all connected interfaces to return sub-millisecond responses.
- **Mode A (Zero Cost Local Dispatch):** Aggregates multi-stream downloads, browser tabs, video streaming, and game updates locally with zero VPS requirement.
- **Mode B (Multipath Bonding Tunnel):** Tunnels packet-striped subflows to a self-hosted cloud VPS relay for single-stream aggregation.

For complete roadmap and documentation, refer to [`progress.md`](file:///d:/NexusBond/progress.md) and [`SRS.md`](file:///d:/NexusBond/SRS.md).
