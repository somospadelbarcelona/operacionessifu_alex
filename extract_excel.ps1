$errorActionPreference = "Stop"
$originalPath = 'C:\Users\acoscolin\OneDrive - GRUPO SIFU INTEGRACION LABORAL SL\Escritorio\INFORMER SIFU\MASTER GENERAL.xlsx'
$tempPath = [System.IO.Path]::GetTempFileName() + ".xlsx"

try {
    Write-Host "Copiando archivo a temporal: $tempPath"
    Copy-Item -Path $originalPath -Destination $tempPath -Force

    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false

    $wb = $excel.Workbooks.Open($tempPath)
    $ws = $wb.Sheets.Item(1)
    
    # Get all data as 2D array (1-based)
    $allData = $ws.UsedRange.Value2
    
    $rows = $allData.GetUpperBound(0)
    $cols = $allData.GetUpperBound(1)

    Write-Host "Analizando $rows filas y $cols columnas (Fast Mode)..."

    # Get Headers (Row 1)
    $headers = @()
    for ($c = 1; $c -le $cols; $c++) {
        $h = $allData[1, $c]
        if ([string]::IsNullOrWhiteSpace($h)) { $h = "COL_$c" }
        $headers += $h
    }

    $data = @()
    # Skip header row, start from 2
    for ($r = 2; $r -le $rows; $r++) { 
        $obj = @{}
        $hasData = $false
        for ($c = 1; $c -le $cols; $c++) {
            $val = $allData[$r, $c]
            
            # Convert null to empty string
            if ($null -eq $val) { $val = "" }
            
            $header = $headers[$c - 1]
            
            # Clean header name for JSON property
            $propName = $header -replace '[^a-zA-Z0-9_]', '_'
            
            $obj[$propName] = $val
            
            if (-not [string]::IsNullOrWhiteSpace($val)) {
                $hasData = $true
            }
        }
        # Only add row if it has some data
        if ($hasData) {
            $data += $obj
        }
    }

    $wb.Close($false)
    $excel.Quit()

    $json = $data | ConvertTo-Json -Depth 2 -Compress
    $finalContent = "const INITIAL_MASTER_DATA = $json;"
    [System.IO.File]::WriteAllText('C:\Users\acoscolin\OneDrive - GRUPO SIFU INTEGRACION LABORAL SL\Escritorio\INFORMER SIFU\master_data.js', $finalContent, [System.Text.Encoding]::UTF8)

    Write-Host "✅ master_data.js actualizado con $($data.Count) registros."
}
catch {
    Write-Error "Error: $($_.Exception.Message)"
}
finally {
    if ($excel) {
        $excel.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    }
    # Clean up temp file
    if (Test-Path $tempPath) {
        Remove-Item -Path $tempPath -Force -ErrorAction SilentlyContinue
    }
}
