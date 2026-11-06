@echo off
echo ====================================================
echo   SIFU GIRONA - Data Server (API de Datos Local)
echo ====================================================
echo.
echo Iniciando servidor de datos en http://localhost:3001
echo Los datos se sirven comprimidos con cache inteligente
echo.

cd /d "%~dp0"

:: Intentar con Bun primero, luego Node
where bun >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo Runtime: Bun
    bun data_server.js
) else (
    where node >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        echo Runtime: Node.js
        node data_server.js
    ) else (
        echo ERROR: No se encontro Bun ni Node.js
        echo Instala Bun: https://bun.sh
        pause
    )
)

pause
