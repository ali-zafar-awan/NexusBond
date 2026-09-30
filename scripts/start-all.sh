#!/usr/bin/env bash
# NexusBond 1-Click Launcher for Linux & macOS
# Starts Core Engine + UI + Automatically configures OS System Proxy

echo "============================================================"
echo "          STARTING NEXUSBOND ALL-IN-ONE (UNIX)"
echo "============================================================"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 1. Start Core Engine
echo "[1/3] Starting NexusBond Core Engine on port 5000..."
python3 -m core_engine.main &
ENGINE_PID=$!

# 2. Start UI Server
echo "[2/3] Starting NexusBond Dashboard UI on port 5173..."
(cd "$DIR/ui" && npm run dev -- --host 127.0.0.1 --port 5173) &
UI_PID=$!

# 3. Automatically Enable OS System Proxy
echo "[3/3] Automatically configuring OS System-Wide Proxy..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS: Auto-enable HTTP and SOCKS5 proxy on active Wi-Fi and Ethernet interfaces
    SERVICES=$(networksetup -listallnetworkservices | grep -v '*' | grep -E 'Wi-Fi|Ethernet|LAN')
    while IFS= read -r service; do
        if [ -n "$service" ]; then
            networksetup -setwebproxy "$service" 127.0.0.1 8080 2>/dev/null
            networksetup -setsecurewebproxy "$service" 127.0.0.1 8080 2>/dev/null
            networksetup -setsocksfirewallproxy "$service" 127.0.0.1 1080 2>/dev/null
        fi
    done <<< "$SERVICES"
    echo "[SUCCESS] macOS System Proxy is now AUTO-ENABLED (127.0.0.1:8080)!"
elif command -v gsettings &>/dev/null; then
    # Linux GNOME / Ubuntu / Debian / Fedora
    gsettings set org.gnome.system.proxy mode 'manual'
    gsettings set org.gnome.system.proxy.http host '127.0.0.1'
    gsettings set org.gnome.system.proxy.http port 8080
    gsettings set org.gnome.system.proxy.https host '127.0.0.1'
    gsettings set org.gnome.system.proxy.https port 8080
    gsettings set org.gnome.system.proxy.socks host '127.0.0.1'
    gsettings set org.gnome.system.proxy.socks port 1080
    echo "[SUCCESS] Linux GNOME System Proxy is now AUTO-ENABLED (127.0.0.1:8080)!"
fi

echo ""
echo "============================================================"
echo "  NEXUSBOND IS ACTIVE & SYSTEM PROXY IS AUTO-ENABLED!"
echo "============================================================"
echo "Dashboard UI: http://localhost:5173"
echo "Engine API:   http://127.0.0.1:5000"
echo "HTTP Proxy:   127.0.0.1:8080"
echo "SOCKS5:       127.0.0.1:1080"
echo ""
echo "When done, run ./scripts/stop-all.sh to stop and disable proxy."
echo "============================================================"

# Wait for Ctrl+C
trap 'bash "$DIR/scripts/stop-all.sh"; exit' SIGINT SIGTERM
wait
