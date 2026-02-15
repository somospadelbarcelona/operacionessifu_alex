$excelPath = "C:\Users\acoscolin\OneDrive - GRUPO SIFU INTEGRACION LABORAL SL\Escritorio\SEGUIMIENTO DESCUBIERTOS\SEGUIMIENTO DESCUBIERTOS TRAB-RUTA.xlsx"
try {
    $excel = New-Object -ComObject Excel.Application
    $wb = $excel.Workbooks.Open($excelPath, 0, $true)
    $ws = $wb.Sheets.Item("TRABAJADORES")
    $range = $ws.UsedRange
    $data = $range.Value2
    for ($r = 1; $r -le [Math]::Min($range.Rows.Count, 10); $r++) {
        $row = @()
        for ($c = 1; $c -le $range.Columns.Count; $c++) {
            $row += $data[$r, $c]
        }
        Write-Host ($row -join " | ")
    }
}
finally {
    if ($wb) { $wb.Close($false) }
    if ($excel) { $excel.Quit() }
}
