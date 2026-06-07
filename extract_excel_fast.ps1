# SIFU ULTRA-FAST EXTRACTOR v4.2
$ErrorActionPreference = "Stop"

$baseDir = $PSScriptRoot
$excelPath = Join-Path $baseDir "MASTER GENERAL.xlsx"
$jsPath = Join-Path $baseDir "master_data.js"
$tempCsv = Join-Path $baseDir "temp_master.csv"

$excel = $null
$wb = $null
$ws = $null

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
    Write-Host " Guardado temporal..." -NoNewline
}
catch {
    Write-Host " ERROR al leer Excel: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    # Liberar recursos COM de manera robusta
    if ($null -ne $ws) {
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($ws) | Out-Null
        $ws = $null
    }
    if ($null -ne $wb) {
        try { $wb.Close($false) } catch {}
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($wb) | Out-Null
        $wb = $null
    }
    if ($null -ne $excel) {
        try { $excel.Quit() } catch {}
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
        $excel = $null
    }
    # Forzar la recolección de basura para limpiar el proceso excel.exe de memoria
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}

# Procesamiento de datos (fuera del bloque de Excel COM)
try {
    Write-Host " Procesando datos..." -NoNewline

    if (-not (Test-Path $tempCsv)) {
        throw "No se encontró el archivo temporal CSV para procesar."
    }

    # Leer todas las líneas del CSV temporal para normalizar cabeceras
    $lines = Get-Content $tempCsv -Encoding Default
    $delimiter = ","
    if ($lines.Count -gt 0) {
        $headerLine = $lines[0]
        $delimiter = if ($headerLine -match ";") { ";" } else { "," }
        $headers = $headerLine -split $delimiter

        # Normalizar cabeceras vacías o duplicadas
        $seen = @{}
        $newHeaders = @()
        for ($i = 0; $i -lt $headers.Count; $i++) {
            $h = $headers[$i].Replace('"', '').Trim()
            if ([string]::IsNullOrWhiteSpace($h)) {
                $h = "Columna$($i + 1)"
            }
            
            $hUpper = $h.ToUpper()
            if ($seen.ContainsKey($hUpper)) {
                $count = $seen[$hUpper]
                $newH = "$h$count"
                $seen[$hUpper] = $count + 1
                $h = $newH
            } else {
                $seen[$hUpper] = 1
            }
            $newHeaders += """$h"""
        }

        # Reconstruir cabecera y reescribir archivo temporal
        $lines[0] = $newHeaders -join $delimiter
        [System.IO.File]::WriteAllLines($tempCsv, $lines, [System.Text.Encoding]::Default)
    }

    $data = Import-Csv $tempCsv -Delimiter $delimiter -Encoding Default
    $json = $data | ConvertTo-Json -Depth 5 -Compress

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $finalContent = "// Ultima actualizacion: $timestamp`r`nwindow.MASTER_DATA_TIMESTAMP = '$timestamp';`r`nwindow.INITIAL_MASTER_DATA = $json;"

    [System.IO.File]::WriteAllText($jsPath, $finalContent, [System.Text.Encoding]::UTF8)
    Write-Host " OK ($($data.Count) filas)" -ForegroundColor Green

    # Intentar enviar datos al backend
    try {
        Write-Host " Sincronizando con base de datos..." -NoNewline
        $uri = "http://localhost:3000/api/services/sync"
        $apiKey = "sifu_informer_jwt_key_2026_secure_hash_token_string_key" # JWT_SECRET
        $body = @{ services = $data } | ConvertTo-Json -Depth 5 -Compress
        $headers = @{
            "Content-Type" = "application/json"
            "x-api-key" = $apiKey
        }
        $response = Invoke-RestMethod -Uri $uri -Method Post -Body $body -Headers $headers -TimeoutSec 5
        Write-Host " BD OK" -ForegroundColor Green
    }
    catch {
        Write-Host " BD OFFLINE (Datos guardados localmente)" -ForegroundColor Yellow
    }
}
catch {
    Write-Host " ERROR de procesamiento: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    if (Test-Path $tempCsv) { Remove-Item $tempCsv -Force }
}
