@echo off
chcp 65001 >nul
title SUPERVISOR VIRTUAL SIFU GIRONA - ERP HO & MASTER SYNC
color 0A
cd /d "%~dp0"

echo ========================================================
echo   🤖 SUPERVISOR VIRTUAL AUTONOMO - SIFU GIRONA
echo   Integracion en Tiempo Real con ERP HO (SAP) & Excel
echo ========================================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] No se ha encontrado Python en el sistema.
    pause
    exit /b 1
)

echo [1/3] Verificando conexion con la red corporativa e Ivanti VPN...
python "ho_vpn_helper.py"

echo.
echo [2/3] Ejecutando diagnostico y sincronizacion con ERP HO...
python "supervisor_engine.py" 2

echo.
echo [3/3] Iniciando Servidor Puente en Tiempo Real y Monitor...
start /B python "supervisor_bridge.py" >nul 2>nul
echo Para salir presiona Ctrl + C en cualquier momento.
echo.

python "watch_excel.py"

pause
