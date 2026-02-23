# find_all_gestin.ps1
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
            if ($prop.Value.ToString() -like "*GESTIN*") {
                $found = $true
                break
            }
        }
        if ($found) { $gestinRows += $row }
    }

    Write-Host "Encontradas $($gestinRows.Count) filas con GESTIN" -ForegroundColor Cyan
    foreach ($row in $gestinRows) {
        Write-Host "SERVICIO: [$($row.SERVICIO)]"
        Write-Host "ESTADO:   [$($row.ESTADO)]"
        Write-Host "TITULAR:  [$($row.TITULAR)]"
        Write-Host "---"
    }

}
catch {
    Write-Host "ERROR: $($_.Exception.Message)"
}
