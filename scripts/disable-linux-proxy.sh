#!/usr/bin/env bash
# Standalone script to disable Linux GNOME system-wide proxy
if command -v gsettings &>/dev/null; then
    gsettings set org.gnome.system.proxy mode 'none'
    echo "[SUCCESS] Linux System Proxy DISABLED (Direct routing restored)!"
fi
