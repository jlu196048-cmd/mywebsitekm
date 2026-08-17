# =============================================================
#  setup-autostart.ps1  -  Register a scheduled task that runs
#  start-mywebsite.cmd on user logon (and at boot, to be safe).
#
#  Why a scheduled task rather than a Windows service?
#  • No extra dependency (no nssm / winsw needed).
#  • Picks up environment changes (PATH) just like a normal user shell.
#  • Easy to stop/start from Task Scheduler UI.
#
#  Run as Administrator.
# =============================================================
[CmdletBinding()]
param(
    [int]$Port = 3001,            # must match the value in web.config
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$startScript = Join-Path $here 'start-mywebsite.cmd'
$taskName = 'mywebsite-backend'

function Require-Admin {
    $id = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $p  = New-Object System.Security.Principal.WindowsPrincipal($id)
    if (-not $p.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Host "ERROR: please run as Administrator" -ForegroundColor Red
        exit 1
    }
}

Require-Admin

if ($Uninstall) {
    $existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existing) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "Removed scheduled task $taskName." -ForegroundColor Green
    } else {
        Write-Host "No scheduled task $taskName to remove." -ForegroundColor Yellow
    }
    exit 0
}

# Configure the start script with the right port.
# (We write a small wrapper that exports PORT and runs start-mywebsite.cmd.)
$wrapperPath = Join-Path $here 'start-backend-on-port.cmd'
@"
@echo off
setlocal
set PORT=$Port
set NODE_ENV=production
cd /d "$here"
call "$startScript"
endlocal
"@ | Out-File -FilePath $wrapperPath -Encoding ascii -Force

# Build the principal object that allows running whether the user is logged on or not.
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
              -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
              -StartWhenAvailable -MultipleInstances IgnoreNew
$trigger   = New-ScheduledTaskTrigger -AtStartup
$trigger2  = New-ScheduledTaskTrigger -AtLogOn

$action    = New-ScheduledTaskAction -Execute $wrapperPath -WorkingDirectory $here

# Replace existing task if any.
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

Register-ScheduledTask -TaskName $taskName `
                       -Action $action `
                       -Principal $principal `
                       -Trigger $trigger,$trigger2 `
                       -Settings $settings `
                       -Description "Runs the mywebsite Express backend (port $Port) so IIS can reverse-proxy /api/* to it." | Out-Null

Write-Host "Scheduled task $taskName installed (triggers: AtStartup + AtLogOn)." -ForegroundColor Green
Write-Host ""
Write-Host "Starting it now for testing..." -ForegroundColor Cyan
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 3
try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/profile" -UseBasicParsing -TimeoutSec 5
    Write-Host "Backend is up: HTTP $($r.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "Backend did not respond yet. Check Task Scheduler for errors." -ForegroundColor Yellow
    Write-Host "  - Logs: %APPDATA%\mywebsite\logs\  (if configured)" -ForegroundColor Yellow
    Write-Host "  - Or run:  start-mywebsite.cmd" -ForegroundColor Yellow
}
