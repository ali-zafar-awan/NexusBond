#!/usr/bin/env bash
# Standalone script to enable macOS system-wide proxy
SERVICES=$(networksetup -listallnetworkservices | grep -v '*' | grep -E 'Wi-Fi|Ethernet|LAN')
while IFS= read -r service; do
    if [ -n "$service" ]; then
        networksetup -setwebproxy "$service" 127.0.0.1 8080 2>/dev/null
        networksetup -setsecurewebproxy "$service" 127.0.0.1 8080 2>/dev/null
        networksetup -setsocksfirewallproxy "$service" 127.0.0.1 1080 2>/dev/null
    fi
done <<< "$SERVICES"
echo "[SUCCESS] macOS System Proxy ENABLED (127.0.0.1:8080)!"
