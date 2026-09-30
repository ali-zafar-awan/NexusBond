@echo off
title NexusBond Dashboard UI
echo ============================================================
echo             NEXUSBOND CONTROL CENTER DASHBOARD
echo ============================================================
cd /d "%~dp0\..\ui"
npm run dev
pause
