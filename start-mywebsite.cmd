@echo off
REM =============================================================
REM  start-mywebsite.cmd  -  Starts the Node backend on port 3001
REM
REM  Use this when you don't want a Windows Service / scheduled task,
REM  or for quick debugging. Keep this window open.
REM
REM  Pair with web.config (Plan B) where IIS proxies /api/* to port 3001.
REM =============================================================
setlocal
cd /d "%~dp0"

REM Configurable: change the port here AND in web.config if you move it.
set PORT=3001
set NODE_ENV=production

REM Try node.exe; if not in PATH, fall back to default install location.
where node >nul 2>nul
if %errorlevel% neq 0 (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "PATH=C:\Program Files\nodejs;%PATH%"
    ) else (
        echo [mywebsite] node.exe not found. Install Node.js 18+ from https://nodejs.org/
        pause
        exit /b 1
    )
)

REM Print a banner
echo.
echo ============================================================
echo   mywebsite backend  -  listening on http://127.0.0.1:%PORT%
echo ============================================================
echo.

node server/index.js
endlocal
