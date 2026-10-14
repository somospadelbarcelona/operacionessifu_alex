@echo off
setlocal enabledelayedexpansion
title SIFU GIRONA - SISTEMA INTEGRAL
cd /d "%~dp0"

set "PYCMD=python"
where python >nul 2>nul
if !errorlevel! neq 0 (
    if exist "%LOCALAPPDATA%\Microsoft\WindowsApps\python.exe" (
        set "PYCMD=%LOCALAPPDATA%\Microsoft\WindowsApps\python.exe"
    )
)

netstat -ano | findstr :5005 >nul 2>nul
if !errorlevel! neq 0 (
    start "" /min "!PYCMD!" "supervisor_bridge.py"
)

start "" "index.html"
exit /b 0
