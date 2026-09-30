#!/usr/bin/env bash
# Standalone script to disable macOS system-wide proxy
SERVICES=$(networksetup -listallnetworkservices | grep -v '*' | grep -E 'Wi-Fi|Ethernet|LAN')
while IFS= read -r service; do
    if [ -n "$service" ]; then
        networksetup -setwebproxystate "$service" off 2>/dev/null
        networksetup -setsecurewebproxystate "$service" off 2>/dev/null
        networksetup -setsocksfirewallproxystate "$service" off 2>/dev/null
    fi
done <<< "$SERVICES"
echo "[SUCCESS] macOS System Proxy DISABLED (Direct routing restored)!"
