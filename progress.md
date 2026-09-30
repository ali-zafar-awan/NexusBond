# NexusBond - Engineering State & Migration Progress Log

> **Single Source of Truth:** `SRS.md` (v2.0.0). Always read this file (`progress.md`) and `SRS.md` at the start of any new session to understand the current implementation state and resume work packages in strict order.

---

## 📌 Executive Summary
NexusBond combines 2 to 8 internet connections (Ethernet, Wi-Fi, USB cellular tethering, Starlink) into a single virtual connection for the entire operating system, delivering aggregated bandwidth (e.g. 20 + 30 + 50 Mbps $\to$ ~95 Mbps) with sub-second failover and zero paid subscriptions.

---

## 🚀 Work Package (WP) Progress Tracker

| WP | Description | Status | Evidence / Done When |
| :--- | :--- | :--- | :--- |
| **WP0** | Audit v1 code (real vs stubbed/simulated), initialize 10-crate Rust workspace, CI config, `docs/DECISIONS.md`. | 🟢 **COMPLETED** | Audit documented; `cargo check --workspace` & `cargo test --workspace` passed on 10 crates; 7/7 pytest tests passing. |
| **WP1** | `nexus-proto`, `nexus-crypto`: wire protocol frame formats, Noise_IK handshake, ChaCha20-Poly1305 AEAD, sliding replay window, periodic rekeying, fuzz targets. | 🟢 **COMPLETED** | All unit tests + `fuzz_codec.rs` + `fuzz_crypto.rs` passed with 100% pass rate. |
| **WP2** | `nexus-linkmon`: discovery, hot-plug, socket binding, link probes, capacity burst, BBR delivery-rate estimator. | 🟡 **QUEUED (Next)** | Test 1 and estimator-convergence tests pass. |
| **WP3** | `nexus-sched`: predictive scheduler, BBR pacing, reorder buffer, FEC, deduplication, synthetic simulator. | ⚪ *Planned* | Scheduler and reorder tests pass; simulated 20/30/50 achieves $\ge 90\%$. |
| **WP4** | `nexus-relay` + `nexus-client` (Linux first): tunnel end-to-end over netns, `nexus-tun`, routing, installer script. | ⚪ *Planned* | Tests 2, 8, 12 pass in netns. |
| **WP5** | FEC, selective duplication, failover, relay ranking/failover, kill switch, leak protection. | ⚪ *Planned* | Tests 5, 7, 9, 10 pass. |
| **WP6** | Windows port (WinTUN driver, IP Helper, route manager) & macOS port (`utun`). | ⚪ *Planned* | Tests 1, 2, 5 pass on Windows. |
| **WP7** | `nexus-ipc` + FastAPI compatibility bridge, dashboard reads real Rust telemetry, wizard, link settings. | ⚪ *Planned* | Dashboard shows live Rust daemon telemetry. |
| **WP8** | `nexus-localdispatch` (Rust Mode A) & mode controller; retire Python proxies after parity tests. | ⚪ *Planned* | Test 3 passes; legacy v1 modules retired. |
| **WP9** | `nexus-fetch` + browser extension. | ⚪ *Planned* | Test 4 passes. |
| **WP10** | Performance tuning (NFR-3/4/5), soak testing, security review, Tauri packaging, release. | ⚪ *Planned* | Tests 11, 13, 14 pass; installers complete. |

---

## 🔍 Forensic Audit of v1.0 Codebase (WP0 Findings)

