<#
.SYNOPSIS
    Removes the tenant-helper Native Messaging host installation.
#>
$ErrorActionPreference = 'Stop'

$HostName = 'ch.pluess.tenant_helper'
$InstallDir = Join-Path $env:LOCALAPPDATA 'TenantSwitcher'
$RegistryPath = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$HostName"

if (Test-Path $RegistryPath) {
    Remove-Item -Path $RegistryPath -Recurse -Force
    Write-Host "Removed registry key: $RegistryPath"
}

if (Test-Path $InstallDir) {
    Remove-Item -Path (Join-Path $InstallDir 'tenant-helper.exe') -Force -ErrorAction SilentlyContinue
    Remove-Item -Path (Join-Path $InstallDir 'tenant-helper.json') -Force -ErrorAction SilentlyContinue
    Write-Host "Removed binaries from: $InstallDir"
}
Write-Host "Note: tenant profile directories under $InstallDir\profiles\ were preserved."
