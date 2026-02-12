$content = Get-Content 'c:\Users\acoscolin\OneDrive - GRUPO SIFU INTEGRACION LABORAL SL\Escritorio\INFORMER SIFU\master_data.js' -Raw
$json = $content -replace '^const INITIAL_MASTER_DATA = ', '' -replace ';$', ''
$data = $json | ConvertFrom-Json
$count = 0
foreach ($row in $data) {
    if ($row.ESTADO -ne 'CUBIERTO') {
        Write-Host ($row.SERVICIO + ' | ' + $row.ESTADO)
    }
}
