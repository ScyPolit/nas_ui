param(
    [Parameter(Mandatory = $true)][string]$SharePath,
    [int]$Port = 5000,
    [string]$Bind = '0.0.0.0',
    [string]$Executable = "$PSScriptRoot\..\target\release\dufs.exe"
)

$ErrorActionPreference = 'Stop'
$resolvedShare = (Resolve-Path -LiteralPath $SharePath).Path
$resolvedExecutable = (Resolve-Path -LiteralPath $Executable).Path
Write-Host "Shared directory: $resolvedShare"
Write-Host "Listening URL: http://$Bind`:$Port"
Write-Warning 'Anonymous uploads are intended for trusted LANs. Do not expose this configuration directly to the Internet.'
& $resolvedExecutable $resolvedShare --bind $Bind --port $Port
