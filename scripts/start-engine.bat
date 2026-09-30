@echo off
title NexusBond Core Engine
echo ============================================================
echo               NEXUSBOND CORE ENGINE DAEMON
echo ============================================================
cd /d "%~dp0\.."
set PYTHONPATH=%CD%
python -m core_engine.main
pause
