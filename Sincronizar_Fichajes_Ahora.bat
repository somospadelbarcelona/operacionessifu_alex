@echo off
chcp 65001 >nul
title SINCRONIZADOR DIRECTO DE FICHAJES - SIFU GIRONA v2.0
color 0A
cd /d "%~dp0"

echo ========================================================
echo   SINCRONIZACION DIRECTA DE FICHAJES EN VIVO (APP GCALIDAD)
echo   SIFU Girona - Motor v2.0 con Aislamiento Total por DNI
echo ========================================================
echo.

set "PYCMD=python"
where python >nul 2>nul
if %errorlevel% equ 0 goto :python_found

if exist "%LOCALAPPDATA%\Microsoft\WindowsApps\python.exe" (
    set "PYCMD=%LOCALAPPDATA%\Microsoft\WindowsApps\python.exe"
    goto :python_found
)

echo [ERROR] No se ha encontrado Python en el sistema.
echo Por favor, comprueba que Python este instalado y en el PATH.
echo.
pause
exit /b 1

:python_found
echo Conectando con https://gruposifuapp.gcalidad.com/ ...
echo Sincronizando fichajes del censo maestro de Girona...
echo.

"%PYCMD%" "fichajes_sync_gcalidad_app.py"

if %errorlevel% neq 0 goto :sync_error

echo.
echo ========================================================
echo   [EXITO] Fichajes sincronizados correctamente - Schema v2
echo   Abre o actualiza index.html para ver los datos frescos.
echo ========================================================
goto :final

:sync_error
echo.
echo ========================================================
echo   [ERROR] Ocurrio una incidencia durante la extraccion de fichajes.
echo ========================================================

:final
echo.
pause