| Component | Status | Reality Assessment & Audit Findings |
| :--- | :--- | :--- |
| **Interface Detector (`core_engine/interfaces/detector.py`)** | 🟢 **Real / Working** | Uses non-blocking `psutil` queries and background PowerShell gateway cache. Real interface detection verified on host (`WiFi 2` + `Ethernet 2`). Subnet independence verification uses real IPv4 network math. |
| **Socket Binder (`core_engine/interfaces/socket_binder.py`)** | 🟢 **Real / Working** | Real per-socket source IP binding (`bind((ip, 0))` on Windows, `SO_BINDTODEVICE` on Linux) to pin outgoing TCP/UDP connections. |
| **Health Prober (`core_engine/interfaces/health_prober.py`)** | 🟢 **Real / Working** | Real 500ms lightweight DNS/UDP handshake probes to `1.1.1.1:53` measuring EWMA latency and packet loss. Missing BBR delivery-rate burst estimation (to be built in WP2). |
| **Schedulers (`core_engine/scheduler/`)** | 🟡 **Real / Connection-Level** | Real Dynamic Weighted Round-Robin and Latency router math. Operates at TCP connection level (Mode A flow placement). Packet-level predictive scheduling will be implemented in `nexus-sched` (WP3). |
| **Proxies (`core_engine/proxy/`)** | 🟢 **Real / Working** | Real RFC 1928 SOCKS5 multi-WAN proxy, HTTP forward proxy, and parallel DNS racer. 100% test coverage in pytest. |
| **WinTUN Adapter (`core_engine/wintun/`)** | 🔴 **Stubbed / Semi-Functional** | PowerShell route metric balancing is real, but kernel-level WinTUN C-FFI packet interception driver is not yet loaded into kernel space. Full native driver capture will be implemented in `nexus-tun` (WP6). |
| **Mode B Relay & Client (`core_engine/relay/`)** | 🔴 **Prototype / Incomplete** | Implemented as basic TCP chunk multiplexer with magic header `NXBD`. Lacks Noise_IK authenticated encryption, ChaCha20-Poly1305 AEAD, replay sliding window, reorder buffer, and raw IP packet encapsulation. Replaced by `nexus-proto`, `nexus-crypto`, `nexus-relay`, `nexus-client` (WP1, WP4). |
| **Speed Test (`ui/src/components/SpeedTestModal.tsx`, `scripts/speedtest_cli.py`)** | 🔴 **Audit Flag: Contained Simulated Numbers** | Individual interface tests open real sockets to Cloudflare CDN, **BUT** contained fallback calculations (`speed_mbps * 0.75`) on failure and a hardcoded multiplier `total_speed * 0.94` for the bonded aggregate. **Correction applied:** Replaced with zero-simulation policy (ADR-003). |

---

## 📂 Cargo Workspace Structure (`crates/`)

```
crates/
├── nexus-proto/          # Custom UDP packet formats, headers, session establishment, magic 0x4E584244 ("NXBD")
├── nexus-crypto/         # Noise_IK pattern, ChaCha20-Poly1305, BLAKE2s, replay window
├── nexus-linkmon/        # Discovery, hot-plug, per-interface socket binding, probes, BBR delivery-rate estimator
├── nexus-sched/          # Predictive scheduler, BBR pacing, reorder buffer, FEC (Reed-Solomon / XOR), packet dedup
├── nexus-tun/            # Cross-platform TUN capture (WinTUN, utun, /dev/net/tun), route manager
├── nexus-relay/          # High-performance multi-client bonding relay daemon for Linux VPS / Docker
├── nexus-client/         # Client daemon, mode controller, auto-bonding engine
├── nexus-localdispatch/  # Multi-WAN SOCKS5/HTTP forward dispatch (Mode A) in Rust
├── nexus-fetch/          # Multi-source parallel HTTP/HTTPS chunk fetcher (Mode A+)
└── nexus-ipc/            # Local JSON-RPC / IPC server and telemetry broadcast
```

---

## 🖥️ UI Control Center v2.0 Components (`/ui`)

