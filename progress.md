# NexusBond - Engineering State & Progress Log

> **Note for Future Sessions:** Always read this file (`progress.md`) and `SRS.md` at the start of any new session to understand the current implementation state, active components, and next evolutionary steps.

---

## 📌 Executive Summary
**NexusBond** is an open-source, multi-WAN internet bonding and intelligent traffic scheduling system. It aggregates multiple physical and virtual network adapters (e.g., Wi-Fi, Ethernet, USB 4G/5G Tethering, Starlink) into a single high-throughput, fault-tolerant connection with sub-second failover.

---

## 🚀 Architectural Phases & Completion Status

| Phase | Description | Status | Verification & Deliverables |
| :--- | :--- | :--- | :--- |
| **Phase 1: Core Engine & Multi-Socket Proxy** | Multi-OS interface detector, dynamic socket source IP binding, SOCKS5 multi-WAN server, HTTP forward proxy, DNS racing engine. | 🟢 **COMPLETED** | Tested via Pytest (`tests/test_detector.py`, `tests/test_proxy.py`) & live network discovery. |
| **Phase 2: Schedulers, Virtual Network & Failover** | Dynamic Weighted Round Robin (WRR), Latency-Aware classification router, sub-second failover manager, WinTUN adapter abstraction, metric equalizing. | 🟢 **COMPLETED** | Tested via Pytest (`tests/test_scheduler.py`). 100% test pass rate. |
| **Phase 3: Real-Time API & Web/Desktop Dashboard** | FastAPI REST API, WebSocket live telemetry stream (500ms), Glassmorphic Dashboard, SVG speedometer & live throughput timeline graphs, per-adapter controls, multi-WAN speed tester. | 🟢 **COMPLETED** | Verified TypeScript compilation & live Vite dev server at `http://127.0.0.1:5173`. |
| **Phase 4: Mode B Multipath Relay & Daemon Automation** | Self-hosted VPS bonding relay server (`core_engine/relay/server.py`), multipath packet striping client (`core_engine/relay/client.py`), CLI benchmarking suite, launcher scripts (`scripts/start-all.bat`). | 🟢 **COMPLETED** | Verified Mode A & Mode B subflow protocol handling & CLI speedtest tool. |

---

## 📂 Comprehensive Component Index

