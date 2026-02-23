# debug_edag.ps1 - Inspeccionar filas de EDAG MARTORELL en master_data.js
$baseDir = $PSScriptRoot
$jsPath = Join-Path $baseDir "master_data.js"
$content = Get-Content $jsPath -Raw -Encoding UTF8

# Extraer el JSON
$json = $content -replace '(?s)^.*?var INITIAL_MASTER_DATA = ', '' -replace ';\s*$', ''

try {
    $data = $json | ConvertFrom-Json
    Write-Host "Total filas en master_data: $($data.Count)" -ForegroundColor Cyan
    Write-Host ""

    # Buscar filas que contengan EDAG (en cualquier columna)
    $edagRows = @()
    foreach ($row in $data) {
        $found = $false
        foreach ($prop in $row.PSObject.Properties) {
            if ($prop.Value -like "*EDAG*") {
                $found = $true
                break
            }
        }
        if ($found) { $edagRows += $row }
    }

    Write-Host "=== FILAS CON 'EDAG' ===" -ForegroundColor Yellow
    Write-Host "Total encontradas: $($edagRows.Count)" -ForegroundColor Green
    Write-Host ""

    foreach ($row in $edagRows) {
        Write-Host "--- FILA ---" -ForegroundColor DarkCyan
        foreach ($prop in $row.PSObject.Properties) {
            if ($prop.Value -ne $null -and $prop.Value.ToString().Trim() -ne "") {
                Write-Host "  $($prop.Name): [$($prop.Value)]"
            }
        }
        Write-Host ""
    }

    # Mostrar las columnas que hay en el archivo
    Write-Host "=== COLUMNAS DISPONIBLES ===" -ForegroundColor Magenta
    if ($data.Count -gt 0) {
        $data[0].PSObject.Properties.Name | ForEach-Object { Write-Host "  - $_" }
    }

}
catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Primeros 500 chars del fichero:"
    Write-Host $content.Substring(0, [Math]::Min(500, $content.Length))
}
