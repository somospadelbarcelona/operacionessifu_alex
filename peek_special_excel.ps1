$excelPath = "C:\Users\acoscolin\OneDrive - GRUPO SIFU INTEGRACION LABORAL SL\Escritorio\SEGUIMIENTO DESCUBIERTOS\SEGUIMIENTO DESCUBIERTOS TRAB-RUTA.xlsx"
try {
    $excel = New-Object -ComObject Excel.Application
    $wb = $excel.Workbooks.Open($excelPath, 0, $true) # Readonly
    Write-Host "TABS FOUND:"
    foreach ($ws in $wb.Sheets) {
        Write-Host " - $($ws.Name)"
        $range = $ws.UsedRange
        $cols = $range.Columns.Count
        $headers = @()
        for ($c = 1; $c -le $cols; $c++) {
            $headers += $ws.Cells.Item(1, $c).Value2
        }
        Write-Host "   COLUMNS: $($headers -join ', ')"
    }
}
finally {
    if ($wb) { $wb.Close($false) }
    if ($excel) { $excel.Quit() }
}
