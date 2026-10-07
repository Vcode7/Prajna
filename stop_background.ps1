# ==============================================================================
# PRAJNA — Stop Background Services (Windows)
# ==============================================================================
Write-Host "Stopping PRAJNA background services..." -ForegroundColor Cyan

# Find and stop backend on port 8000
$backendConn = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($backendConn) {
    $backendPids = $backendConn | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($p in $backendPids) {
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        Write-Host " -> Stopped backend process (PID: $p)" -ForegroundColor Green
    }
} else {
    Write-Host " -> Backend was not running on port 8000." -ForegroundColor Gray
}

# Find and stop frontend on port 5173
$frontendConn = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
if ($frontendConn) {
    $frontendPids = $frontendConn | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($p in $frontendPids) {
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        Write-Host " -> Stopped frontend process (PID: $p)" -ForegroundColor Green
    }
} else {
    Write-Host " -> Frontend was not running on port 5173." -ForegroundColor Gray
}

Write-Host "`nAll PRAJNA background services stopped.`n" -ForegroundColor Yellow
