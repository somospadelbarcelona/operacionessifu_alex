$ErrorActionPreference = "Stop"

$excelPath = "C:\Users\acoscolin\OneDrive - GRUPO SIFU INTEGRACION LABORAL SL\Escritorio\INFORMER SIFU\MASTER GENERAL.xlsx"
$jsPath = "C:\Users\acoscolin\OneDrive - GRUPO SIFU INTEGRACION LABORAL SL\Escritorio\INFORMER SIFU\master_data.js"

$tempFile = [System.IO.Path]::GetTempFileName() + ".xlsx"

try {
    Copy-Item -Path $excelPath -Destination $tempFile -Force
    Write-Host "READING EXCEL..."

    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false

    $wb = $excel.Workbooks.Open($tempFile)
    $ws = $wb.Sheets.Item(1)

    $range = $ws.UsedRange
    $data = $range.Value2
    
    $rowCount = $range.Rows.Count
    $colCount = $range.Columns.Count

    Write-Host "PROCESSING ROWS: $rowCount"

    $headers = @()
    for ($c = 1; $c -le $colCount; $c++) {
        $h = $data[1, $c]
        if ([string]::IsNullOrWhiteSpace($h)) { $h = "COL_$c" }
        $headers += $h.ToString().Trim()
    }

    $jsonObjects = @()
    
    for ($r = 2; $r -le $rowCount; $r++) {
        $obj = @{}
        $hasData = $false
        
        for ($c = 1; $c -le $colCount; $c++) {
            $val = $data[$r, $c]
            if ($null -ne $val -and $val -ne "") {
                $key = $headers[$c - 1]
                $obj[$key] = $val
                $hasData = $true
            }
        }

        if ($hasData) {
            $jsonObjects += $obj
        }
    }

    $json = $jsonObjects | ConvertTo-Json -Depth 2 -Compress
    $finalContent = "const INITIAL_MASTER_DATA = $json;"
    
    [System.IO.File]::WriteAllText($jsPath, $finalContent, [System.Text.Encoding]::UTF8)

    Write-Host "DONE: master_data.js updated."

}
catch {
    Write-Error "ERROR: $($_.Exception.Message)"
}
finally {
    if ($wb) { $wb.Close($false); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($wb) | Out-Null }
    if ($excel) { $excel.Quit(); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null }
    
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()

    if (Test-Path $tempFile) { Remove-Item $tempFile -Force -ErrorAction SilentlyContinue }
}
