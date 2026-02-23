# debug_gestin.ps1
$baseDir = $PSScriptRoot
$jsPath = Join-Path $baseDir "master_data.js"
$content = Get-Content $jsPath -Raw -Encoding UTF8

$json = $content -replace '(?s)^.*?var INITIAL_MASTER_DATA = ', '' -replace ';\s*$', ''

try {
    $data = $json | ConvertFrom-Json
    $gestinRows = @()
    foreach ($row in $data) {
        $found = $false
        foreach ($prop in $row.PSObject.Properties) {
            if ($prop.Value -like "*GESTIN*") {
                $found = $true
                break
            }
        }
        if ($found) { $gestinRows += $row }
    }

    Write-Host "=== FILAS CON 'GESTIN' EN MASTER_DATA.JS ===" -ForegroundColor Yellow
    foreach ($row in $gestinRows) {
        Write-Host "--- FILA ---" -ForegroundColor Cyan
        foreach ($prop in $row.PSObject.Properties) {
            Write-Host "  $($prop.Name): [$($prop.Value)]"
        }
    }
    
    $timestampLine = $content -split '\r?\n' | Select-Object -First 2
    Write-Host "`nTimestamp en el archivo:" $timestampLine -ForegroundColor Magenta

}
catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}
