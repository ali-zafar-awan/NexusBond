@echo off
title NexusBond Launcher
echo ============================================================
echo               STARTING NEXUSBOND ALL-IN-ONE
echo ============================================================
echo [1/2] Starting NexusBond Core Engine on port 5000...
start "NexusBond Engine" cmd /k "%~dp0start-engine.bat"

echo [2/2] Starting NexusBond Dashboard UI on port 5173...
start "NexusBond UI" cmd /k "%~dp0start-ui.bat"

echo.
echo All subsystems started!
echo Engine API: http://127.0.0.1:5000
echo Dashboard:  http://localhost:5173
echo SOCKS5:     127.0.0.1:1080
echo HTTP:       127.0.0.1:8080
echo.
pause
