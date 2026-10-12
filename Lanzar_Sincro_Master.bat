@echo off
chcp 65001 >nul
title SIFU MASTER SYNC - GIRONA v5.0 (ACTIVO)
color 0B
cd /d "%~dp0"

echo ========================================================
echo   SIFU INTELLIGENCE - AUTOGUARDADO EN TIEMPO REAL v5.0
echo ========================================================
echo.
echo Iniciando motor de sincronizacion instantanea...
echo.

where python >nul 2>nul
if %errorlevel% equ 0 (
    python "watch_excel.py"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File ".\watch_excel.ps1"
)

if %errorlevel% neq 0 (
    echo.
    echo ERROR al ejecutar el sincronizador.
    pause
)
