# NexusBond SRS v2.0
**Free, open-source, system-wide network bonding engine (MIT License)**
Version 2.0.0 | Status: Approved for implementation | **Supersedes v1.0.0**

> **Instructions to the AI engineer reading this file**
> 1. Read `progress.md` first. It describes what v1.0 already built (Python engine, FastAPI API, React dashboard). Do **not** start from scratch blindly; follow Section 12 (Migration Plan).
> 2. This file is the source of truth. Where it conflicts with v1.0 behaviour, v2.0 wins.
> 3. Work in the work packages (WP) of Section 12, in order. After each WP: run its tests, then update `progress.md` (status, new files, test results).
> 4. No placeholders, no `TODO`, no fake/simulated results presented as real measurements. If something cannot be tested on this machine, say so in `progress.md`.
> 5. Everything stays free: MIT project, permissive dependencies only (MIT/Apache-2.0/BSD/ISC), no telemetry, no paid services.

---

## 1. Purpose and Core Goal
NexusBond combines 2 to 8 internet connections (Ethernet, Wi-Fi, USB tethering, 4G/5G) into **one virtual connection** for the whole operating system. Example: links of 20 + 30 + 50 Mbps must appear to every application, including the browser and speed-test sites, as one connection of about 95 Mbps.

**Design rule:** everything is free. No paid servers, no subscriptions, no telemetry.

### 1.1 Honest Physics Note
A single TCP connection normally travels over one link. To let one download or one speed-test stream use all links, packets must be split across links and rejoined at a point that can be reached from all of them. That point is the **Bonding Relay**. v2.0 makes the relay free and easy to deploy so full-speed bonding is the default, not an optional extra.

### 1.2 What Changed from v1.0
| Area | v1.0 | v2.0 |
|---|---|---|
| Default mode | Local dispatch (no single-stream gain) | **Auto mode**: bonded tunnel when a relay is available, else Parallel Fetch + Local Dispatch |
| Relay | Optional, vague | Free relay options, one-command installer, relay ranking and failover |
| Scheduler | Weighted round-robin | **Predictive, latency-compensated (earliest-arrival) packet scheduler** |
| Reordering | Not specified | Adaptive reorder buffer |
| Failover | Claimed zero reset in all modes | Zero reset in tunnel mode; fast re-pin in local mode (UI says some connections may reset) |
| Loss handling | Duplicate SYN/ACK | Adaptive FEC + selective duplication inside the tunnel |
| Performance | Basic | Batching, zero-copy, multi-core, UDP GSO/GRO |
| Security | Encryption only | Mutual auth, key rotation, kill switch, leak protection, IPv6 |
| Acceptance tests | 3 | Per-mode test matrix (Section 9) |
| Core language | Python | **Rust data plane** (Section 3.1); Python/React kept only as transitional control plane |

---

## 2. Operating Modes
| Mode | Needs relay? | Single stream | Many streams | Notes |
|---|---|---|---|---|
| **A. Local Smart Dispatch** | No | Fastest link only | Sum of links | Works anywhere, instantly |
| **A+. Parallel Fetch Accelerator** | No | Yes, for HTTP/HTTPS downloads | Yes | Splits one download into byte ranges fetched over different links (browser extension and built-in downloader) |
| **B. Bonded Tunnel (default when available)** | Yes (free) | **Yes, about 90-95% of the sum** | Yes | Packet-level striping, failover without resets |
| **Auto (default)** | Optional | Best available | Best available | Picks B, else A+ with A; switches live |

### 2.1 Free Relay Options (Zero Cost)
1. **Self-host on a free cloud tier** (for example an always-free VPS): one-command installer and container image.
2. **Self-host at home**: Raspberry Pi, old PC, or OpenWrt router (needs a public IP or port forwarding; dynamic DNS supported).
3. **Community relays**: voluntary public relay list with health and load ratings, rate-limited per user.
4. **Friend/peer relay**: share a relay with trusted people using invite keys.

The client never depends on one relay: it keeps a ranked list and fails over automatically.

---

## 3. Architecture

```
Apps -> Virtual TUN adapter -> Flow Classifier -> Scheduler -> Encrypt/FEC -> Per-link UDP sockets -> Relay -> Internet
                                   ^                  ^
                            Link Estimator  <-  Probes (RTT, loss, bandwidth)
```

