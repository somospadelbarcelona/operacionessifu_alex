@echo off
chcp 65001 >nul
title INSTALADOR CENTINELA AUTONOMO DE FICHAJES - SIFU GIRONA
color 0A
cd /d "%~dp0"

echo ========================================================
echo   CONFIGURADOR DEL CENTINELA AUTONOMO DE FICHAJES
echo   SIFU Girona - Auto-ejecucion sin intervencion manual
echo ========================================================
echo.

set "PYCMD=python"
where pythonw >nul 2>nul
if %errorlevel% equ 0 (
    set "PYCMD=pythonw"
) else (
    where python >nul 2>nul
    if %errorlevel% neq 0 (
        if exist "%LOCALAPPDATA%\Microsoft\WindowsApps\python.exe" (
            set "PYCMD=%LOCALAPPDATA%\Microsoft\WindowsApps\python.exe"
        )
    )
)

set "TASK_NAME=SIFU_Girona_Fichajes_Live"
set "SERVER_SCRIPT=%~dp0fichajes_live_server.py"

echo Creando tarea programada en Windows: "%TASK_NAME%"...
echo Tarea configurada para iniciar al inicio de sesion del usuario.
echo.

schtasks /create /tn "%TASK_NAME%" /tr "\"%PYCMD%\" \"%SERVER_SCRIPT%\"" /sc ONLOGON /rl LIMITED /f

if %errorlevel% equ 0 (
    echo ========================================================
    echo   [EXITO] Centinela instalado correctamente.
    echo   Se ejecutara automaticamente cada vez que inicies sesion.
    echo   El servidor sincronizara solo cada 15 min en segundo plano.
    echo ========================================================
    echo.
    echo Iniciando tarea ahora mismo...
    schtasks /run /tn "%TASK_NAME%"
) else (
    echo [AVISO] No se pudo registrar la tarea programada.
    echo Puedes ejecutar Lanzar_Fichajes_Live.bat manualmente en cualquier momento.
)

echo.
pause
