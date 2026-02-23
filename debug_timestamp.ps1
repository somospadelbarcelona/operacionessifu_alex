# debug_timestamp.ps1
$jsPath = Join-Path $PSScriptRoot "master_data.js"
$firstLine = Get-Content $jsPath -TotalCount 2 -Encoding UTF8
Write-Host "=== ARCHIVO master_data.js ===" -ForegroundColor Cyan
Write-Host "Lineas iniciales:"
$firstLine | ForEach-Object { Write-Host "  $_" }
Write-Host ""
$file = Get-Item $jsPath
Write-Host "Ultima modificacion: $($file.LastWriteTime)"
Write-Host "Tamanyo: $($file.Length) bytes"
