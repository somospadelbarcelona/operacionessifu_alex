@echo off
chcp 65001 >nul
title SERVIDOR EN VIVO DE FICHAJES - SIFU GIRONA (PUERTO 5006)
color 0B
cd /d "%~dp0"

echo ========================================================
echo   SERVIDOR LIVE Y CENTINELA EN TIEMPO REAL - SIFU GIRONA
echo   Puerto: 5006
echo   Streaming SSE en directo + Auto-sincronizacion cada 15 min
echo ========================================================
echo.

set "PYCMD=python"
where python >nul 2>nul
if %errorlevel% neq 0 (
    if exist "%LOCALAPPDATA%\Microsoft\WindowsApps\python.exe" (
        set "PYCMD=%LOCALAPPDATA%\Microsoft\WindowsApps\python.exe"
    ) else (
        echo [ERROR] No se ha encontrado Python en el sistema.
        pause
        exit /b 1
    )
)

echo Abriendo panel web en el navegador por defecto...
start http://localhost:5006/index.html

echo.
echo Iniciando servidor en http://localhost:5006 ...
"%PYCMD%" "fichajes_live_server.py"

pause
