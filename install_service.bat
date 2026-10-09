@echo off
setlocal enabledelayedexpansion

title Prajna - Install Auto-Start Service
color 0B

echo ======================================================================
echo    PRAJNA - Install Application Auto-Start Background Service
echo ======================================================================
echo.
echo  Configuring system to start Prajna (Backend + Frontend) automatically
echo  every time this computer turns on or you log in...
echo.

:: Get absolute directory containing this script without trailing backslash
set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

set "VBS_SCRIPT=%ROOT_DIR%\start_silent.vbs"

if not exist "%VBS_SCRIPT%" (
    color 0C
    echo [ERROR] start_silent.vbs was not found at:
    echo "%VBS_SCRIPT%"
    echo Please make sure install_service.bat is placed in the project root directory.
    echo.
    pause
    exit /b 1
)

echo [1/3] Registering Windows Auto-Start Registry entry...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "PrajnaAppService" /t REG_SZ /d "wscript.exe \"%VBS_SCRIPT%\"" /f >nul 2>&1
if %errorlevel% equ 0 (
    echo       - Auto-Start Registry entry configured [OK]
) else (
    echo       - Warning: Could not add Registry entry.
)

echo [2/3] Registering Windows Startup Folder Launcher...
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "STARTUP_RUNNER=%STARTUP_DIR%\PrajnaAutoStart.vbs"
(
    echo Set WshShell = CreateObject^("WScript.Shell"^)
    echo WshShell.Run "wscript.exe """ ^& "%VBS_SCRIPT%" ^& """", 0, False
) > "%STARTUP_RUNNER%" 2>nul
if exist "%STARTUP_RUNNER%" (
    echo       - Windows Startup shortcut installed [OK]
) else (
    echo       - Startup folder shortcut skipped.
)

echo [3/3] Registering Windows Task Scheduler (Background Service)...
schtasks /Create /TN "PrajnaAppService" /TR "wscript.exe \"%VBS_SCRIPT%\"" /SC ONLOGON /RL HIGHEST /F >nul 2>&1
if %errorlevel% equ 0 (
    echo       - Windows Scheduled Task created with Elevated Privileges [OK]
) else (
    schtasks /Create /TN "PrajnaAppService" /TR "wscript.exe \"%VBS_SCRIPT%\"" /SC ONLOGON /F >nul 2>&1
    if %errorlevel% equ 0 (
        echo       - Windows Scheduled Task created [OK]
    ) else (
        echo       - Scheduled task skipped (User startup entry active) [OK]
    )
)

echo.
echo Launching Prajna background services now...
start "" wscript.exe "%VBS_SCRIPT%"

echo Waiting a few seconds for services to initialize...
timeout /t 4 /nobreak >nul

echo.
echo ======================================================================
echo    PRAJNA AUTO-START SERVICE ACTIVATED SUCCESSFULLY!
echo ======================================================================
echo.
echo  * Backend Server : http://localhost:8000  (API / Docs: http://localhost:8000/docs)
echo  * Frontend Server: http://localhost:5173  (Web Dashboard)
echo.
echo  Both services are now running in the background with no open terminal.
echo  They will automatically start every time you turn on your computer.
echo.
echo  To stop or remove the auto-start service anytime, run:
echo  uninstall_service.bat
echo ======================================================================
echo.
pause
