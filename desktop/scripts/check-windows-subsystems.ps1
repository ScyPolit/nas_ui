[CmdletBinding()]
param(
    [string]$AppPath = "",
    [string]$SidecarPath = "",
    [string]$Target = "x86_64-pc-windows-msvc"
)

$ErrorActionPreference = "Stop"
$desktopDir = Split-Path -Parent $PSScriptRoot
if (-not $AppPath) {
    $AppPath = Join-Path $desktopDir "src-tauri\target\$Target\release\dufs-desktop.exe"
}
if (-not $SidecarPath) {
    $SidecarPath = Join-Path $desktopDir "src-tauri\target\$Target\release\dufs.exe"
}

function Get-PeSubsystem([string]$Path) {
    $resolved = (Resolve-Path -LiteralPath $Path).Path
    $bytes = [IO.File]::ReadAllBytes($resolved)
    if ($bytes.Length -lt 0x40 -or $bytes[0] -ne 0x4d -or $bytes[1] -ne 0x5a) {
        throw "Not a valid PE executable: $resolved"
    }
    $peOffset = [BitConverter]::ToInt32($bytes, 0x3c)
    if ($peOffset -lt 0 -or $peOffset + 0x60 -gt $bytes.Length) {
        throw "Invalid PE header offset: $resolved"
    }
    return [BitConverter]::ToUInt16($bytes, $peOffset + 0x5c)
}

$appSubsystem = Get-PeSubsystem $AppPath
if ($appSubsystem -ne 2) {
    throw "Desktop executable must use Windows GUI subsystem (2), found $appSubsystem in $AppPath"
}
$sidecarSubsystem = Get-PeSubsystem $SidecarPath
if ($sidecarSubsystem -ne 3) {
    throw "Dufs sidecar must remain a Windows console executable (3), found $sidecarSubsystem in $SidecarPath"
}

Write-Host "Windows subsystem check passed: desktop=GUI (2), sidecar=Console (3, launched with CREATE_NO_WINDOW)."
