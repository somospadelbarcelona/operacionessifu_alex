$content = Get-Content 'c:\Users\acoscolin\OneDrive - GRUPO SIFU INTEGRACION LABORAL SL\Escritorio\INFORMER SIFU\master_data.js' -Raw
$json = $content -replace '^const INITIAL_MASTER_DATA = ', '' -replace ';$', ''
$data = $json | ConvertFrom-Json
foreach ($row in $data) {
    if ($row.ESTADO1 -ne '') {
        $sup = ($row.SUPLENTE + '').Trim()
        if ($sup.Length -lt 3) {
            Write-Host ($row.SERVICIO + ' | ' + $row.ESTADO1 + ' | ' + $row.SUPLENTE)
        }
    }
}
