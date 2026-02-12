$content = Get-Content 'c:\Users\acoscolin\OneDrive - GRUPO SIFU INTEGRACION LABORAL SL\Escritorio\INFORMER SIFU\master_data.js' -Raw
$json = $content -replace '^const INITIAL_MASTER_DATA = ', '' -replace ';$', ''
$data = $json | ConvertFrom-Json
foreach ($row in $data) {
    if ($row.ESTADO -ne 'CUBIERTO' -or $row.ESTADO1 -ne '') {
        $msg = $row.SERVICIO + ' | ' + $row.ESTADO + ' | ' + $row.TITULAR + ' | ' + $row.ESTADO1 + ' | ' + $row.SUPLENTE
        Write-Host $msg
    }
}
