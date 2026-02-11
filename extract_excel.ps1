$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Open('C:\Users\acoscolin\OneDrive - GRUPO SIFU INTEGRACION LABORAL SL\Escritorio\INFORMER SIFU\MASTER GENERAL.xlsx')
$ws = $wb.Sheets.Item(1)
$range = $ws.UsedRange

$data = @()
$rows = $range.Rows.Count
$cols = $range.Columns.Count

Write-Host "Analizando $rows filas y $cols columnas..."

# Get Headers
$headers = @()
for ($c = 1; $c -le $cols; $c++) {
    $h = $range.Cells.Item(1, $c).Text
    if ([string]::IsNullOrWhiteSpace($h)) { $h = "COL_$c" }
    $headers += $h
}

# Get Data
for ($r = 2; $r -le $rows; $r++) {
    $obj = New-Object PSObject
    for ($c = 1; $c -le $cols; $c++) {
        $val = $range.Cells.Item($r, $c).Text
        $obj | Add-Member -MemberType NoteProperty -Name $headers[$c - 1] -Value $val
    }
    $data += $obj
}

$wb.Close($false)
$excel.Quit()

$json = $data | ConvertTo-Json -Depth 5
$finalContent = "const INITIAL_MASTER_DATA = $json;"
[System.IO.File]::WriteAllText('C:\Users\acoscolin\OneDrive - GRUPO SIFU INTEGRACION LABORAL SL\Escritorio\INFORMER SIFU\master_data.js', $finalContent, [System.Text.Encoding]::UTF8)

Write-Host "✅ master_data.js actualizado con $($data.Count) registros."
