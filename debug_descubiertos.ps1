# Verifica deduplicacion - SIFU INFORMER
$ErrorActionPreference = 'Stop'
$jsPath = Join-Path $PSScriptRoot "master_data.js"

$raw = Get-Content $jsPath -Raw -Encoding UTF8
$jsonStart = $raw.IndexOf('[')
$jsonEnd = $raw.LastIndexOf(']')
$json = $raw.Substring($jsonStart, $jsonEnd - $jsonStart + 1)
$data = $json | ConvertFrom-Json

Write-Host "=== SIFU DEBUG: DESCUBIERTOS (con deduplicacion por SERVICIO) ===" -ForegroundColor Cyan

$props = $data[0].PSObject.Properties.Name
$kEstado = ($props | Where-Object { $_.ToUpper().Trim() -eq 'ESTADO' }   | Select-Object -First 1)
$kTitular = ($props | Where-Object { $_.ToUpper().Trim() -eq 'TITULAR' }  | Select-Object -First 1)
$kServicio = ($props | Where-Object { $_.ToUpper() -like '*SERVICIO*' }    | Select-Object -First 1)

if (-not $kEstado) { $kEstado = 'ESTADO' }
if (-not $kTitular) { $kTitular = 'TITULAR' }
if (-not $kServicio) { $kServicio = 'SERVICIO' }

$seenServices = @{}
$count = 0
$skipped = 0

foreach ($row in $data) {
    $servicioVal = if ($row.$kServicio) { $row.$kServicio.ToString().Trim() } else { '' }
    $estadoVal = if ($row.$kEstado) { $row.$kEstado.ToString().ToUpper().Trim() }  else { '' }
    $titularVal = if ($row.$kTitular) { $row.$kTitular.ToString().ToUpper().Trim() } else { '' }

    if (-not $servicioVal) { continue }

    $isSpecial = ($estadoVal -match 'BRIGADA|OBRAS|CERRADO') -or ($titularVal -match 'RUTA CRISTALES')
    $isDesc = (
        $estadoVal -match 'DESCUBIERTO|VACANTE|SIN ASIGNAR' -or
        $titularVal -match 'SIN TITULAR|DESCUBIERTO|VACANTE'
    ) -and (-not $isSpecial)

    if (-not $isDesc) { continue }

    $srvKey = $servicioVal.ToUpper()
    if ($seenServices.ContainsKey($srvKey)) {
        $skipped++
        Write-Host "  [SKIP-DUPLICADO] '$servicioVal'" -ForegroundColor DarkYellow
        continue
    }

    $seenServices[$srvKey] = $true
    $count++
    Write-Host "  [$count] '$servicioVal' - ESTADO='$estadoVal'" -ForegroundColor Red
}

Write-Host ""
Write-Host "TOTAL SERVICIOS DESCUBIERTOS (unicos): $count" -ForegroundColor Green
Write-Host "Filas duplicadas ignoradas: $skipped" -ForegroundColor DarkYellow
Write-Host ""
if ($count -le 8) {
    Write-Host "✅ CORRECTO - Coincide con el Excel" -ForegroundColor Green
}
else {
    Write-Host "⚠️  Hay mas de 8 - revisa si algunos son servicios Que tienen varios turnos (distintos horarios)" -ForegroundColor Yellow
}
