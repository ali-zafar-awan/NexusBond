@echo off
title NexusBond Shutdown
echo ============================================================
echo                STOPPING NEXUSBOND ALL-IN-ONE
echo ============================================================
echo [1/4] Terminating NexusBond Engine processes (ports 5000, 1080, 8080)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000.*LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":1080.*LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080.*LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [2/4] Terminating NexusBond UI Web Server (port 5173)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173.*LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [3/4] Automatically disabling Windows System-Wide Proxy...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f >nul

echo [4/4] Restoring Windows default routing metrics...
powershell -Command "Get-NetIPInterface | Where-Object { $_.InterfaceMetric -ne $null } | ForEach-Object { Set-NetIPInterface -InterfaceIndex $_.InterfaceIndex -AutomaticMetric Enabled -ErrorAction SilentlyContinue }" >nul 2>&1

echo.
echo ============================================================
echo    NEXUSBOND STOPPED ^& WINDOWS PROXY IS AUTO-DISABLED!
echo ============================================================
echo Browsers and system apps have returned to standard direct routing.
echo.
timeout /t 3
