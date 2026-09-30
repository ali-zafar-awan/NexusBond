# NexusBond Architecture Decision Records (ADR)

This document records key technical decisions, rationales, and trade-offs for NexusBond v2.0.

---

## ADR-001: Rust Data Plane + Python/FastAPI Control Bridge
- **Status:** Accepted (WP0)
- **Context:** SRS v2.0 requires sub-millisecond scheduling overhead (NFR-3: <2.0 ms scheduling overhead, <50 MB memory, 2.5 Gbps saturation). Pure Python runtime cannot sustain multi-gigabit packet striping or microsecond packet reordering.
- **Decision:** Build the entire high-speed data plane, tunnel protocol, packet scheduler, crypto, and TUN interface in safe, high-performance Rust. Keep the existing FastAPI REST/WebSocket server and React UI during migration via local JSON-RPC / IPC bridge so the user experiences zero dashboard disruption during migration.
- **Consequences:** Eliminates Python GIL limitations, provides deterministic latency, zero memory leaks, and memory safety.

---

## ADR-002: Custom UDP Multipath Protocol vs MPTCP / WireGuard Multi-Tunnel
- **Status:** Accepted (WP0)
- **Context:** Standard MPTCP is poorly supported on Windows and macOS kernels, and vanilla WireGuard cannot dynamically stripe individual packets across varying-latency physical links without severe out-of-order TCP stalls.
- **Decision:** Use a lightweight custom UDP tunnel protocol (`NXBD` magic 0x4E584244) with Noise_IK authenticated encryption (ChaCha20-Poly1305), explicit sequence numbering, fast reorder buffer, optional Reed-Solomon/XOR FEC, and BBR delivery-rate pacing.
- **Consequences:** Allows single-stream full aggregated bandwidth on any standard OS without requiring custom kernel modules on client or VPS.

---

## ADR-003: Elimination of Simulated Numbers in Benchmarks and Telemetry
- **Status:** Accepted (WP0)
- **Context:** Audit of v1 found fallback formulas (`iface.speed_mbps * 0.75`) and fixed efficiency multipliers (`total * 0.94`) in speed test routines.
- **Decision:** Strictly forbid simulated numbers across all benchmarks and telemetry. If a benchmark fails or a link is unavailable, report the real error or raw measured bytes only. If multiple physical ISPs or macOS are absent during local testing, clearly label results from network namespace / synthetic netem simulators.
- **Consequences:** Complies with SRS v2.0 Rule 4 (Zero fake data).

---

## ADR-004: Workspace Layout & Error Handling Standard
- **Status:** Accepted (WP0)
- **Context:** SRS Section 3.2 defines a modular crate architecture.
- **Decision:** Split functionality into 10 modular crates under `crates/`. All crates use typed error enums (`thiserror`), zero `unwrap()` outside unit tests, and non-blocking asynchronous I/O (`tokio`).
- **Consequences:** High cohesion, fast independent compilation, clean unit testing per module.