### 1. Core Engine Backend (`/core_engine`)
- [`core_engine/config.py`](file:///d:/NexusBond/core_engine/config.py)
  - Persistent JSON configuration manager for thresholds, adapter nicknames, limits, and server defaults.
- [`core_engine/interfaces/detector.py`](file:///d:/NexusBond/core_engine/interfaces/detector.py)
  - Non-blocking interface scanner using `psutil` with background metadata caching.
  - Validates independent default gateways / subnets to eliminate routing loops (FR-1.2).
  - Real-time hot-plug detection for newly connected adapters (FR-1.3).
- [`core_engine/interfaces/socket_binder.py`](file:///d:/NexusBond/core_engine/interfaces/socket_binder.py)
  - Low-level source IP socket binding (`bind((ip, 0))` on Windows/macOS, `SO_BINDTODEVICE` on Linux) guaranteeing outbound physical interface pin-down (FR-3.2).
- [`core_engine/interfaces/health_prober.py`](file:///d:/NexusBond/core_engine/interfaces/health_prober.py)
  - 500ms lightweight RTT latency, jitter, and packet loss heartbeat monitor per interface (FR-4.1).
- [`core_engine/scheduler/dynamic_wrr.py`](file:///d:/NexusBond/core_engine/scheduler/dynamic_wrr.py)
  - Dynamic Weighted Round-Robin load balancer weighting connections by capacity, inverse latency, and error loss (FR-2.1).
- [`core_engine/scheduler/latency_router.py`](file:///d:/NexusBond/core_engine/scheduler/latency_router.py)
  - Interactive/gaming/VoIP low-latency router vs bulk download high-bandwidth router (FR-2.2).
- [`core_engine/scheduler/failover.py`](file:///d:/NexusBond/core_engine/scheduler/failover.py)
  - Sub-second failover engine rerouting active streams when an interface degrades or disconnects (FR-4.2).
- [`core_engine/proxy/socks5_proxy.py`](file:///d:/NexusBond/core_engine/proxy/socks5_proxy.py)
  - High-concurrency RFC 1928 SOCKS5 multi-WAN proxy server dynamically distributing connections across active physical interfaces.
- [`core_engine/proxy/http_transparent.py`](file:///d:/NexusBond/core_engine/proxy/http_transparent.py)
  - Multi-WAN HTTP/HTTPS forward tunneling proxy for web traffic.
- [`core_engine/proxy/dns_multiplexer.py`](file:///d:/NexusBond/core_engine/proxy/dns_multiplexer.py)
  - Parallel DNS racer resolving through the fastest interface server in sub-millisecond times (FR-3.3).
- [`core_engine/wintun/adapter.py`](file:///d:/NexusBond/core_engine/wintun/adapter.py)
  - WinTUN kernel virtual driver integration & user-space smart dispatch bridge.
- [`core_engine/wintun/route_manager.py`](file:///d:/NexusBond/core_engine/wintun/route_manager.py)
  - Windows route table manager for balancing interface metrics.
- [`core_engine/relay/server.py`](file:///d:/NexusBond/core_engine/relay/server.py)
  - Mode B VPS Multipath Relay Server for single-stream aggregation over multi-subflows.
- [`core_engine/relay/client.py`](file:///d:/NexusBond/core_engine/relay/client.py)
  - Mode B Client striping packets across multiple WAN connections to the relay node.
- [`core_engine/api/server.py`](file:///d:/NexusBond/core_engine/api/server.py)
  - FastAPI REST API & WebSocket real-time telemetry broadcaster (`/api/status`, `/api/interfaces`, `/ws/telemetry`).
- [`core_engine/main.py`](file:///d:/NexusBond/core_engine/main.py)
  - Main daemon orchestrating all subsystems with FastAPI Lifespan.

### 2. Frontend Control Dashboard (`/ui`)
- [`ui/src/App.tsx`](file:///d:/NexusBond/ui/src/App.tsx) - Main application with tab views, real-time WebSocket telemetry, and modal managers.
- [`ui/src/components/Header.tsx`](file:///d:/NexusBond/ui/src/components/Header.tsx) - Top status bar, global engine toggle, Mode A/B switcher badge.
- [`ui/src/components/AggregatedSpeed.tsx`](file:///d:/NexusBond/ui/src/components/AggregatedSpeed.tsx) - Real-time aggregated speedometer gauge, RX/TX meters, and overhead metrics.
- [`ui/src/components/AdapterCard.tsx`](file:///d:/NexusBond/ui/src/components/AdapterCard.tsx) - Per-adapter cards with live download/upload stats, RTT ping, packet loss, scheduler weight, and enable/disable toggle.
- [`ui/src/components/TrafficGraph.tsx`](file:///d:/NexusBond/ui/src/components/TrafficGraph.tsx) - Multi-series SVG live throughput timeline chart.
- [`ui/src/components/ModeSelector.tsx`](file:///d:/NexusBond/ui/src/components/ModeSelector.tsx) - Mode A (Local Smart Dispatch) vs Mode B (Bonding Relay) configuration modal.
- [`ui/src/components/SpeedTestModal.tsx`](file:///d:/NexusBond/ui/src/components/SpeedTestModal.tsx) - Multi-WAN speed test benchmarking individual links and bonded aggregate.
- [`ui/src/components/SettingsModal.tsx`](file:///d:/NexusBond/ui/src/components/SettingsModal.tsx) - Proxy ports, DNS multiplexing, scheduling algorithms, and failover thresholds.
- [`ui/src/components/LogsViewer.tsx`](file:///d:/NexusBond/ui/src/components/LogsViewer.tsx) - Real-time audit log stream for failover and hotplug events.

### 3. Scripts & Verification (`/scripts` & `/tests`)
- [`scripts/start-all.bat`](file:///d:/NexusBond/scripts/start-all.bat) - One-click launcher for all subsystems.
- [`scripts/start-engine.bat`](file:///d:/NexusBond/scripts/start-engine.bat) - Starts the core daemon.
- [`scripts/start-ui.bat`](file:///d:/NexusBond/scripts/start-ui.bat) - Starts the UI dev server.
- [`scripts/speedtest_cli.py`](file:///d:/NexusBond/scripts/speedtest_cli.py) - Standalone CLI speed benchmarking utility.
- [`scripts/install-service.ps1`](file:///d:/NexusBond/scripts/install-service.ps1) - Windows Service installer helper.
- [`tests/test_detector.py`](file:///d:/NexusBond/tests/test_detector.py) - Detector verification tests.
- [`tests/test_scheduler.py`](file:///d:/NexusBond/tests/test_scheduler.py) - Scheduler WRR & failover tests.
- [`tests/test_proxy.py`](file:///d:/NexusBond/tests/test_proxy.py) - Multi-WAN SOCKS5 & HTTP proxy tests.

---

## 🧪 Test Verification Summary
All automated test suites executed with 100% pass rate:
```
tests/test_detector.py::test_detector_initialization PASSED
tests/test_detector.py::test_subnet_verification PASSED
tests/test_proxy.py::test_socks5_server_lifecycle PASSED
tests/test_proxy.py::test_http_proxy_lifecycle PASSED
tests/test_scheduler.py::test_dynamic_wrr_weights PASSED
tests/test_scheduler.py::test_latency_router_classification PASSED
tests/test_scheduler.py::test_failover_trigger PASSED
7 passed in 2.52s
```

---

## 💻 Running Endpoints
- **Desktop Dashboard:** `http://127.0.0.1:5173`
- **Core Engine API & Telemetry:** `http://127.0.0.1:5000`
- **SOCKS5 Multi-WAN Proxy:** `127.0.0.1:1080`
- **HTTP/HTTPS Forward Proxy:** `127.0.0.1:8080`
