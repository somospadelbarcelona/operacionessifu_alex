@echo off
chcp 65001 >nul
title PUENTE DE SINCRONIZACIÓN EN VIVO - SIFU GIRONA (PUERTO 5005)
color 0B
cd /d "%~dp0"

echo ========================================================
echo   PUENTE DE SINCRONIZACIÓN EN TIEMPO REAL - SIFU GIRONA
echo   Permite sincronizar Fichajes y ERP desde el Dashboard
echo ========================================================
echo.

set "PYCMD=python"
where python >nul 2>nul
if %errorlevel% neq 0 (
    if exist "%LOCALAPPDATA%\Microsoft\WindowsApps\python.exe" (
        set "PYCMD=%LOCALAPPDATA%\Microsoft\WindowsApps\python.exe"
    ) else (
        echo [ERROR] No se ha encontrado Python en el sistema.
        echo Por favor, comprueba que Python est instalado y en el PATH.
        echo.
        pause
        exit /b 1
    )
)

netstat -ano | findstr :5005 >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] El servidor puente ya está activo en el puerto 5005.
    echo Puedes hacer clic en "Sincronizar en Vivo" en el Dashboard.
    echo.
    timeout /t 5 >nul
    exit /b 0
)

echo [OK] Iniciando Servidor Puente en http://127.0.0.1:5005...
echo Puedes dejar esta ventana minimizada mientras trabajas.
echo Mientras esté abierta, el botón de sincronización funcionará en directo.
echo.
"%PYCMD%" "supervisor_bridge.py"

if %errorlevel% neq 0 (
    echo.
    echo [AVISO] El servidor puente se ha cerrado.
    pause
)
