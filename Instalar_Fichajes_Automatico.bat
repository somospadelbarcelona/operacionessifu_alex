@echo off
chcp 65001 >nul
title INSTALADOR CENTINELA AUTONOMO DE FICHAJES - SIFU GIRONA
color 0A
cd /d "%~dp0"

echo ========================================================
echo   CONFIGURADOR DEL CENTINELA AUTONOMO DE FICHAJES
echo   SIFU Girona - Auto-ejecucion sin permisos especiales
echo ========================================================
echo.

set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS_FILE=%STARTUP_DIR%\SIFU_Girona_Fichajes_Auto.vbs"
set "SERVER_SCRIPT=%~dp0fichajes_live_server.py"

echo Configurando inicio invisible en la carpeta de Inicio del usuario...
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.Run "pythonw.exe """ ^& "%SERVER_SCRIPT%" ^& """", 0, False
) > "%VBS_FILE%"

if exist "%VBS_FILE%" (
    echo.
    echo ========================================================
    echo   [EXITO TOTAL] Centinela instalado correctamente.
    echo   Se ejecutara de forma invisible en segundo plano cada
    echo   vez que enciendas el ordenador o inicies sesion.
    echo   Sincronizara solo cada 15 min sin requerir intervencion.
    echo ========================================================
) else (
    echo [ERROR] No se pudo escribir en la carpeta de Inicio.
)

echo.
pause
