# SIFU ULTRA-FAST EXTRACTOR v4.1
$ErrorActionPreference = "Stop"

$baseDir = $PSScriptRoot
$excelPath = Join-Path $baseDir "MASTER GENERAL.xlsx"
$jsPath = Join-Path $baseDir "master_data.js"
$tempCsv = Join-Path $baseDir "temp_master.csv"

try {
    Write-Host "Accediendo a Excel..." -NoNewline
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

    Write-Host " Procesando datos..." -NoNewline

    # Deteccion automatica del delimitador (Espana usa ; normalmente)
    $firstLine = Get-Content $tempCsv -TotalCount 1 -Encoding Default
    $delimiter = if ($firstLine -match ";") { ";" } else { "," }

    $data = Import-Csv $tempCsv -Delimiter $delimiter -Encoding Default
    $json = $data | ConvertTo-Json -Depth 5 -Compress

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $finalContent = "// Ultima actualizacion: $timestamp`r`nvar MASTER_DATA_TIMESTAMP = '$timestamp';`r`nvar INITIAL_MASTER_DATA = $json;"

    [System.IO.File]::WriteAllText($jsPath, $finalContent, [System.Text.Encoding]::UTF8)

    if (Test-Path $tempCsv) { Remove-Item $tempCsv -Force }

    Write-Host " OK ($($data.Count) filas)" -ForegroundColor Green
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