### 3.1 Technology Decisions (final unless the user changes them)
| Concern | Decision |
|---|---|
| Data plane (TUN, scheduler, crypto, FEC, relay) | **Rust**, `tokio`. Python cannot reach the NFR-3 throughput or the per-packet latency targets. |
| Crypto | Noise_IK_25519_ChaChaPoly_BLAKE2s (`snow`), `chacha20poly1305`, `x25519-dalek` |
| FEC | `reed-solomon-erasure` |
| Virtual adapter | `wintun` (Windows), `utun` (macOS), `/dev/net/tun` (Linux) |
| Mode A userspace TCP/IP | `smoltcp` |
| IPC | JSON-RPC 2.0 over named pipe (Windows) / Unix socket (Linux, macOS) |
| Control plane (transitional) | Existing Python FastAPI + React dashboard, re-pointed to talk to the Rust daemon over IPC |
| Final UI | Tauri 2 + React (reuse the existing React components) |
| Tests | `cargo test`, Python `pytest` for the bridge, Linux netns + `tc netem` harness (WSL2 is acceptable on Windows) |

The existing Python modules are **not thrown away**: they serve as reference behaviour, as the Mode A fallback until the Rust `nexus-localdispatch` crate passes the same tests, and as the source of the dashboard.

### 3.2 Planned Repository Layout
```
NexusBond/
  core_engine/          (existing Python v1: kept, see Section 12 for what is retired)
  ui/                   (existing React dashboard, kept and extended)
  crates/               (NEW, Rust workspace)
    nexus-proto/        wire format, frames, Noise glue
    nexus-crypto/       keys, session, rekey, replay window
    nexus-linkmon/      interface discovery, hot-plug, probes, estimator
    nexus-sched/        predictive scheduler, pacing, reorder buffer, FEC
    nexus-tun/          TUN abstraction and route manager
    nexus-ipc/          JSON-RPC server/client
    nexus-localdispatch/  Mode A userspace proxy
    nexus-fetch/        Mode A+ range downloader
    nexus-relay/        relay server binary
    nexus-client/       client daemon binary
    nexus-cli/          control CLI
  extension/            browser extension (Mode A+)
  scripts/              installers (relay, client), Dockerfile.relay
  tests/                pytest (legacy) + netns/ (new)
```

---

## 4. Functional Requirements

### 4.1 Interface Management
- **FR-1.1** Detect all active non-loopback interfaces using native APIs: IP Helper (Windows), SystemConfiguration/getifaddrs (macOS), rtnetlink (Linux). Exclude the NexusBond TUN, docker/bridge/veth and VPN adapters unless the user enables them.
- **FR-1.2** Detect links that share the same upstream (same gateway or same public IP and combined throughput not above the faster link by more than 15%). Warn that they add no bandwidth; still allow use.
- **FR-1.3** Hot-plug and hot-unplug with live rebind in under 2 seconds.
- **FR-1.4** Handle CGNAT, double NAT and changing carrier IPs; the tunnel identifies a client by key/session id, not by IP.
- **FR-1.5** Support 2 to 8 links.

### 4.2 Link Estimation
- **FR-2.1** Continuously estimate per-link bandwidth, RTT, jitter and loss using passive measurement plus light probes (every 250 ms when active, 500 ms when idle).
- **FR-2.2** Measure real capacity with a short bandwidth burst on start and after link changes (rate doubling every 100 ms until loss or RTT above 1.5x min), not only user-entered values. Re-run a 300 ms mini-burst every 30 s for links not refreshed by real traffic.
- **FR-2.3** Per-link BBR-style congestion control and pacing so weak links are not overfilled and bufferbloat is avoided. Smoothing: `srtt = 7/8 srtt + 1/8 sample`; loss = EWMA over the last 200 packets; `cwnd = max(4*MSS, 2*bw*rtt_min)`.

