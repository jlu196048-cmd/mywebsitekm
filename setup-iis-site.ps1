# =============================================================
#  setup-iis-site.ps1  -  Create the IIS site for this project
#  Run as Administrator.
# =============================================================
[CmdletBinding()]
param(
    [int]$Port = 8080,
    [string]$SiteName = "mywebsite",
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$siteRoot = Join-Path $here 'public'    # website root == ./public (where index.html lives)

function Require-Admin {
    $id = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $p  = New-Object System.Security.Principal.WindowsPrincipal($id)
    if (-not $p.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Host "ERROR: please run as Administrator" -ForegroundColor Red
        exit 1
    }
}

function Ensure-ARR {
    # ARR is OPTIONAL. The current architecture serves /api/* by having
    # the frontend fetch the Node backend directly on port 3001 (cross-
    # origin fallback is handled in public/js/app.js). We just check
    # whether ARR is installed/enabled and inform the user — never abort.
    try {
        $proxyEnabled = (Get-WebConfigurationProperty -Filter '/system.webServer/proxy' -Name 'enabled' -ErrorAction Stop)
        if ($proxyEnabled -eq 'True') {
            Write-Host "[OK] ARR proxy enabled — /api/* will use same-origin" -ForegroundColor Green
        } else {
            Write-Host "[i]  ARR proxy installed but disabled — /api/* will use cross-port fallback to Node:3001" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[i]  ARR not installed (this is fine) — /api/* will use cross-port fallback to Node:3001" -ForegroundColor Yellow
    }
}

Require-Admin
try { Import-Module WebAdministration -ErrorAction Stop } catch { Write-Host "[!] WebAdministration module not available; ARR check will be skipped." -ForegroundColor Yellow }

if ($Uninstall) {
    if (Test-Path "IIS:\Sites\$SiteName") { Remove-WebSite -Name $SiteName; Write-Host "Removed site $SiteName." -ForegroundColor Green }
    $pool = "${SiteName}Pool"
    if (Test-Path "IIS:\AppPools\$pool") { Remove-WebAppPool -Name $pool; Write-Host "Removed app pool $pool." -ForegroundColor Green }
    exit 0
}

Ensure-ARR

if (Test-Path "IIS:\Sites\$SiteName")         { Remove-WebSite -Name $SiteName -ErrorAction SilentlyContinue }
if (Test-Path "IIS:\AppPools\${SiteName}Pool") { Remove-WebAppPool -Name "${SiteName}Pool" -ErrorAction SilentlyContinue }

# Create app pool
New-WebAppPool -Name "${SiteName}Pool" | Out-Null
Set-ItemProperty "IIS:\AppPools\${SiteName}Pool" -Name managedRuntimeVersion -Value ""
Set-ItemProperty "IIS:\AppPools\${SiteName}Pool" -Name startMode -Value "AlwaysRunning"
Set-ItemProperty "IIS:\AppPools\${SiteName}Pool" -Name processModel.identityType -Value "ApplicationPoolIdentity"

# Create site
New-WebSite -Name $SiteName -Port $Port -PhysicalPath $siteRoot -ApplicationPool "${SiteName}Pool" | Out-Null

# Add IPv6 binding too so browsers that prefer IPv6 (most modern ones) work.
try {
    New-WebBinding -Name $SiteName -BindingInformation "[::]:${Port}:" -Protocol "http" -ErrorAction Stop | Out-Null
    Write-Host "  [+] IPv6 binding added: [::]:$Port" -ForegroundColor DarkCyan
} catch {
    Write-Host "  [i] IPv6 binding already present or skipped: $($_.Exception.Message)" -ForegroundColor Yellow
}

# ACL: allow IIS_IUSRS to write uploaded images
icacls "$siteRoot\images" /grant "IIS_IUSRS:(OI)(CI)M" | Out-Null
# And the data dir (above site root) needs write access for posts.json updates
icacls (Join-Path $here 'data') /grant "IIS_IUSRS:(OI)(CI)M" | Out-Null

Write-Host ""
Write-Host "IIS site installed." -ForegroundColor Green
Write-Host "  Site root: $siteRoot" -ForegroundColor Cyan
Write-Host "  URL:       http://localhost:$Port/" -ForegroundColor Cyan
Write-Host "  Admin:     http://localhost:$Port/admin" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next:" -ForegroundColor Yellow
Write-Host "  • Start the Node backend (now and on every reboot):" -ForegroundColor Yellow
Write-Host "      .\setup-autostart.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "  • Or start it manually in another terminal:" -ForegroundColor Yellow
Write-Host "      start-mywebsite.cmd" -ForegroundColor Yellow
Write-Host ""
Write-Host "Opening the admin URL in your browser now..." -ForegroundColor Green
Start-Process "http://localhost:$Port/admin"
