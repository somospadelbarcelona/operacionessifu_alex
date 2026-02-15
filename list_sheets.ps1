$excelPath = "C:\Users\acoscolin\OneDrive - GRUPO SIFU INTEGRACION LABORAL SL\Escritorio\SEGUIMIENTO DESCUBIERTOS\SEGUIMIENTO DESCUBIERTOS TRAB-RUTA.xlsx"
try {
    $excel = New-Object -ComObject Excel.Application
    $wb = $excel.Workbooks.Open($excelPath, 0, $true)
    foreach ($ws in $wb.Sheets) {
        Write-Host "SHEET: [$($ws.Name)] (Visible: $($ws.Visible))"
    }
}
finally {
    if ($wb) { $wb.Close($false) }
    if ($excel) { $excel.Quit() }
}