### 4.3 Scheduling and Aggregation
- **FR-3.1 Predictive scheduler (earliest estimated arrival).** For each packet of size `s`, for each usable link `i` with `inflight_i + s <= cwnd_i`: `arrival_i = now + (queued_i + s)/bw_i + owd_i`, `penalty_i = arrival_i * (1 + 4*loss_i)`. Send on the link with the smallest penalty; if none is usable, apply backpressure. This is what makes 20 + 30 + 50 approach 100.
- **FR-3.2 Flow-aware policy.** Classify by 5-tuple. *Interactive* (DNS, small UDP under 300 B and under 500 kbit/s, TCP SYN/FIN/RST, ICMP): send on the link with lowest `srtt + 2*jitter`; duplicate on the second-best link if that link's loss exceeds 3%. *Bulk*: earliest-arrival rule across all links.
- **FR-3.3 Adaptive FEC (tunnel mode).** Off while all links have loss under 1%. When any link exceeds 1%, use Reed-Solomon groups of `k` (8 to 32) data packets with `m = ceil(k * max_loss * 1.5)` (1 to 8) parity packets, placed on other links when possible. Disable after loss stays under 0.5% for 10 s. Keep FEC overhead under 25% of tunnel traffic.
- **FR-3.4 Selective duplication.** Duplicate only small critical packets (SYN, handshake, DNS, ACK bursts) across links inside the tunnel. Receivers de-duplicate by `global_seq`. Retransmit unacked `important` packets after `1.5 * srtt` on the best other link.
- **FR-3.5 Adaptive reorder buffer.** Ring buffer of 4096 packets keyed by `global_seq`. Hold time before skipping a gap = `clamp((max_owd - min_owd) + 2*max_jitter, 10 ms, 250 ms)`, recomputed every 200 ms. If reorder timeouts exceed 1% for 5 s, reduce the share of the slowest link by 20% and retest after 10 s; per-flow pinning is the last-resort fallback.
- **FR-3.6 Fairness and caps.** Per-link monthly data caps, priority, `backup_only` ("use only when needed") mode for metered mobile data.

### 4.4 Virtual Adapter and Routing
- **FR-4.1** Virtual TUN adapter (`nexus0`) with batched reads/writes (up to 64 packets). Address `10.77.<client_id>.2/24`, IPv6 ULA `fd77:<client_id>::2/64`; client_id assigned by the relay.
- **FR-4.2** Per-socket binding to physical links so tunnel packets never loop through the TUN: `SO_BINDTODEVICE` (Linux), `IP_UNICAST_IF`/`IPV6_UNICAST_IF` (Windows), `IP_BOUND_IF` (macOS), plus source-IP bind.
- **FR-4.3** Routing: host route for each relay IP via a physical gateway; default route replaced by two half-routes (`0.0.0.0/1`, `128.0.0.0/1`, and IPv6 equivalents) via `nexus0`; LAN routes untouched; a journal file restores original routes on exit or after a crash.
- **FR-4.4** Smart DNS: in tunnel mode use the relay-side caching resolver; in local mode race resolvers over all links and use the first valid answer with local caching. Optional DNS-over-HTTPS.
- **FR-4.5** Full IPv4 and IPv6 support; if the relay lacks IPv6, block IPv6 on the TUN (no leaks).
- **FR-4.6** MTU/MSS auto-tuning: inner MTU = `min(link_mtu) - 28 - 16 - 16 - 16`, default TUN MTU 1380, TCP MSS clamped to `tun_mtu - 40`; recompute on link changes.

### 4.5 Resilience
- **FR-5.1** Link failure detected in under 500 ms (3 missed probes, or no ack for 500 ms while data is in flight).
- **FR-5.2** Tunnel mode: traffic moves to remaining links with no connection resets; in-flight unacked packets are immediately re-sent (same `global_seq`) on the best healthy link.
- **FR-5.3** Local mode: flows on a failed link are re-pinned quickly; new flows use healthy links; the UI clearly states that some connections may reset.
- **FR-5.4** Relay failover to the next ranked relay in under 3 seconds (UI notes that connections may reset when the relay changes). Re-rank relays every 60 s while idle.
- **FR-5.5** Kill switch (optional): block all non-tunnel outbound traffic except to relay addresses and LAN while the tunnel is down; restore rules on clean exit and at start-up after a crash.
- **FR-5.6** Link state machine: `Probing -> Active` (3 good probes + initial burst); `Active -> Degraded` (loss over 10% or RTT over 4x min); `Degraded -> Active` (5 s under both thresholds); any -> `Down` (FR-5.1); `Down -> Probing` every 2 s or on interface-up; plus `Disabled` (user/cap).

