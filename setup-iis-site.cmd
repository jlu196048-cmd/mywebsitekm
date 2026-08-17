@echo off
REM =============================================================
REM  setup-iis-site.cmd  -  Register the IIS site pointing at .\public
REM  Run as Administrator.
REM =============================================================
setlocal
cd /d "%~dp0"

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: please run as Administrator
    pause
    exit /b 1
)

set PORT=8080
set SITENAME=mywebsite
set SITEROOT=%CD%\public

if not exist "%SITEROOT%\index.html" (
    echo ERROR: %SITEROOT%\index.html not found.
    echo Make sure this is the mywebsite project root with a public\ subfolder.
    pause
    exit /b 1
)

echo Setting up IIS site "%SITENAME%" at http://localhost:%PORT% from "%SITEROOT%" ...
echo.

REM Enable ARR proxy via appcmd (assume ARR module already loaded)
set APCMD=%systemroot%\system32\inetsrv\appcmd.exe

REM Remove existing site with same name to start fresh.
%APCMD% delete site "%SITENAME%" >nul 2>&1
%APCMD% delete apppool "%SITENAME%Pool" >nul 2>&1

REM Create app pool
%APCMD% add apppool /name:"%SITENAME%Pool" /managedRuntimeVersion:"" /startMode:"AlwaysRunning" /processModel.identityType:"ApplicationPoolIdentity" >nul

REM Create the site pointing to .\public
%APCMD% add site /name:"%SITENAME%" /bindings:http/*:%PORT%:localhost /physicalPath:"%SITEROOT%" /applicationPool:"%SITENAME%Pool"

REM Allow AppPool identity write access for image uploads and data file updates
icacls "%SITEROOT%\images" /grant "IIS_IUSRS:(OI)(CI)M" >nul 2>&1
icacls "%CD%\data"       /grant "IIS_IUSRS:(OI)(CI)M" >nul 2>&1

echo.
echo IIS site created.
echo   Site root: %SITEROOT%
echo   URL:       http://localhost:%PORT%/
echo   Admin:     http://localhost:%PORT%/admin
echo.
echo Next steps:
echo   1. Start the Node backend in another terminal:
echo        start-mywebsite.cmd
echo      or register auto-start with:  setup-autostart.ps1
echo.
echo   2. Open http://localhost:%PORT%/admin   (admin / admin123)
echo.
pause
endlocal
