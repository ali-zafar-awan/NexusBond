@echo off
title Disable NexusBond Windows Proxy
echo ============================================================
echo         DISABLING NEXUSBOND WINDOWS SYSTEM-WIDE PROXY
echo ============================================================
echo Restoring Windows to direct internet routing...

reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f >nul

echo.
echo [SUCCESS] Windows System-Wide Proxy is now DISABLED!
echo Browsers and apps will now use standard direct connection.
echo.
pause