### 4.6 Parallel Fetch Accelerator (Mode A+)
- **FR-6.1** Split one HTTP(S) download (size at least 4 MiB) into chunks of `clamp(size/(links*8), 1 MiB, 16 MiB)` fetched concurrently, each on a connection bound to a link; a work-stealing queue gives faster links more chunks. Write chunks at their offsets in a pre-allocated file.
- **FR-6.2** Provide a built-in download manager and an MV3 browser extension (Chrome, Edge, Firefox) that hands downloads to a token-protected local API on `127.0.0.1:7377`. Support resume (`.nexusfetch` sidecar), ETag/Last-Modified consistency checks and integrity checks.
- **FR-6.3** Only used where the server supports range requests; otherwise fall back to Mode A.

### 4.7 User Interface
- **FR-7.1** Live per-link and total throughput graphs, RTT, loss and current mode (exists in v1; keep).
- **FR-7.2** One-click start and first-run wizard: detect links, add/deploy relay (accepts an invite string), run a test.
- **FR-7.3** Built-in **Bonding Test**: measures each link alone (5 s), then bonded (10 s), and shows per-link Mbps, expected sum, achieved Mbps and efficiency percentage. The test must use real traffic; results must never be simulated.
- **FR-7.4** Per-link labels, enable/disable, priority, `backup_only`, data caps and usage stats.
- **FR-7.5** Tray/menu bar control and notifications for link changes and relay status.
- **FR-7.6** Diagnostics panel explaining why speed is below the sum (shared upstream, weak signal, relay bottleneck, high reordering).
- **FR-7.7** UI must display honest-behaviour messages from Section 8.

### 4.8 Relay Server
- **FR-8.1** Single static binary and Docker image; install in one command (`scripts/install-relay.sh`: binary, user, keypair, config, sysctl forwarding, nftables masquerade, systemd unit; prints the invite string). Supports Ubuntu, Debian, Fedora.
- **FR-8.2** Multi-user with key-based authentication (`authorized_clients` file) and per-user rate limits.
- **FR-8.3** Handles 1 Gbps on a small VPS; horizontal scaling not required for v2.
- **FR-8.4** Abuse controls: rate limiting, max 8 paths per client, 10 handshakes per minute per IP, optional allow-list; unauthenticated packets dropped silently (no replies).
- **FR-8.5** Relay bandwidth must be at least the combined speed of the user's links; the wizard/Bonding Test warns when the relay is the bottleneck.
- **FR-8.6** Relay learns each path's latest authenticated source `ip:port` (handles NAT rebinding) and runs the same predictive scheduler, FEC and reorder buffer for the return direction.

---

## 5. Wire Protocol (summary, implement in `nexus-proto`)
Transport is UDP: one socket per physical link on the client; the relay listens on one UDP port (default 51820) and identifies clients by `session_id`.

```
| type u8 | flags u8 | path u8 | rsvd u8 | session_id u32 | nonce_counter u64 | ciphertext (AEAD, 16B tag) |
```
- Types: `0x01` Handshake-Init, `0x02` Handshake-Response, `0x10` Data, `0x11` Ack, `0x12` Probe, `0x13` Probe-Reply, `0x14` FEC-Parity, `0x20` Rekey, `0x30` Close.
- Handshake: Noise_IK; the client knows the relay's public key (invite string `nexus://host:port#<base64 pubkey>`); the relay checks the client key against `authorized_clients`. Additional links join the existing session without a new handshake.
- Data plaintext: `global_seq u64 | fec_group u32 | fec_index u8 | fec_k u8 | fec_m u8 | flags u8 | ip_len u16 | ip_packet`.
- Ack (at most every 10 ms or 10 packets, on every path): path, largest seq, 64-bit bitmap, receive rate, reorder timeouts, echo timestamp, ack delay.
- Probe: `probe_id u32 | send_time u64`, padded to 64 bytes, echoed by the relay on the same path.
- Replay window 8192 nonces. Rekey every 2 minutes or 1 GiB; keep the old key 5 s.
- The 16-byte outer header is authenticated as associated data.

---

