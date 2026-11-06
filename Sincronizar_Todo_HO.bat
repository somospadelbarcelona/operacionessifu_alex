@echo off
chcp 65001 >nul
title SINCRONIZADOR MAESTRO SAP S/4HANA HO (NIVEL DIOS) - GRUPO SIFU
color 0B
cd /d "%~dp0"

echo ==============================================================================
echo   ⚡ SINCRONIZACIÓN MAESTRA SAP S/4HANA HO · NIVEL DIOS (100%% TIEMPO REAL)
echo   Responsable: ALEJANDRO COSCOLIN PEREGRIN (00062620 / 46468278)
echo   Delegación: BARCELONA (0801) - 9 Gestores Oficiales ^& Girona
echo ==============================================================================
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
echo Conectando con SAP S/4HANA (ZPS_HOPER_SRV) y ejecutando orquestador maestro...
echo.
"%PYCMD%" -c "import supervisor_bridge; res = supervisor_bridge.run_god_level_sync(gestor_id='todos', force_excel=True); print('\n=== RESUMEN EJECUTIVO ===\nStatus:', res.get('status'), '\nTiempo:', res.get('elapsed_seconds'), 's | Latencia SAP:', res.get('latency_ms'), 'ms\nTotales:', res.get('totales'))"

if %errorlevel% neq 0 goto :sync_error

echo.
echo ==============================================================================
echo   [EXITO TOTAL] SAP HO 100%% SINCRONIZADO EN TIEMPO REAL CON LA APLICACIÓN.
echo   Carteras, cuadrantes, censo, vacaciones y contratos actualizados.
echo   Abre o refresca index.html (o pulsa Ctrl+Shift+S en el navegador).
echo ==============================================================================
goto :final

:sync_error
echo.
echo ==============================================================================
echo   [AVISO] Revisa que la VPN Ivanti de SIFU esté conectada a la red corporativa.
echo ==============================================================================

:final
echo.
pause
