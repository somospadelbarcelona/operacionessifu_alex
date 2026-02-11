$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Open('C:\Users\acoscolin\OneDrive - GRUPO SIFU INTEGRACION LABORAL SL\Escritorio\INFORMER SIFU\MASTER GENERAL.xlsx')
$ws = $wb.Sheets.Item(1)

$tempCsv = 'C:\Users\acoscolin\OneDrive - GRUPO SIFU INTEGRACION LABORAL SL\Escritorio\INFORMER SIFU\temp_master.csv'

# Save as CSV (6 = xlCSV)
$ws.SaveAs($tempCsv, 6)

$wb.Close($false)
$excel.Quit()

# Read CSV and convert to JSON
$data = Import-Csv $tempCsv -Delimiter ','
$json = $data | ConvertTo-Json -Depth 5
$finalContent = "const INITIAL_MASTER_DATA = $json;"
[System.IO.File]::WriteAllText('C:\Users\acoscolin\OneDrive - GRUPO SIFU INTEGRACION LABORAL SL\Escritorio\INFORMER SIFU\master_data.js', $finalContent, [System.Text.Encoding]::UTF8)

# Clean up
Remove-Item $tempCsv

Write-Host "✅ master_data.js actualizado ultra-rápido con $($data.Count) registros."
