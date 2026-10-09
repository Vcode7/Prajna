# ==============================================================================
# PRAJNA — Start Backend & Frontend Silently in Background (Windows)
# ==============================================================================
$ErrorActionPreference = "SilentlyContinue"
$RootDir = $PSScriptRoot
if (-not $RootDir) { $RootDir = (Get-Location).Path }

Write-Host "Starting PRAJNA services in the background..." -ForegroundColor Cyan

# 1. Determine Python Executable
$PythonExe = "python"
if (Test-Path "$RootDir\venv\Scripts\python.exe") {
    $PythonExe = "$RootDir\venv\Scripts\python.exe"
} elseif (Test-Path "$RootDir\.venv\Scripts\python.exe") {
    $PythonExe = "$RootDir\.venv\Scripts\python.exe"
}

# 2. Start Backend (if not already running)
$backendPort = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if (-not $backendPort) {
    $backendProc = Start-Process -WindowStyle Hidden -FilePath $PythonExe `
        -ArgumentList "-m uvicorn backend.main:app --host 0.0.0.0 --port 8000" `
        -WorkingDirectory $RootDir `
        -PassThru
    Write-Host " -> Backend process launched (PID: $($backendProc.Id))" -ForegroundColor Green
} else {
    Write-Host " -> Backend is already running on port 8000." -ForegroundColor Yellow
}

# 3. Start Frontend (if not already running)
$frontendPort = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if (-not $frontendPort) {
    $frontendProc = Start-Process -WindowStyle Hidden -FilePath "cmd.exe" `
        -ArgumentList "/c npm run dev" `
        -WorkingDirectory "$RootDir\frontend" `
        -PassThru
    Write-Host " -> Frontend process launched (PID: $($frontendProc.Id))" -ForegroundColor Green
} else {
    Write-Host " -> Frontend is already running on port 5173." -ForegroundColor Yellow
}

# 4. Wait briefly and verify ports
Start-Sleep -Seconds 3

$backendPort = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
$frontendPort = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue

Write-Host "`nStatus:" -ForegroundColor Yellow
if ($backendPort) {
    Write-Host " [OK] Backend is running at http://localhost:8000" -ForegroundColor Green
} else {
    Write-Host " [..] Backend starting up on port 8000" -ForegroundColor Yellow
}

if ($frontendPort) {
    Write-Host " [OK] Frontend is running at http://localhost:5173" -ForegroundColor Green
} else {
    Write-Host " [..] Frontend starting up on port 5173" -ForegroundColor Yellow
}

Write-Host "`nYou can safely close this terminal now. Both services will keep running." -ForegroundColor Cyan
Write-Host "To stop them at any time, run: .\stop_background.ps1`n" -ForegroundColor Gray
