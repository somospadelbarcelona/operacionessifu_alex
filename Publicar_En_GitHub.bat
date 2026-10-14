@echo off
chcp 65001 >nul
title PUBLICAR FICHAJES EN GITHUB (OPERACIONES SIFU GIRONA)
color 0B
cd /d "%~dp0"

echo ========================================================
echo   PUBLICACION DIRECTA A GITHUB Y GITHUB PAGES
echo   Repositorio: somospadelbarcelona/operacionessifu_alex
echo   Web: https://somospadelbarcelona.github.io/operacionessifu_alex/
echo ========================================================
echo.

echo Enviando los cambios del super motor v2 a GitHub...
git push origin main

echo.
if %errorlevel% equ 0 (
    echo ========================================================
    echo   [EXITO TOTAL] Cambios subidos correctamente a GitHub.
    echo   GitHub Actions se ejecutara solo en la nube cada 30 min.
    echo   Tu web actualizada estara disponible en breve en:
    echo   https://somospadelbarcelona.github.io/operacionessifu_alex/
    echo ========================================================
) else (
    echo ========================================================
    echo   [AVISO] Si se ha abierto una ventana de GitHub en tu navegador,
    echo   inicia sesion con tu cuenta "Somospadelbarcelona" para autorizar.
    echo   Despues vuelve a ejecutar este archivo.
    echo ========================================================
)

echo.
pause
