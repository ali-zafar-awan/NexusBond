@echo off
title Enable NexusBond Windows Proxy
echo ============================================================
echo         ENABLING NEXUSBOND WINDOWS SYSTEM-WIDE PROXY
echo ============================================================
echo Configuring Windows to route all web/browser traffic through NexusBond (127.0.0.1:8080)...

reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable /t REG_DWORD /d 1 /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyServer /t REG_SZ /d "127.0.0.1:8080" /f >nul

echo.
echo [SUCCESS] Windows System-Wide Proxy is now ENABLED!
echo All browser tabs, YouTube, Netflix, fast.com, and downloads are now bonded!
echo.
echo To disable later, double-click scripts\disable-windows-proxy.bat
echo.
pause
