@echo off
REM Re-create the IIS site with the corrected physicalPath pointing at public/.
REM Run this from an Administrator CMD or PowerShell.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-iis-site.ps1" -Port 8080 -SiteName mywebsite
pause
