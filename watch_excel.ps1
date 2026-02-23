# SIFU MASTER WATCHER v4.1 - Sin emojis para compatibilidad de encoding
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseDir = $PSScriptRoot
$excelFile = "MASTER GENERAL.xlsx"
$fullPath = Join-Path $baseDir $excelFile
$extractor = Join-Path $baseDir "extract_excel_fast.ps1"

function Show-Header {
    Clear-Host
    Write-Host "========================================================"  -ForegroundColor Cyan
    Write-Host "   SIFU INTELLIGENCE - MASTER SYNC SYSTEM v4.1"           -ForegroundColor White -BackgroundColor DarkBlue
    Write-Host "========================================================"  -ForegroundColor Cyan
    Write-Host " STATUS:  " -NoNewline; Write-Host "ACTIVO Y MONITORIZANDO" -ForegroundColor Green
    Write-Host " TARGET:  " -NoNewline; Write-Host "$excelFile"             -ForegroundColor Yellow
    Write-Host " RUTA:    $baseDir"
    Write-Host "========================================================"
    Write-Host " [SISTEMA EN PILOTO AUTOMATICO - NO CERRAR ESTA VENTANA]"
    Write-Host "========================================================"
    Write-Host ""
}

Show-Header

# Verificar que el archivo Excel existe
if (-not (Test-Path $fullPath)) {
    Write-Host "[ERROR] No se encuentra el archivo: $fullPath" -ForegroundColor Red
    Write-Host "Presiona Enter para salir..."
    Read-Host
    exit 1
}

# Primera sincronizacion al arrancar
Write-Host "[INICIO] Sincronizacion inicial..." -ForegroundColor Cyan
try {
    $result = & powershell -ExecutionPolicy Bypass -File $extractor 2>&1
    Write-Host "[INICIO] $result" -ForegroundColor Green
}
catch {
    Write-Host "[INICIO] Error en sincronizacion inicial: $_" -ForegroundColor Red
}
Write-Host "--------------------------------------------------------"

# Configurar el watcher
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $baseDir
$watcher.Filter = $excelFile
$watcher.NotifyFilter = [System.IO.NotifyFilters]::LastWrite, [System.IO.NotifyFilters]::FileName, [System.IO.NotifyFilters]::Size
$watcher.IncludeSubdirectories = $false
$watcher.EnableRaisingEvents = $true

$action = {
    $time = Get-Date -Format "HH:mm:ss"
    Write-Host "[$time] Cambio detectado. Esperando estabilidad..." -ForegroundColor Cyan

    # Esperar a que el archivo se estabilice (OneDrive / Excel necesita tiempo)
    Start-Sleep -Seconds 2

    try {
        $extPath = $Event.MessageData
        $res = & powershell -ExecutionPolicy Bypass -File $extPath 2>&1
        Write-Host "[$time] SYNC: $res" -ForegroundColor Green
    }
    catch {
        Write-Host "[$time] ERROR en sincronizacion: $_" -ForegroundColor Red
    }
    Write-Host "--------------------------------------------------------"
}

# Registrar los eventos pasando $extractor como MessageData para evitar problemas de scope
Register-ObjectEvent $watcher "Changed" -Action $action -MessageData $extractor | Out-Null
Register-ObjectEvent $watcher "Created" -Action $action -MessageData $extractor | Out-Null
Register-ObjectEvent $watcher "Renamed" -Action $action -MessageData $extractor | Out-Null

Write-Host "[OK] Watcher activo. Guardando cambios en el Excel..." -ForegroundColor Green
Write-Host ""

# Mantener el proceso vivo
while ($true) {
    Start-Sleep -Seconds 5
}