## 6. Non-Functional Requirements
| ID | Requirement | Target |
|---|---|---|
| NFR-1 | Bonding efficiency (tunnel mode, 20/30/50 Mbps reference) | at least 90% of the sum (at least 90 Mbps single stream) |
| NFR-2 | Added latency | under 3 ms local processing (p99); overall RTT penalty under 10% vs best link |
| NFR-3 | Throughput | at least 2 Gbps on a 4-core reference CPU |
| NFR-4 | Memory | under 80 MB idle, under 200 MB under load |
| NFR-5 | CPU | under 1.5% idle; under 35% of one core per 100 Mbps |
| NFR-6 | Failover | under 500 ms detection; zero resets in tunnel mode |
| NFR-7 | Data overhead | under 6% (headers, parity, probes) in normal conditions |
| NFR-8 | Crypto | Noise, ChaCha20-Poly1305, key rotation every 2 min or 1 GB |
| NFR-9 | Privacy | no telemetry; never log payloads, destination addresses or DNS names; logs contain only link names, counters, error categories |
| NFR-10 | Platforms | Windows 10/11 (x64, ARM64), macOS 12+ (Apple Silicon, Intel), Linux (systemd distros) |
| NFR-11 | License | MIT, all dependencies permissively licensed |
| NFR-12 | Startup | bonded within 5 s of service start |
| NFR-13 | Code quality (Rust) | no `unwrap()` outside tests, typed errors (`thiserror`), `#![forbid(unsafe_code)]` except isolated documented OS FFI modules |

---

## 7. Performance Engineering and Security
**Performance:** zero-copy buffers from a pool (fixed 2048 B), no per-packet heap allocation; batched TUN and socket I/O; UDP GSO/GRO, `sendmmsg`/`recvmmsg`, io_uring where available; one worker per core with bounded lock-free queues; hardware-friendly crypto (ChaCha20 default); eBPF/XDP fast path is a later optional item.

**Security:** mutual authentication with static keys; forward secrecy via ephemeral keys and rekey; replay protection; kill switch; DNS/IPv6 leak protection; secrets in OS-protected state directory (mode 0600 / restricted ACL), never in logs; privilege separation (service has only needed capabilities, UI never runs as admin); signed releases with checksums; `cargo deny` and `cargo audit` in CI. macOS: signed network extension/launchd daemon with user approval. Windows: service plus bundled signed WinTUN driver installed with admin rights.

---

## 8. Limits the User Must Be Told (UI and docs must state these)
- Speed seen equals the sum of links only if the relay and its internet path can carry it. A slow relay caps the result, and the UI must say so.
- Links sharing one upstream (two Wi-Fi adapters on one router) do not add speed; the UI flags them.
- Local mode without a relay: a single connection uses one link; many connections and Parallel Fetch downloads add up.
- Mobile carriers may throttle or change IPs; the engine adapts but cannot exceed real signal capacity.
- Expected tunnel efficiency is 90 to 95% of the sum after overhead.

---

## 9. Verification and Acceptance
All results must come from real measurements (`iperf3`, real downloads), never hard-coded.

| # | Test | Pass condition |
|---|---|---|
| 1 | 3-link detection (Ethernet, Wi-Fi, USB tether) | All detected and used |
| 2 | Tunnel mode, single stream (20/30/50 Mbps links) | at least 90 Mbps |
| 3 | Local mode, 16 parallel streams | at least 90% of sum |
| 4 | Fetch accelerator, single large download | at least 85% of sum |
| 5 | Unplug one link mid-download (tunnel) | No reset, transfer completes, recovery under 500 ms |
| 6 | Unplug one link (local) | New flows continue; impact reported in UI |
| 7 | 5% loss on one link | Throughput drop under 15% with FEC |
| 8 | Asymmetric latency (10 / 60 / 120 ms) | No stall; efficiency at least 80% |
| 9 | Relay failover | Under 3 s, no user action |
| 10 | Leak tests (DNS, IPv6, kill switch) | No leaks |
| 11 | Resource limits | Meet NFR-4 and NFR-5 |
| 12 | Add a link mid-transfer | Throughput rises within 3 s |
| 13 | Two links behind one upstream | Flagged `shared_upstream` |
| 14 | Soak: 1 hour at 100 Mbps | Memory growth under 10%, no crash |

