@echo off
setlocal enabledelayedexpansion
title SIFU GIRONA - SISTEMA INTEGRAL EN TIEMPO REAL
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
    timeout /t 1 /nobreak >nul
)

netstat -ano | findstr :5006 >nul 2>nul
if !errorlevel! neq 0 (
    start "" /min "!PYCMD!" "fichajes_live_server.py"
    timeout /t 1 /nobreak >nul
)

start http://localhost:5006/index.html
exit /b 0
