# debug_edag2.ps1 - Analizar POR QUE la logica JS detecta EDAG como descubierto
$baseDir = $PSScriptRoot
$jsPath = Join-Path $baseDir "master_data.js"
$content = Get-Content $jsPath -Raw -Encoding UTF8

$json = $content -replace '(?s)^.*?var INITIAL_MASTER_DATA = ', '' -replace ';\s*$', ''

try {
    $data = $json | ConvertFrom-Json

    Write-Host "=== SIMULANDO LOGICA JS DE DETECCION ===" -ForegroundColor Yellow
    Write-Host "(Misma logica que refreshMetrics y showUncoveredDetails en app.js)"
    Write-Host ""

    $descCount = 0
    $seenServices = @{}

    foreach ($row in $data) {
        $props = $row.PSObject.Properties.Name

        $kEstado = ($props | Where-Object { $_.ToUpper().Trim() -eq 'ESTADO' } | Select-Object -First 1)
        $kTitular = ($props | Where-Object { $_.ToUpper().Trim() -eq 'TITULAR' } | Select-Object -First 1)
        $kServicio = ($props | Where-Object { $_.ToUpper() -like '*SERVICIO*' } | Select-Object -First 1)

        if (-not $kEstado) { $kEstado = 'ESTADO' }
        if (-not $kTitular) { $kTitular = 'TITULAR' }
        if (-not $kServicio) { continue }

        $servVal = if ($row.$kServicio) { $row.$kServicio.ToString().Trim() } else { '' }
        if (-not $servVal) { continue }

        $statusRaw = if ($row.$kEstado) { $row.$kEstado.ToString() }  else { '' }
        $titularRaw = if ($row.$kTitular) { $row.$kTitular.ToString() } else { '' }

        $status = $statusRaw.ToUpper().Trim()
        $titular = $titularRaw.ToUpper().Trim()

        # Razones de deteccion
        $reasons = @()
        if ($status -like '*DESCUBIERTO*') { $reasons += "ESTADO contiene DESCUBIERTO" }
        if ($status -like '*VACANTE*') { $reasons += "ESTADO contiene VACANTE" }
        if ($status -like '*SIN ASIGNAR*') { $reasons += "ESTADO contiene SIN ASIGNAR" }
        if ($titular -like '*SIN TITULAR*') { $reasons += "TITULAR contiene SIN TITULAR" }
        if ($titular -like '*DESCUBIERTO*') { $reasons += "TITULAR contiene DESCUBIERTO" }
        if ($titular -like '*VACANTE*') { $reasons += "TITULAR contiene VACANTE" }
        if ($status -eq '' -and ($titular -eq '' -or $titular -eq 'SIN TITULAR')) {
            $reasons += "ESTADO vacio Y TITULAR vacio"
        }
        if ($status -eq 'PENDIENTE' -and $titular -eq '') {
            $reasons += "ESTADO=PENDIENTE Y TITULAR vacio"
        }

        if ($reasons.Count -gt 0) {
            Write-Host "!!! DETECTADO COMO DESCUBIERTO:" -ForegroundColor Red
            Write-Host "    SERVICIO: [$servVal]"
            Write-Host "    ESTADO raw:  [$statusRaw]"
            Write-Host "    TITULAR raw: [$titularRaw]"
            Write-Host "    ESTADO trim:  [$status]"
            Write-Host "    TITULAR trim: [$titular]"
            Write-Host "    RAZONES:"
            foreach ($r in $reasons) { Write-Host "      -> $r" -ForegroundColor Yellow }

            # Deduplicacion
            $srvKey = $servVal.ToUpper()
            if (-not $seenServices.ContainsKey($srvKey)) {
                $seenServices[$srvKey] = $true
                $descCount++
                Write-Host "    CUENTA como #$descCount (servicio nuevo)" -ForegroundColor Magenta
            }
            else {
                Write-Host "    IGNORADO (servicio ya contado)" -ForegroundColor DarkGray
            }
            Write-Host ""
        }
    }

    Write-Host "=== RESULTADO FINAL ===" -ForegroundColor Cyan
    Write-Host "Total DESCUBIERTOS unicos: $descCount" -ForegroundColor Green

}
catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}
