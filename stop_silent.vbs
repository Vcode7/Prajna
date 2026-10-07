' ==============================================================================
' PRAJNA — 1-Click Silent Shutdown (Windows)
' Stops Backend (port 8000) and Frontend (port 5173) background processes silently.
' ==============================================================================
Set WshShell = CreateObject("WScript.Shell")

' Terminate any processes listening on ports 8000 and 5173
stopCmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ""Get-NetTCPConnection -LocalPort 8000, 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"""

' Run completely hidden (0 = hidden, False = return immediately)
WshShell.Run stopCmd, 0, False
