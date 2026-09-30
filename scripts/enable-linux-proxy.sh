#!/usr/bin/env bash
# Standalone script to enable Linux GNOME system-wide proxy
if command -v gsettings &>/dev/null; then
    gsettings set org.gnome.system.proxy mode 'manual'
    gsettings set org.gnome.system.proxy.http host '127.0.0.1'
    gsettings set org.gnome.system.proxy.http port 8080
    gsettings set org.gnome.system.proxy.https host '127.0.0.1'
    gsettings set org.gnome.system.proxy.https port 8080
    gsettings set org.gnome.system.proxy.socks host '127.0.0.1'
    gsettings set org.gnome.system.proxy.socks port 1080
    echo "[SUCCESS] Linux System Proxy ENABLED (127.0.0.1:8080)!"
else
    echo "Please set HTTP_PROXY=http://127.0.0.1:8080 in your environment."
fi
