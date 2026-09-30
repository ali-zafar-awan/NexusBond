#!/usr/bin/env bash
# NexusBond 1-Click Shutdown for Linux & macOS
# Stops Core Engine + UI + Automatically disables OS System Proxy

echo "============================================================"
echo "          STOPPING NEXUSBOND ALL-IN-ONE (UNIX)"
echo "============================================================"

# 1. Kill Engine & UI processes
echo "[1/3] Terminating NexusBond Engine processes (ports 5000, 1080, 8080)..."
fuser -k 5000/tcp 2>/dev/null || pkill -f "core_engine.main" 2>/dev/null
fuser -k 1080/tcp 2>/dev/null
fuser -k 8080/tcp 2>/dev/null

echo "[2/3] Terminating NexusBond UI Web Server (port 5173)..."
fuser -k 5173/tcp 2>/dev/null || pkill -f "vite" 2>/dev/null

# 2. Disable OS System Proxy
echo "[3/3] Automatically disabling OS System-Wide Proxy..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS: Disable proxy on active network interfaces
    SERVICES=$(networksetup -listallnetworkservices | grep -v '*' | grep -E 'Wi-Fi|Ethernet|LAN')
    while IFS= read -r service; do
        if [ -n "$service" ]; then
            networksetup -setwebproxystate "$service" off 2>/dev/null
            networksetup -setsecurewebproxystate "$service" off 2>/dev/null
            networksetup -setsocksfirewallproxystate "$service" off 2>/dev/null
        fi
    done <<< "$SERVICES"
    echo "[SUCCESS] macOS System Proxy is now DISABLED (Direct connection restored)!"
elif command -v gsettings &>/dev/null; then
    # Linux GNOME
    gsettings set org.gnome.system.proxy mode 'none'
    echo "[SUCCESS] Linux GNOME System Proxy is now DISABLED (Direct connection restored)!"
fi

echo ""
echo "============================================================"
echo "   NEXUSBOND STOPPED & SYSTEM PROXY IS AUTO-DISABLED!"
echo "============================================================"
