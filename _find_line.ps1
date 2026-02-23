$lines = Get-Content 'app.js'
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match 'function refreshMetrics') {
        Write-Host "LINEA $($i+1): $($lines[$i])"
    }
}