**Unit tests required:** scheduler decisions on synthetic links; reorder buffer (in-order, gaps, duplicates, timeouts); FEC encode/recover; protocol parser fuzzing; Noise handshake and rekey; replay window; estimator convergence.
**Integration harness:** Linux network namespaces `client`, `relay`, `internet` joined by veth pairs with `tc netem`/`tbf` for rate, delay, loss. `make test` and `make bench` print a results table. On Windows, run the harness inside WSL2.
The 7 existing v1 pytest tests must keep passing until the module they cover is formally retired in `progress.md`.

---

## 10. Configuration (`config.toml`, hot-reloadable)
```toml
[general]
mode = "auto"            # auto | tunnel_only | local_only
kill_switch = false
log_level = "info"

[[relay]]
name = "my-relay"
host = "relay.example.org"
port = 51820
public_key = "BASE64..."

[[link]]                 # optional overrides; unlisted interfaces are auto-detected
match_name = "Wi-Fi"
label = "Home Wi-Fi"
enabled = true
priority = 1
backup_only = false
monthly_cap_gb = 0       # 0 = unlimited
weight_override_mbps = 0 # 0 = auto

[fec]
enabled = "auto"         # auto | off | on

[fetch]
enabled = true
min_size_mb = 4
api_token = "GENERATED"
```
The v1 JSON config (`core_engine/config.py`) must be migrated automatically on first start (adapter nicknames, caps, thresholds).

**Control API (JSON-RPC over local socket):** `status`, `links.list`, `links.set`, `mode.set`, `relay.list/add/remove/test`, `bench.run`, `diagnostics.get`, `subscribe.metrics` (every 500 ms). The existing FastAPI endpoints (`/api/status`, `/api/interfaces`, `/ws/telemetry`) stay as a compatibility bridge that forwards to this API, so the React dashboard keeps working during migration.

---

## 11. Mode Controller (Auto)
Evaluated every second:
1. Relay reachable (handshake OK and at least 2 links `Active`): `Tunnel`.
2. Otherwise `LocalDispatch` with Fetch enabled.
3. Local to Tunnel only after the relay has been reachable 5 consecutive seconds; new flows use the tunnel, old pinned flows continue up to 60 s.
4. Manual override: `auto`, `tunnel_only`, `local_only`.
5. With only one active link, run single-link pass-through with minimal overhead.

---

## 12. Migration Plan: from v1.0 (current code) to v2.0

### 12.1 Baseline (from `progress.md`)
v1.0 is complete as a Python system: psutil interface detector, source-IP socket binding, SOCKS5 and HTTP proxies, DNS racer, WRR scheduler, latency router, failover manager, WinTUN bridge, FastAPI + WebSocket telemetry, React dashboard, and a Python relay/client prototype (Mode B). 7 pytest tests pass.

### 12.2 Gap Analysis
| v2 requirement | v1 state | Action |
|---|---|---|
| Predictive scheduler (FR-3.1) | WRR only | Replace in Rust; keep WRR only as Mode A flow placement |
| Link estimator, BBR pacing (FR-2.x) | 500 ms RTT/jitter/loss probe, no bandwidth estimate | Extend: burst capacity measurement, delivery-rate estimator |
| Reorder buffer, FEC, dedup (FR-3.3 to 3.5) | Missing | New (`nexus-sched`) |
| Real packet-level tunnel, Noise crypto (Section 5) | Python relay prototype, no verified Noise/AEAD/session ids | Rewrite in Rust (`nexus-proto`, `nexus-crypto`, `nexus-relay`, `nexus-client`) |
| Full TUN capture + routing (FR-4.x) | WinTUN abstraction, metric equalizing | Rust `nexus-tun` with half-route scheme, journal, leak protection |
| Kill switch, IPv6 leak protection | Missing | New |
| Upstream-sharing detection (FR-1.2) | Subnet/gateway check only | Extend with public-IP + throughput test |
| Parallel Fetch + extension (Mode A+) | Missing | New |
| Auto mode controller | Manual Mode A/B badge | New state machine (Section 11) |
| Relay list, ranking, failover | Single relay | New |
| Bonding Test with real numbers | `SpeedTestModal` + CLI | Audit: must use real traffic (FR-7.3); remove any simulated numbers |
| Installer for relay | Missing | `scripts/install-relay.sh`, Dockerfile |
| UI (dashboard, cards, graph, logs) | Done | Keep; add wizard, relays, diagnostics, Bonding Test results, link settings |

