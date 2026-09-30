@echo off
title NexusBond Launcher
echo ============================================================
echo               STARTING NEXUSBOND ALL-IN-ONE
echo ============================================================
echo [1/3] Starting NexusBond Core Engine on port 5000...
start "NexusBond Engine" cmd /k "%~dp0start-engine.bat"

echo [2/3] Starting NexusBond Dashboard UI on port 5173...
start "NexusBond UI" cmd /k "%~dp0start-ui.bat"

echo [3/3] Automatically enabling Windows System-Wide Proxy (127.0.0.1:8080)...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable /t REG_DWORD /d 1 /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyServer /t REG_SZ /d "127.0.0.1:8080" /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyOverride /t REG_SZ /d "<local>" /f >nul

echo.
echo ============================================================
echo   NEXUSBOND IS ACTIVE ^& WINDOWS PROXY IS AUTO-ENABLED!
echo ============================================================
echo.
echo Dashboard:  http://localhost:5173
echo Engine API: http://127.0.0.1:5000
echo HTTP Proxy: 127.0.0.1:8080 (Active System-Wide)
echo SOCKS5:     127.0.0.1:1080
echo.
echo All browsers (Chrome, Edge, Firefox), fast.com, and downloads
echo are now automatically bonded!
echo.
echo When done, simply run scripts\stop-all.bat to stop everything
echo and automatically turn off the proxy.
echo ============================================================
echo.
pause
