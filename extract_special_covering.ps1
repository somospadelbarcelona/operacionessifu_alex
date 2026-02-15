$ErrorActionPreference = "Stop"

$excelPath = "C:\Users\acoscolin\OneDrive - GRUPO SIFU INTEGRACION LABORAL SL\Escritorio\SEGUIMIENTO DESCUBIERTOS\SEGUIMIENTO DESCUBIERTOS TRAB-RUTA.xlsx"
$jsPath = "C:\Users\acoscolin\OneDrive - GRUPO SIFU INTEGRACION LABORAL SL\Escritorio\INFORMER SIFU\special_covering_data.js"

$tempFile = [System.IO.Path]::GetTempFileName() + ".xlsx"

try {
    Copy-Item -Path $excelPath -Destination $tempFile -Force
    
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    
    $wb = $excel.Workbooks.Open($tempFile)
    
    # 1. Extract TRABAJADORES
    $wsW = $wb.Sheets.Item("TRABAJADORES")
    $rangeW = $wsW.UsedRange
    $dataW = $rangeW.Value2
    $rowsW = $rangeW.Rows.Count
    
    $specialWorkers = @()
    for ($r = 2; $r -le $rowsW; $r++) {
        $name = $dataW[$r, 2]
        $type = $dataW[$r, 5]
        $status = $dataW[$r, 7]
        
        if ($null -ne $name -and $status -eq "ACTIVO") {
            $specialWorkers += @{
                name  = $name.ToString().Trim()
                type  = $type.ToString().Trim().ToUpper()
                order = if ($type -like "*EMERGENCIA*") { 1 } else { 2 }
            }
        }
    }
    
    # 2. Extract SEGUIMIENTO (Uncovered next day)
    $wsS = $wb.Sheets.Item("SEGUIMIENTO")
    $rangeS = $wsS.UsedRange
    $dataS = $rangeS.Value2
    $rowsS = $rangeS.Rows.Count
    
    $specialUncovered = @()
    for ($r = 2; $r -le $rowsS; $r++) {
        $center = $dataS[$r, 1]
        $status = $dataS[$r, 3]
        if ($null -ne $center -and $status -eq "DESCUBIERTO") {
            $specialUncovered += @{
                center = $center.ToString().Trim()
                status = "DESCUBIERTO"
                source = "ESPECIAL"
            }
        }
    }
    
    $jsonW = $specialWorkers | ConvertTo-Json -Depth 2 -Compress
    $jsonU = $specialUncovered | ConvertTo-Json -Depth 2 -Compress
    
    $finalContent = @"
// AUTO-GENERATED SPECIAL COVERING DATA
const SPECIAL_WORKERS = $jsonW;
const SPECIAL_UNCOVERED = $jsonU;
"@
    
    [System.IO.File]::WriteAllText($jsPath, $finalContent, [System.Text.Encoding]::UTF8)
    Write-Host "SUCCESS: special_covering_data.js updated."

}
catch {
    Write-Error "ERROR: $($_.Exception.Message)"
}
finally {
    if ($wb) { $wb.Close($false); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($wb) | Out-Null }
    if ($excel) { $excel.Quit(); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null }
    if (Test-Path $tempFile) { Remove-Item $tempFile -Force -ErrorAction SilentlyContinue }
}
