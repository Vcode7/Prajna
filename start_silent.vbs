' ==============================================================================
' PRAJNA — 1-Click Silent Startup (Windows)
' Launches both Backend and Frontend in the background with NO terminal windows.
' ==============================================================================
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
Set WshShell = CreateObject("WScript.Shell")

' 1. Locate Python executable (checks .\venv, .\.venv, or system PATH)
pyExe = "python"
If fso.FileExists(currentDir & "\venv\Scripts\python.exe") Then
    pyExe = """" & currentDir & "\venv\Scripts\python.exe"""
ElseIf fso.FileExists(currentDir & "\.venv\Scripts\python.exe") Then
    pyExe = """" & currentDir & "\.venv\Scripts\python.exe"""
End If

' 2. Launch Backend silently on port 8000 if not already running (0 = hide window, False = do not wait)
backendCmd = "cmd.exe /c (netstat -ano | findstr :8000 | findstr LISTENING >nul) || (cd /d """ & currentDir & """ && " & pyExe & " -m uvicorn backend.main:app --host 0.0.0.0 --port 8000)"
WshShell.Run backendCmd, 0, False

' 3. Launch Frontend silently on port 5173 if not already running (0 = hide window, False = do not wait)
frontendCmd = "cmd.exe /c (netstat -ano | findstr :5173 | findstr LISTENING >nul) || (cd /d """ & currentDir & "\frontend"" && npm run dev)"
WshShell.Run frontendCmd, 0, False
