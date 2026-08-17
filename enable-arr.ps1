# =============================================================
#  enable-arr.ps1  -  Install + enable Application Request Routing
#                     and its dependency (URL Rewrite).
#
#  Why winget might have failed before:
#    ARR is a per-machine installer that needs elevation. Spawning
#    "winget install" from inside another admin PowerShell WITHOUT -Verb RunAs
#    can downgrade the token, which causes winget to abort with
#    -1978335226 (E_ACCESSDENIED). We solve this by launching a fresh
#    elevated PowerShell process that runs winget, which guarantees full
#    administrative elevation for the install.
#
#  Run this script from any PowerShell (the script auto-elevates).
# =============================================================
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

function Require-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p  = New-Object Security.Principal.WindowsPrincipal($id)
    if ($p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { return }
    Write-Host "Need administrator. Re-launching..." -ForegroundColor Yellow
    $script = $MyInvocation.MyCommand.Definition
    Start-Process powershell -Verb RunAs -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $script)
    exit
}

Require-Admin

Import-Module WebAdministration -ErrorAction SilentlyContinue

$arrDllPrimary   = 'C:\Windows\System32\inetsrv\arr.dll'
$arrDllSecondary = 'C:\Windows\System32\inetsrv\requestrouter.dll'
$rewriteDll      = 'C:\Windows\System32\inetsrv\rewrite.dll'

function Test-WingetPresent {
    return [bool](Get-Command winget -ErrorAction SilentlyContinue)
}

function Invoke-WingetInstall-Elevated {
    # Launch a brand-new elevated PowerShell that runs winget, then waits.
    # This ensures winget runs with full admin token (no inheritance issues).
    param([string]$Id)
    $ps = (Get-Command powershell.exe).Source
    $args = @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
        "winget install --id `"$Id`" --accept-package-agreements --accept-source-agreements --scope machine; Write-Host 'exit:'`$LASTEXITCODE; Read-Host 'Press Enter'"
    )
    $proc = Start-Process -FilePath $ps -ArgumentList $args -Verb RunAs -Wait -PassThru
    return $proc.ExitCode
}

# 1. Check current state
$arrInstalled = (Test-Path $arrDllPrimary) -or (Test-Path $arrDllSecondary)
$rewriteInstalled = Test-Path $rewriteDll

if ($arrInstalled -and $rewriteInstalled) {
    Write-Host "[OK] ARR and URL Rewrite already installed." -ForegroundColor Green
} else {

    if (-not (Test-WingetPresent)) {
        Write-Host "winget not found in PATH." -ForegroundColor Red
        Write-Host "  Either install 'App Installer' from Microsoft Store, or"
        Write-Host "  install ARR manually from https://www.iis.net/downloads/microsoft/application-request-routing"
        exit 1
    }

    # ---- URL Rewrite (ARR dependency) ----
    if (-not $rewriteInstalled) {
        Write-Host ""
        Write-Host "==> Installing Microsoft.IIS.URLRewrite ..." -ForegroundColor Cyan
        $rc = Invoke-WingetInstall-Elevated -Id 'Microsoft.IIS.URLRewrite'
        if ($rc -ne 0) {
            Write-Host ("  winget returned exit code $rc. Continuing anyway — it may already be installed.") -ForegroundColor Yellow
        }
    }

    # ---- ARR ----
    if (-not $arrInstalled) {
        Write-Host ""
        Write-Host "==> Installing Microsoft.IIS.ApplicationRequestRouting ..." -ForegroundColor Cyan
        $rc = Invoke-WingetInstall-Elevated -Id 'Microsoft.IIS.ApplicationRequestRouting'
        if ($rc -ne 0) {
            Write-Host ("  winget returned exit code $rc. Trying once more without --scope machine ...") -ForegroundColor Yellow
            # Fallback: a manually-invoked, user-level install window
            Start-Process powershell -Verb RunAs -ArgumentList @(
                '-NoProfile', '-Command',
                "winget install --id Microsoft.IIS.ApplicationRequestRouting --accept-package-agreements --accept-source-agreements; Read-Host 'Press Enter'"
            ) -Wait
        }
    }

    # Verify what actually got installed
    $arrInstalled     = (Test-Path $arrDllPrimary) -or (Test-Path $arrDllSecondary)
    $rewriteInstalled = Test-Path $rewriteDll
    Write-Host ""
    if ($arrInstalled)     { Write-Host "[OK] ARR DLL present" -ForegroundColor Green } else { Write-Host "[!!] ARR DLL still missing" -ForegroundColor Red }
    if ($rewriteInstalled) { Write-Host "[OK] URL Rewrite DLL present" -ForegroundColor Green } else { Write-Host "[!!] URL Rewrite DLL still missing" -ForegroundColor Red }

    if (-not $arrInstalled) {
        Write-Host ""
        Write-Host "winget did not produce the files. Last-resort manual install:" -ForegroundColor Red
        Write-Host "  1. Open this link from your browser: https://go.microsoft.com/fwlink/?LinkID=615136" -ForegroundColor Red
        Write-Host "  2. Save the MSI (renamed to arr-amd64.msi) and double-click it." -ForegroundColor Red
        Write-Host "  3. Re-run this script after the install completes." -ForegroundColor Red
        exit 1
    }
}

# 2. Enable proxy.
Write-Host ""
Write-Host "Enabling proxy in IIS config..." -ForegroundColor Cyan
try {
    $cur = (Get-WebConfigurationProperty -Filter '/system.webServer/proxy' -Name 'enabled' -ErrorAction Stop)
    if ($cur -eq 'True') {
        Write-Host "[OK] Proxy already enabled." -ForegroundColor Green
    } else {
        Set-WebConfigurationProperty -Filter '/system.webServer/proxy' -Name 'enabled' -Value 'True' -ErrorAction Stop
        Write-Host "[OK] Proxy enabled." -ForegroundColor Green
    }
} catch {
    Write-Host ""
    Write-Host "Could not enable proxy via PowerShell. Enable it manually:" -ForegroundColor Yellow
    Write-Host "  IIS Manager -> 'Application Request Routing Cache' -> 'Server Proxy Settings...' -> check 'Enable proxy'." -ForegroundColor Yellow
    exit 1
}

# 3. iisreset
Write-Host ""
Write-Host "Restarting IIS..." -ForegroundColor Cyan
& iisreset

Write-Host ""
Write-Host "Done. Run  .\setup-iis-site.ps1  if you haven't yet." -ForegroundColor Green
Read-Host 'Press Enter to exit'
