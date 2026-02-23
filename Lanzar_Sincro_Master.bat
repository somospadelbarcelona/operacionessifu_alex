@echo off
chcp 65001 >nul
title SIFU MASTER SYNC - ACTIVO
echo ========================================================
echo   SIFU INTELLIGENCE - MASTER SYNC SYSTEM v4.1
echo ========================================================
echo.
echo Iniciando motor de vigilancia...
echo.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\watch_excel.ps1"
if %errorlevel% neq 0 (
    echo.
    echo ERROR: No se pudo iniciar el monitor.
    echo Asegurate de que watch_excel.ps1 existe y tienes permisos.
    pause
)
