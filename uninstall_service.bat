@echo off
setlocal enabledelayedexpansion

title Prajna - Uninstall Auto-Start Service
color 0E

echo ======================================================================
echo    PRAJNA - Uninstall Application Auto-Start Background Service
echo ======================================================================
echo.
echo  Removing auto-start configurations and stopping background services...
echo.

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

echo [1/3] Removing Windows Registry Auto-Start entry...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "PrajnaAppService" /f >nul 2>&1
if %errorlevel% equ 0 (
    echo       - Auto-Start Registry entry removed [OK]
) else (
    echo       - Auto-Start Registry entry was not found or already removed.
)

echo [2/3] Removing Windows Startup Folder Launcher...
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "STARTUP_RUNNER=%STARTUP_DIR%\PrajnaAutoStart.vbs"
if exist "%STARTUP_RUNNER%" (
    del /f /q "%STARTUP_RUNNER%" >nul 2>&1
    echo       - Windows Startup shortcut removed [OK]
) else (
    echo       - Windows Startup shortcut not found or already removed.
)

echo [3/3] Removing Windows Task Scheduler Task...
schtasks /Delete /TN "PrajnaAppService" /F >nul 2>&1
if %errorlevel% equ 0 (
    echo       - Scheduled Task removed [OK]
) else (
    echo       - Scheduled Task was not registered or already removed.
)

echo.
echo Stopping active Prajna background services (port 8000 and 5173)...
powershell -ExecutionPolicy Bypass -File "%ROOT_DIR%\stop_background.ps1"

echo.
echo ======================================================================
echo    PRAJNA AUTO-START SERVICE UNINSTALLED
echo ======================================================================
echo.
echo  Prajna has been removed from system startup.
echo  All background server processes have been stopped.
echo.
echo  To re-enable auto-start at any time, run: install_service.bat
echo ======================================================================
echo.
pause
