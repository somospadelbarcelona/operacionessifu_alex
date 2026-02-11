$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$logFile = "C:\Users\acoscolin\OneDrive - GRUPO SIFU INTEGRACION LABORAL SL\Escritorio\INFORMER SIFU\debug_output.txt"
$errorActionPreference = "Stop"

try {
    "Starting debug..." | Out-File $logFile
    $wb = $excel.Workbooks.Open('C:\Users\acoscolin\OneDrive - GRUPO SIFU INTEGRACION LABORAL SL\Escritorio\INFORMER SIFU\MASTER GENERAL.xlsx')
    $ws = $wb.Sheets.Item(1)
    $range = $ws.UsedRange

    $rows = $range.Rows.Count
    $cols = $range.Columns.Count

    "Rows: $rows" | Out-File $logFile -Append
    "Cols: $cols" | Out-File $logFile -Append

    if ($rows -eq 0 -or $cols -eq 0) {
        "Error: No data found in the sheet." | Out-File $logFile -Append
    }
    else {
        # Inspect Row 1 (Potential Headers)
        "--- Header Inspection (Row 1) ---" | Out-File $logFile -Append
        $headers = @()
        for ($c = 1; $c -le [math]::Min($cols, 20); $c++) {
            # Check first 20 cols
            $val = $range.Cells.Item(1, $c).Text
            "Col ${c}: '$val'" | Out-File $logFile -Append
            if ([string]::IsNullOrWhiteSpace($val)) { $val = "COL_$c" }
            $headers += $val
        }

        # Inspect Row 2 (First Data Row)
        "--- Data Inspection (Row 2) ---" | Out-File $logFile -Append
        for ($c = 1; $c -le [math]::Min($cols, 20); $c++) {
            $val = $range.Cells.Item(2, $c).Text
            "Col ${c}: '$val'" | Out-File $logFile -Append
        }
    }
    $wb.Close($false)
}
catch {
    "Error: $($_.Exception.Message)" | Out-File $logFile -Append
}
finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    "Debug finished." | Out-File $logFile -Append
}