### 12.3 Work Packages (execute in order; update `progress.md` after each)
| WP | Content | Done when |
|---|---|---|
| **WP0** | Audit v1: confirm what is real vs stubbed (especially Mode B relay/client, speed test). List findings in `progress.md`. Create Cargo workspace, CI, `docs/DECISIONS.md`. | Findings written; `cargo build` passes on empty crates; 7 pytest tests still pass |
| **WP1** | `nexus-proto`, `nexus-crypto`: frame format, Noise_IK, rekey, replay window, fuzz target | Unit + fuzz tests pass |
| **WP2** | `nexus-linkmon`: discovery, hot-plug, per-link socket binding, probes, capacity burst, estimator | Test 1 and estimator-convergence tests pass |
| **WP3** | `nexus-sched`: predictive scheduler, pacing, reorder buffer, dedup; simulator with synthetic delay/loss | Scheduler and reorder unit tests pass; simulated 20/30/50 gives at least 90% |
| **WP4** | `nexus-relay` + `nexus-client` (Linux first): tunnel end-to-end over netns, `nexus-tun`, routing, installer script | Tests 2, 8, 12 pass in netns |
| **WP5** | FEC, selective duplication, failover, relay ranking/failover, kill switch, leak protection | Tests 5, 7, 9, 10 pass |
| **WP6** | Windows port (WinTUN, IP Helper, routes, service) and macOS port (utun, PF_ROUTE, launchd) | Tests 1, 2, 5 pass on Windows (relay on Linux/WSL2/VPS); macOS documented if untestable |
| **WP7** | `nexus-ipc` + FastAPI compatibility bridge; dashboard reads real Rust telemetry; wizard, Relays, Diagnostics, Bonding Test, link settings | Dashboard shows live data from the Rust daemon; UI checks pass |
| **WP8** | `nexus-localdispatch` (Rust Mode A) and mode controller; retire Python proxies only after parity tests pass | Test 3 passes; legacy tests ported or retired in `progress.md` |
| **WP9** | `nexus-fetch` + browser extension | Test 4 passes |
| **WP10** | Performance tuning (NFR-3/4/5), soak, security review, Tauri packaging, docs, release | Tests 11, 13, 14 pass; README and installers complete |

### 12.4 Rules for the AI engineer
- Read `progress.md` and this file at the start of every session; append a dated entry to `progress.md` at the end (what changed, tests run, what is unverified).
- Never mark a WP complete without its "Done when" evidence in the log.
- Do not claim a speed result you did not measure. If a platform or hardware is unavailable (for example three real ISPs, macOS), say so and use the netns/simulator result labelled as such.
- Keep the project running for the user during migration: v1 launchers (`scripts/start-all.bat`) must keep working until WP8 replaces the Python data path.
- When a choice is not specified here, pick the simplest correct option and record it in `docs/DECISIONS.md`.

---

## 13. Realistic Timeline (solo developer, about 10-12 months; an AI-assisted pace may be faster)
| Phase | WPs | Duration |
|---|---|---|
| Foundations + protocol | WP0-WP2 | about 8 weeks |
| Scheduler + simulator | WP3 | 6 weeks |
| Tunnel + relay (MVP on Linux) | WP4 | 10 weeks |
| Resilience | WP5 | 6 weeks |
| Windows and macOS | WP6 | 10 weeks |
| UI + IPC | WP7 | 6 weeks |
| Mode A + A+ | WP8-WP9 | 6 weeks |
| Tuning, security, release | WP10 | 6 weeks |

**Recommended MVP:** Linux relay plus client with Mode B first (through WP4). It proves 20 + 30 + 50 = about 95 Mbps before investing in other platforms.

## 14. Open Decisions
1. Rust data plane with Python control plane as a bridge (chosen) versus a full Python rewrite-free approach (rejected: cannot meet NFR-3).
2. Custom UDP tunnel (chosen) versus MPTCP/WireGuard-based aggregation.
3. Which free hosting tiers to document for relays, since terms change.
4. Community relay governance and abuse policy.
