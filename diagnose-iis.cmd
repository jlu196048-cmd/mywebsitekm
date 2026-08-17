@echo off
:: Diagnose IIS config for the mywebsite site.
:: Run this from an elevated CMD/PowerShell.
"%SystemRoot%\System32\inetsrv\appcmd.exe" list site "mywebsite"
echo === defaultDocument ===
"%SystemRoot%\System32\inetsrv\appcmd.exe" list config "mywebsite" /section:defaultDocument
echo === directoryBrowse ===
"%SystemRoot%\System32\inetsrv\appcmd.exe" list config "mywebsite" /section:directoryBrowse
echo === handlers (StaticFile) ===
"%SystemRoot%\System32\inetsrv\appcmd.exe" list config "mywebsite" /section:handlers | findstr /I "StaticFile"
echo === application pool ===
"%SystemRoot%\System32\inetsrv\appcmd.exe" list apppool "mywebsitePool"
echo === test static fetch via appcmd ===
"%SystemRoot%\System32\inetsrv\appcmd.exe" list config "mywebsite" /section:system.webServer/staticContent 2>nul | findstr /I "clientCache"
