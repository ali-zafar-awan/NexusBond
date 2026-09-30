# NexusBond Windows Service Installation Script (Requires Administrator)
# Uses NSSM or Windows sc.exe to install NexusBond Core Engine as a background Windows Service

param (
    [string]$Action = "status"
)

$ServiceName = "NexusBondEngine"
$DisplayName = "NexusBond Multi-WAN Bonding Engine"
$EnginePath = "$PSScriptRoot\..\core_engine\main.py"
$PythonPath = (Get-Command python).Source

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "           NexusBond Windows Service Manager                " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

switch ($Action.ToLower()) {
    "install" {
        Write-Host "Installing $DisplayName as a background service..." -ForegroundColor Yellow
        $cmd = "New-Service -Name '$ServiceName' -BinaryPathName '\"$PythonPath\" \"$EnginePath\"' -DisplayName '$DisplayName' -StartupType Automatic"
        Invoke-Expression $cmd
        Write-Host "Service $ServiceName successfully installed!" -ForegroundColor Green
    }
    "start" {
        Start-Service -Name $ServiceName
        Write-Host "Service $ServiceName started." -ForegroundColor Green
    }
    "stop" {
        Stop-Service -Name $ServiceName
        Write-Host "Service $ServiceName stopped." -ForegroundColor Green
    }
    "uninstall" {
        Stop-Service -Name $ServiceName -ErrorAction SilentlyContinue
        $service = Get-CimInstance -ClassName Win32_Service -Filter "Name='$ServiceName'"
        if ($service) {
            $service | Remove-CimInstance
            Write-Host "Service $ServiceName uninstalled." -ForegroundColor Green
        }
    }
    Default {
        $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if ($svc) {
            Write-Host "Service Status: $($svc.Status)" -ForegroundColor Green
        } else {
            Write-Host "Service is not currently installed. Run with -Action install to register." -ForegroundColor DarkGray
        }
    }
}
