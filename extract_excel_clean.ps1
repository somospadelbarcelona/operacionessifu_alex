# SIFU Excel Extractor - Version limpia sin emojis
$ErrorActionPreference = "Stop"

$baseDir = $PSScriptRoot
$excelPath = Join-Path $baseDir "MASTER GENERAL.xlsx"
$jsPath = Join-Path $baseDir "master_data.js"
$tempCsv = Join-Path $baseDir "temp_master.csv"

Write-Host "Accediendo a Excel..." -NoNewline

try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false

    # Abrir en solo lectura para no bloquear al usuario
    $wb = $excel.Workbooks.Open($excelPath, $false, $true)
    $ws = $wb.Sheets.Item(1)

    # Guardar como CSV (6 = xlCSV)
    if (Test-Path $tempCsv) { Remove-Item $tempCsv -Force }
    $ws.SaveAs($tempCsv, 6)

    $wb.Close($false)
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

    Write-Host " Procesando..." -NoNewline

    # Deteccion del delimitador (Espana usa ; normalmente)
    $firstLine = Get-Content $tempCsv -TotalCount 1 -Encoding Default
    $delimiter = if ($firstLine -match ";") { ";" } else { "," }

    $data = Import-Csv $tempCsv -Delimiter $delimiter -Encoding Default
    $json = $data | ConvertTo-Json -Depth 5 -Compress

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $finalContent = "// Ultima actualizacion: $timestamp`r`nvar MASTER_DATA_TIMESTAMP = '$timestamp';`r`nvar INITIAL_MASTER_DATA = $json;"

    [System.IO.File]::WriteAllText($jsPath, $finalContent, [System.Text.Encoding]::UTF8)

    if (Test-Path $tempCsv) { Remove-Item $tempCsv -Force }

    Write-Host " OK ($($data.Count) filas sincronizadas)" -ForegroundColor Green
    Write-Host "Archivo generado: $jsPath" -ForegroundColor Cyan

    # Mostrar cuantos descubiertos hay ahora
    $props = $data[0].PSObject.Properties.Name
    $kEstado = ($props | Where-Object { $_.ToUpper().Trim() -eq 'ESTADO' }   | Select-Object -First 1)
    $kServicio = ($props | Where-Object { $_.ToUpper() -like '*SERVICIO*' }    | Select-Object -First 1)
    if (-not $kEstado) { $kEstado = 'ESTADO' }
    if (-not $kServicio) { $kServicio = 'SERVICIO' }

    $seenSrv = @{}
    $descCount = 0
    foreach ($row in $data) {
        $srv = if ($row.$kServicio) { $row.$kServicio.ToString().Trim() } else { '' }
        $estado = if ($row.$kEstado) { $row.$kEstado.ToString().ToUpper().Trim() } else { '' }
        if (-not $srv) { continue }
        if ($estado -notmatch 'DESCUBIERTO|VACANTE|SIN ASIGNAR') { continue }
        $srvKey = $srv.ToUpper()
        if ($seenSrv.ContainsKey($srvKey)) { continue }
        $seenSrv[$srvKey] = $true
        $descCount++
    }

    Write-Host ""
    Write-Host ">>> DESCUBIERTOS ACTUALES (unicos por servicio): $descCount" -ForegroundColor Yellow

}
catch {
    Write-Host " ERROR: $($_.Exception.Message)" -ForegroundColor Red
    try {
        if ($excel) {
            $excel.Quit()
            [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
        }
    }
    catch {}
    exit 1
}
