$ErrorActionPreference = "Stop"

$root = "C:\Users\acoscolin\OneDrive - GRUPO SIFU INTEGRACION LABORAL SL\Escritorio\INFORMER SIFU"
$excelPath = Join-Path $root "PLANTILLA PEDIDO FEBRERO 2026.xlsx"
$jsPath = Join-Path $root "orders_data.js"

$tempFile = [System.IO.Path]::GetTempFileName() + ".xlsx"

try {
    Write-Host "Iniciando proceso de extracción optimizado..."
    if (-not (Test-Path $excelPath)) {
        Write-Error "El archivo '$excelPath' no existe."
    }

    Copy-Item -Path $excelPath -Destination $tempFile -Force

    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false

    $wb = $excel.Workbooks.Open($tempFile)
    $ws = $wb.Sheets.Item(1)

    # Detectar última fila REAL (no UsedRange que puede estar sucio)
    # Buscamos en la columna 1 o 2 la última celda con datos
    $lastRow = $ws.Cells.Find("*", [System.Reflection.Missing]::Value, [System.Reflection.Missing]::Value, [System.Reflection.Missing]::Value, 1, 2).Row
    
    if ($lastRow -lt 2) { $lastRow = 2 } # Mínimo headers + 1 data

    Write-Host "Última fila real detectada: $lastRow"

    # Headers (Fila 1)
    $colCount = $ws.UsedRange.Columns.Count
    if ($colCount -gt 20) { $colCount = 20 } # Safety limit column count to avoid reading infinite right

    $headers = @()
    for ($c = 1; $c -le $colCount; $c++) {
        $val = $ws.Cells.Item(1, $c).Text
        if ([string]::IsNullOrWhiteSpace($val)) { 
            # Si cabecera vacía, saltamos o ponemos default. Si hay muchas vacías seguidas, paramos columnas
            if ($c -gt 5) { break } 
            $headers += "COL_$c"
        }
        else {
            $headers += $val.Trim()
        }
    }
    $colCount = $headers.Count

    Write-Host "Columnas detectadas: $colCount ($($headers -join ', '))"

    $dataList = @()
    
    # Leer datos en bloque si es posible, pero fila a fila es más seguro para COM en Loop
    # Para optimizar, leeremos valores en Range y procesaremos array en memoria
    # Range A2:Z(LastRow)
    
    $startCell = $ws.Cells.Item(2, 1)
    $endCell = $ws.Cells.Item($lastRow, $colCount)
    $readRange = $ws.Range($startCell, $endCell)
    $values = $readRange.Value2

    # $values es un Array 2D (1-based index)
    # Rows: 1..($lastRow-1)
    # Cols: 1..$colCount
    
    $rowCount = $values.GetUpperBound(0)
    
    for ($r = 1; $r -le $rowCount; $r++) {
        $rowObj = @{}
        $hasData = $false
        
        for ($c = 1; $c -le $colCount; $c++) {
            $val = $values[$r, $c]
            
            if ($null -ne $val -and [string]$val -ne "") {
                $hasData = $true
                $rowObj[$headers[$c - 1]] = $val
            }
            else {
                $rowObj[$headers[$c - 1]] = ""
            }
        }
        
        if ($hasData) {
            $dataList += $rowObj
        }
    }

    $count = $dataList.Count
    Write-Host "Filas procesadas con datos: $count"

    # Convertir a JSON Pura (UTF8)
    $json = $dataList | ConvertTo-Json -Depth 2 -Compress
    
    # Escribir JS
    $jsContent = "const INITIAL_ORDERS_DATA = $json;"
    [System.IO.File]::WriteAllText($jsPath, $jsContent, [System.Text.Encoding]::UTF8)

    Write-Host "ÉXITO: Archivo $jsPath generado."

}
catch {
    Write-Error "ERROR FATAL: $($_.Exception.Message)"
}
finally {
    if ($wb) { $wb.Close($false); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($wb) | Out-Null }
    if ($excel) { $excel.Quit(); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null }
    [System.GC]::Collect()
    if (Test-Path $tempFile) { Remove-Item $tempFile -Force -ErrorAction SilentlyContinue }
}
