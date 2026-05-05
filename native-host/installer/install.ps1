<#
.SYNOPSIS
    Installs the tenant-helper Native Messaging host for Microsoft Edge.

.DESCRIPTION
    Copies tenant-helper.exe to %LOCALAPPDATA%\TenantSwitcher\, writes
    the Native Messaging manifest, and registers it under
    HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\ch.pluess.tenant_helper.

.PARAMETER ExtensionId
    The Edge extension ID (32-char lowercase). Find it under edge://extensions
    after loading the unpacked extension.

.EXAMPLE
    .\install.ps1 -ExtensionId abcdefghijklmnopabcdefghijklmnop
#>
param(
    [Parameter(Mandatory=$true)]
    [ValidatePattern('^[a-p]{32}$')]
    [string]$ExtensionId
)

$ErrorActionPreference = 'Stop'

$HostName = 'ch.pluess.tenant_helper'
$InstallDir = Join-Path $env:LOCALAPPDATA 'TenantSwitcher'
$HelperExe = Join-Path $InstallDir 'tenant-helper.exe'
$ManifestPath = Join-Path $InstallDir 'tenant-helper.json'
$RegistryPath = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$HostName"

# 1. Create install directory
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir | Out-Null
}

# 2. Copy executable from script's directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceExe = Join-Path $ScriptDir 'tenant-helper.exe'
if (-not (Test-Path $SourceExe)) {
    throw "tenant-helper.exe not found next to install.ps1 (looked in $ScriptDir)"
}
Copy-Item -Path $SourceExe -Destination $HelperExe -Force

# 3. Render manifest from template
$TemplatePath = Join-Path $ScriptDir 'tenant-helper.json.tmpl'
$Template = Get-Content -Raw -Path $TemplatePath
$Manifest = $Template `
    -replace '\{\{HELPER_PATH\}\}', ($HelperExe -replace '\\', '\\') `
    -replace '\{\{EXTENSION_ID\}\}', $ExtensionId
Set-Content -Path $ManifestPath -Value $Manifest -Encoding utf8

# 4. Register manifest in registry (default value = manifest path)
if (-not (Test-Path $RegistryPath)) {
    New-Item -Path $RegistryPath -Force | Out-Null
}
Set-ItemProperty -Path $RegistryPath -Name '(Default)' -Value $ManifestPath

Write-Host "Installed tenant-helper:"
Write-Host "  Executable: $HelperExe"
Write-Host "  Manifest:   $ManifestPath"
Write-Host "  Registry:   $RegistryPath"
Write-Host ""
Write-Host "Reload the extension in edge://extensions, then click 'Verbindung pruefen' in the Welcome page."