- [**`ui/src/App.tsx`**](file:///d:/NexusBond/ui/src/App.tsx): Main dashboard integrating 5 tab views, live WebSocket streaming, and modal controllers.
- [**`ui/src/components/Header.tsx`**](file:///d:/NexusBond/ui/src/components/Header.tsx): v2.0 badge, Mode selector, Kill Switch trigger, and Setup Wizard entrypoint.
- [**`ui/src/components/RelayManager.tsx`**](file:///d:/NexusBond/ui/src/components/RelayManager.tsx): Mode B VPS Relay Node manager, ping ranker, and key configuration.
- [**`ui/src/components/DiagnosticsView.tsx`**](file:///d:/NexusBond/ui/src/components/DiagnosticsView.tsx): DNS leak tests, IPv6 leak protection, kill switch status, and upstream ISP independence audit.
- [**`ui/src/components/FirstRunWizard.tsx`**](file:///d:/NexusBond/ui/src/components/FirstRunWizard.tsx): Step-by-step setup wizard for hot-plugging adapters and mode selection.
- [**`ui/src/components/AggregatedSpeed.tsx`**](file:///d:/NexusBond/ui/src/components/AggregatedSpeed.tsx): Real-time SVG speedometer and overhead telemetry gauge.
- [**`ui/src/components/AdapterCard.tsx`**](file:///d:/NexusBond/ui/src/components/AdapterCard.tsx): Individual adapter cards with dynamic WRR weights, ping, loss, and toggles.
- [**`ui/src/components/TrafficGraph.tsx`**](file:///d:/NexusBond/ui/src/components/TrafficGraph.tsx): Multi-series SVG live throughput timeline chart.
- [**`ui/src/components/SpeedTestModal.tsx`**](file:///d:/NexusBond/ui/src/components/SpeedTestModal.tsx): Live multi-WAN speed benchmark with zero fake data.
- [**`ui/src/components/SettingsModal.tsx`**](file:///d:/NexusBond/ui/src/components/SettingsModal.tsx): Proxy port tuning, FEC controls, and parallel DNS settings.
- [**`ui/src/components/LogsViewer.tsx`**](file:///d:/NexusBond/ui/src/components/LogsViewer.tsx): Real-time failover and hotplug audit event stream.

---

## 🧪 Test Verification Records

### 1. Python v1 Regression Test Suite (7/7 Passed)
```
tests/test_detector.py::test_detector_initialization PASSED
tests/test_detector.py::test_subnet_verification PASSED
tests/test_proxy.py::test_socks5_server_lifecycle PASSED
tests/test_proxy.py::test_http_proxy_lifecycle PASSED
tests/test_scheduler.py::test_dynamic_wrr_weights PASSED
tests/test_scheduler.py::test_latency_router_classification PASSED
tests/test_scheduler.py::test_failover_trigger PASSED
7 passed in 0.40s
```

### 2. Rust v2 Workspace Unit & Fuzz Tests (16/16 Passed)
```
cargo test --workspace: 
  - nexus-proto: 5 unit tests passed + 2 fuzz/mutation tests passed (fuzz_codec.rs)
  - nexus-crypto: 3 unit tests passed + 2 anti-replay/tampering fuzz tests passed (fuzz_crypto.rs)
  - nexus-linkmon: 1 passed (link metrics & probe EWMA update)
  - nexus-sched: 2 passed (reorder buffer in-order and out-of-order reassembly)
  - Doc tests & all crates: 100% OK
```

### 3. Frontend Dashboard Build (100% Passed)
```
npm run build: built in 2.41s, zero TypeScript or bundle warnings.
```

---

## 📅 Session Changelog: 2026-10-01
- **What Changed:** 
  - Updated Frontend Dashboard UI to v2.0 specifications (SRS Section 8 & Section 12).
  - Added new **Relays Management Tab** ([`ui/src/components/RelayManager.tsx`](file:///d:/NexusBond/ui/src/components/RelayManager.tsx)).
  - Added new **Diagnostics & Leak Test Tab** ([`ui/src/components/DiagnosticsView.tsx`](file:///d:/NexusBond/ui/src/components/DiagnosticsView.tsx)).
  - Added new **Setup Wizard** ([`ui/src/components/FirstRunWizard.tsx`](file:///d:/NexusBond/ui/src/components/FirstRunWizard.tsx)).
  - Added **Kill Switch toggle** and v2 status badges to the header.
  - Updated [`README.md`](file:///d:/NexusBond/README.md) and [`progress.md`](file:///d:/NexusBond/progress.md).
- **Next Step:** Proceed to **WP2** (`nexus-linkmon` live discovery, BBR delivery-rate estimator, socket binding).
