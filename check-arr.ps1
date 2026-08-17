# Self-elevating ARR / proxy diagnostic.

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $script = $MyInvocation.MyCommand.Definition
    Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $script
    exit
}

Import-Module WebAdministration

Write-Host '=== A. Web Managed Modules (filtered) ==='
Get-WebManagedModule |
    Where-Object { $_.Name -match 'proxy|arr|urlrewrite|rewrite' } |
    Format-Table Name, Type -AutoSize

Write-Host ''
Write-Host '=== B. Global proxy section enabled? ==='
try {
    $pe = (Get-WebConfigurationProperty -Filter '/system.webServer/proxy' -Name 'enabled' -ErrorAction Stop)
    Write-Host ('  proxy.enabled = ' + $pe) -ForegroundColor $(if ($pe -eq 'True') { 'Green' } else { 'Yellow' })
} catch {
    Write-Host '  ERROR querying proxy.enabled:' -ForegroundColor Red
    Write-Host ('   ' + $_.Exception.Message)
}

Write-Host ''
Write-Host '=== C. /system.webServer/proxy section registered? ==='
try {
    $cfg = Get-WebConfiguration '/system.webServer/proxy' -ErrorAction Stop
    Write-Host '  YES, section registered in IIS config schema' -ForegroundColor Green
} catch {
    Write-Host '  NO: section is missing (ARR not installed)' -ForegroundColor Red
    Write-Host ('   ' + $_.Exception.Message)
}

Write-Host ''
Write-Host '=== D. ARR DLL location ==='
foreach ($p in @('C:\Windows\System32\inetsrv\arr.dll', 'C:\Windows\System32\inetsrv\requestrouter.dll')) {
    if (Test-Path $p) {
        $info = Get-Item $p
        Write-Host ('  [OK] ' + $p + ' (' + $info.Length + ' bytes, ' + $info.LastWriteTime.ToString('yyyy-MM-dd') + ')')
    } else {
        Write-Host ('  [--] ' + $p + ' missing')
    }
}

Write-Host ''
Write-Host '=== E. Recently installed IIS modules (Programs & Features snapshot) ==='
Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -match 'ARR|RequestRouter|iisnode|URL Rewrite' } |
    Select-Object DisplayName, DisplayVersion, InstallDate |
    Format-Table -AutoSize

Write-Host ''
Write-Host '=== F. Try to reload web.config to surface the precise error ==='
$wcPath = 'public\web.config'
try {
    # Reading via appcmd directly gives the IIS-internal error.
    & "$env:SystemRoot\System32\inetsrv\appcmd.exe" check config -section:system.webServer/rewrite 2>&1 | Out-String | Write-Host
} catch {}

Read-Host 'Press Enter to exit'
