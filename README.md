# NexusBond 🌐⚡
### High-Performance Multi-WAN Network Bonding & Aggregation Engine (v2.0)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/Version-2.0.0-blue.svg)](https://github.com/ali-zafar-awan/NexusBond)
[![Rust](https://img.shields.io/badge/Rust-1.75%2B-orange.svg)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6.svg)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776ab.svg)](https://www.python.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)](https://github.com/ali-zafar-awan/NexusBond)
[![Telemetry](https://img.shields.io/badge/Telemetry-Zero%20%2F%20100%25%20Private-success.svg)](https://github.com/ali-zafar-awan/NexusBond)

> **GitHub Repository:** [https://github.com/ali-zafar-awan/NexusBond](https://github.com/ali-zafar-awan/NexusBond)

---

## 📌 What is NexusBond?

**NexusBond** combines 2 to 8 concurrent internet connections (Ethernet, Wi-Fi, 4G/5G USB cellular tethering, Starlink) into **one single virtual high-speed pipeline** for your entire operating system.

For example, links of **20 + 30 + 50 Mbps** appear to your computer, browsers, games, download managers, and speed-test sites as a single bonded stream of **~95 Mbps** with sub-second seamless failover and zero paid subscriptions.

```mermaid
flowchart TB
    subgraph Client [User Machine - NexusBond Client]
        Apps["All Applications (Chrome, Firefox, Steam, IDM, Torrents, Discord)"]
        TUN["Virtual WinTUN / SOCKS5 / HTTP Proxy (127.0.0.1:8080)"]
        Engine["NexusBond v2 Engine (Rust Core Data Plane)"]
        Scheduler["Predictive Scheduler & BBR Delivery-Rate Estimator"]
        Links["Physical Links (Wi-Fi + USB 5G Tether + Ethernet + Starlink)"]
        
        Apps --> TUN
        TUN --> Engine
        Engine --> Scheduler
        Scheduler --> Links
    end

    subgraph Internet [Internet & Destination Endpoints]
        Links --> RelayNode["Self-Hosted VPS Relay (Mode B) / Direct Multipath (Mode A)"]
        RelayNode --> Web["Target Web Servers, Video Streams & CDNs"]
    end
```

---

## 📑 Table of Contents
1. [Prerequisites](#-prerequisites)
2. [Installation Guide](#-installation-guide-from-github)
   - [Windows Setup](#1-windows-installation-10--11)
   - [Linux Setup](#2-linux-installation-ubuntudebianarchfedora)
   - [macOS Setup](#3-macos-installation)
3. [Quick Start & Stop Guide](#-quick-start--stop-guide)
4. [How to Route Your System & Browsers](#-how-to-route-windows-laptops--browsers)
5. [Detailed UI Feature Walkthrough](#-detailed-ui-feature-guide)
6. [Operational Modes](#-operational-modes)
7. [Developer & Testing Guide](#-developer--testing-guide)
8. [License](#-license)

---

## 📋 Prerequisites & Automatic Dependency Setup

Before installing NexusBond, make sure you have **Git**, **Python (3.10+)**, **Node.js (18+)**, and optionally **Rust (1.75+)**. 

Run the single command below for your operating system to install all prerequisites automatically:

---

### 🪟 Windows (Run in PowerShell as Administrator):
Windows includes `winget` by default. Install all prerequisites in one line:
```powershell
winget install --id Git.Git --id Python.Python.3.11 --id OpenJS.NodeJS.LTS --id Rustlang.Rustup -e --accept-source-agreements --accept-package-agreements
```
*(Or if using Chocolatey: `choco install -y git python nodejs-lts rustup.install`)*

---

### 🐧 Linux (Run in Terminal):

**Ubuntu / Debian / Linux Mint:**
```bash
# Update and install Git, Python 3, Node.js, and C++ build tools
sudo apt update
sudo apt install -y git python3 python3-pip python3-venv nodejs npm build-essential curl

# Install Rust & Cargo (Optional for native crates)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
```

**Fedora / RHEL / CentOS:**
```bash
sudo dnf install -y git python3 python3-pip nodejs npm gcc gcc-c++ make curl
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
```

**Arch Linux / Manjaro:**
```bash
sudo pacman -Syu --noconfirm git python python-pip nodejs npm base-devel rustup
rustup default stable
```

---

### 🍏 macOS (Run in Terminal):
Ensure [Homebrew](https://brew.sh) is installed, then run:
```bash
# Install Command Line Tools, Git, Python, Node, and Rust
xcode-select --install
brew install git python@3.11 node rust
```

---

## 📥 Installation Guide (From GitHub)

### 1. Clone the Repository
Open PowerShell, Terminal, or Command Prompt:
```bash
git clone https://github.com/ali-zafar-awan/NexusBond.git
cd NexusBond
```

---

### 2. Windows Installation (10 / 11)

#### Step A: Install Python Dependencies
```powershell
python -m pip install --upgrade pip
pip install -r core_engine/requirements.txt
```

#### Step B: Install UI Dependencies & Build Frontend
```powershell
cd ui
npm install
npm run build
cd ..
```

#### Step C: (Optional) Compile Native Rust Crates
If you want to build and test the native high-performance Rust core:
```powershell
cargo test --workspace
cargo build --release --workspace
```

---

### 3. Linux Installation (Ubuntu / Debian / Arch / Fedora)

#### Step A: Set Up Python Virtual Environment
```bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r core_engine/requirements.txt
```

#### Step B: Install UI Dependencies & Build
```bash
cd ui
npm install
npm run build
cd ..
```

#### Step C: (Optional) Compile Rust Crates
```bash
cargo test --workspace
cargo build --release --workspace
```

---

### 4. macOS Installation

#### Step A: Set Up Python Virtual Environment
```bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r core_engine/requirements.txt
```

#### Step B: Install UI Dependencies & Build
```bash
cd ui
npm install
npm run build
cd ..
```

---

## ⚡ Quick Start & Stop Guide (All Operating Systems)

### 🪟 Windows (1-Click Auto-Bonding)
- **Start Everything:** Double-click [`scripts/start-all.bat`](file:///d:/NexusBond/scripts/start-all.bat) or run `scripts\start-all.bat`.
  - *Starts Engine + UI + Automatically enables Windows System Proxy (`127.0.0.1:8080`).*
- **Stop Everything:** Double-click [`scripts/stop-all.bat`](file:///d:/NexusBond/scripts/stop-all.bat) or run `scripts\stop-all.bat`.
  - *Stops all processes + Automatically restores direct internet routing.*
- **Manual Proxy Toggles:** [`scripts/enable-windows-proxy.bat`](file:///d:/NexusBond/scripts/enable-windows-proxy.bat) and [`scripts/disable-windows-proxy.bat`](file:///d:/NexusBond/scripts/disable-windows-proxy.bat).

---

### 🐧 Linux & 🍏 macOS (1-Click Auto-Bonding)
- **Start Everything:** Run `./scripts/start-all.sh`:
  ```bash
  chmod +x scripts/*.sh
  ./scripts/start-all.sh
  ```
  - *Starts Engine + UI + Automatically configures GNOME (`gsettings`) on Linux or `networksetup` on macOS (`127.0.0.1:8080`)!*
- **Stop Everything:** Run `./scripts/stop-all.sh` *(or press `Ctrl + C` in the launcher)*:
  ```bash
  ./scripts/stop-all.sh
  ```
  - *Stops all processes + Automatically disables system proxy and restores direct connection.*
- **Manual Toggles:**
  - Linux: `./scripts/enable-linux-proxy.sh` and `./scripts/disable-linux-proxy.sh`
  - macOS: `./scripts/enable-macos-proxy.sh` and `./scripts/disable-macos-proxy.sh`

---

### 🌐 Verified Service Endpoints (All Platforms)
- **Dashboard UI**: [**http://localhost:5173**](http://localhost:5173) *(or http://127.0.0.1:5173)*
- **Control API & Live Metrics**: `http://127.0.0.1:5000`
- **SOCKS5 Multi-WAN Proxy**: `127.0.0.1:1080`
- **HTTP/HTTPS Proxy**: `127.0.0.1:8080`


---

## 🌐 How to Route Windows, Laptops & Browsers

To ensure all applications use your bonded bandwidth:

### 💻 Method 1: 1-Click Windows System Proxy (Recommended)
- **Turn On:** Double-click [`scripts/enable-windows-proxy.bat`](file:///d:/NexusBond/scripts/enable-windows-proxy.bat)
- **Turn Off:** Double-click [`scripts/disable-windows-proxy.bat`](file:///d:/NexusBond/scripts/disable-windows-proxy.bat)

### 🖥️ Method 2: Windows Manual GUI Configuration (Win 10 & 11)
1. Open **Windows Settings** (`Win + I`) ➔ **Network & Internet** ➔ **Proxy**.
2. Under **Manual proxy setup**, click **Set up** on *Use a proxy server*.
3. Turn **Use a proxy server** to **ON**.
4. Set **Proxy IP address**: `127.0.0.1` and **Port**: `8080`.
5. Check *"Don't use the proxy server for local (intranet) addresses"* and click **Save**.

### 🌍 Method 3: Web Browsers (Chrome, Edge, Firefox, Brave)
- **Chrome / Edge / Brave:** Automatically follow Windows System Proxy settings.
- **Mozilla Firefox:**
  1. Go to **Settings** ➔ Search **Network Settings** ➔ Click **Settings...**
  2. Choose **Manual proxy configuration**.
  3. Set **SOCKS Host**: `127.0.0.1`, **Port**: `1080`, Type: `SOCKS v5`.
  4. Check **Proxy DNS when using SOCKS v5** ➔ Click **OK**.

### 🚀 Method 4: Download Accelerators (IDM & Torrents)
- **Internet Download Manager (IDM):**
  1. Go to **Options** ➔ **Proxy / Socks** tab ➔ Check **Use SOCKS** ➔ Server: `127.0.0.1`, Port: `1080`.
  2. In the **Connection** tab, set *Connection Type/Speed* to **High Speed** and set *Max Connection Number* to **16 or 32**. IDM will split downloads into 32 simultaneous parts striped across all your bonded adapters!
- **qBittorrent:** *Tools > Options > Connection > Proxy Server* ➔ Type: `SOCKS5`, Host: `127.0.0.1`, Port: `1080`.

### 💻 Method 5: Terminal / Developer Environment (cURL, Git, Python)
```powershell
$env:ALL_PROXY = "socks5://127.0.0.1:1080"
$env:HTTP_PROXY = "http://127.0.0.1:8080"
$env:HTTPS_PROXY = "http://127.0.0.1:8080"
```

---

## 📖 Detailed UI Feature Guide

The NexusBond Control Center is divided into an intuitive top navigation bar, quick-action modals, and 5 dedicated operational tabs:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  🌐 NexusBond v2.0   [ Mode: Auto ▾ ]   [ Kill Switch: OFF ]   [ Speed Test ]  [ Setup ] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  [ 📊 Overview ]  [ 🔌 Adapters ]  [ 🌐 Relays ]  [ 🛡️ Diagnostics ]  [ 📜 Audit Logs ]  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1. 🧭 Top Navigation & Global Controls
- **`Mode Selector`**: Toggle between `Auto`, `Mode A (Local Smart Dispatch)`, `Mode B (VPS Relay Tunnel)`, and `Mode C (Redundant Failover)`.
- **`Kill Switch`**: 1-click protection that instantly blocks all direct, unbonded internet access to prevent IP/DNS leaks during link drops.
- **`Speed Test`**: Real simultaneous multi-socket download benchmark across all active adapters with **zero simulated numbers**.
- **`Setup Wizard`**: 3-step onboarding for detecting connected adapters, calibrating pings, and selecting bonding profiles.
- **`Settings`**: Configure proxy ports, Forward Error Correction (FEC), and parallel DNS racing servers.

### 2. 📊 Tab 1: Overview Dashboard
- **Aggregated Speedometer**: Live total download (**Rx**) and upload (**Tx**) throughput across all combined links in Mbps.
- **Multi-Series Traffic Graph**: Real-time SVG timeline chart showing individual adapter throughput curves and total aggregated speed.
- **Active Physical Adapters Cards**: Real-time cards showing dynamic WRR weights, ping latency (EWMA), packet loss %, and instant on/off toggles.

### 3. 🔌 Tab 2: Network Interface Management
- **Custom Friendly Aliases**: Rename adapters (e.g. *"Home Fiber 100M"*, *"Mobile 5G Tether"*).
- **Priority Tiering (1 to 5)**: Assign primary vs. secondary overflow interfaces.
- **Backup Only (Standby Mode)**: Keeps cellular links idle to conserve mobile data until primary connections fail.
- **Monthly Data Cap & Metered Limits**: Enforce cellular data quotas in Megabytes (MB).

### 4. 🌐 Tab 3: Mode B VPS Relay Manager
- **Add Custom VPS Relays**: Configure host, port (`51820`), and Noise_IK public keys.
- **Live Ping Latency Test**: One-click socket latency probe to test VPS connectivity.
- **Active Relay Selection**: Select which remote server handles your bonded single-connection traffic.

### 5. 🛡️ Tab 4: Security & Diagnostics
- **DNS Leak Protection**: Verifies DNS queries do not bypass NexusBond to ISP default resolvers.
- **IPv6 Leak Protection**: Ensures unbonded IPv6 traffic does not expose your real IP.
- **Shared Upstream / Subnet Collision Detector**: Detects if two connected adapters share the same gateway router.

### 6. 📜 Tab 5: Real-Time Audit Logs
- Continuous audit trail of hot-plug detections, sub-second failovers, stream migrations, and link health alerts.

---

## ⚙️ Operational Modes

| Mode | Target Use Case | VPS Server Required? | Single-Stream Bonding? | Multi-Stream Bonding? |
| :--- | :--- | :--- | :--- | :--- |
| **Mode A: Smart Dispatch** | Web browsing, multi-tab video, game updates, downloads | **No (100% Local)** | No (capped at fastest link) | **Yes (Full sum of all links)** |
| **Mode B: Bonding Tunnel** | Single-connection speed tests, single TCP streams, live broadcast | **Optional (Free Self-Hosted)** | **Yes (e.g. 50 + 50 = 100 Mbps)** | **Yes (Full sum of all links)** |
| **Mode C: Redundancy** | Low-latency competitive gaming, live VoIP / Discord | **No / Optional** | Packet duplication | Zero packet loss |

---

## 🧪 Developer & Testing Guide

### Run Rust Workspace Unit & Fuzz Tests
```powershell
cargo test --workspace
```

### Run Python Core Engine Regression Tests
```powershell
python -m pytest -v
```

### Build Production Web UI Bundle
```powershell
cd ui
npm run build
```

---

## 📄 License & Repository

- **Repository:** [https://github.com/ali-zafar-awan/NexusBond](https://github.com/ali-zafar-awan/NexusBond)
- **License:** [MIT License](https://opensource.org/licenses/MIT) - 100% Free, Open Source, and Zero Telemetry.
- **Git Publishing Guidelines:** [**`git.md`**](file:///d:/NexusBond/git.md) - Rules for what to push vs. exclude on GitHub.
