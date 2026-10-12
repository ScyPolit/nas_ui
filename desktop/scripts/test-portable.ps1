[CmdletBinding()]
param(
    [string]$PortableDir = ""
)

$ErrorActionPreference = "Stop"
$desktopDir = Split-Path -Parent $PSScriptRoot
$repoDir = Split-Path -Parent $desktopDir
$version = (Get-Content (Join-Path $desktopDir "package.json") -Raw | ConvertFrom-Json).version
if (-not $PortableDir) {
    $PortableDir = Join-Path $repoDir "artifacts\desktop\$version\DufsDesktop_${version}_windows_x64_portable"
}
$PortableDir = (Resolve-Path -LiteralPath $PortableDir).Path
$appPath = Join-Path $PortableDir "DufsDesktopPortable.exe"
$dataDir = Join-Path $PortableDir "data"
$shareDir = Join-Path $env:TEMP "dufs-portable-smoke-$PID"

foreach ($required in @($appPath, (Join-Path $PortableDir "dufs.exe"), (Join-Path $PortableDir "portable.mode"))) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
        throw "Portable file is missing: $required"
    }
}

New-Item -ItemType Directory -Path $shareDir -Force | Out-Null
Set-Content -LiteralPath (Join-Path $shareDir "portable-smoke.txt") -Value "portable smoke test" -Encoding UTF8
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = ([Net.IPEndPoint]$listener.LocalEndpoint).Port
$listener.Stop()

$settings = [ordered]@{
    schemaVersion = 1
    configured = $true
    sharePath = $shareDir
    bind = "127.0.0.1"
    port = $port
    permissions = [ordered]@{ browse = $true; download = $true; upload = $true; archive = $true; manage = $false }
    autostartApp = $false
    startService = $true
    keepInTray = $false
    openBrowser = $false
    theme = "system"
}
$settingsJson = $settings | ConvertTo-Json -Depth 5
[IO.File]::WriteAllText(
    (Join-Path $dataDir "settings.json"),
    $settingsJson,
    [Text.UTF8Encoding]::new($false)
)

$existingDufs = @(Get-Process -Name "dufs" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$desktop = Start-Process -FilePath $appPath -WorkingDirectory $PortableDir -WindowStyle Hidden -PassThru
$childIds = @()
try {
    $healthy = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 250
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$port/__dufs__/health" -TimeoutSec 1
            if ($response.StatusCode -eq 200) {
                $healthy = $true
                break
            }
        } catch {}
    }
    if (-not $healthy) {
        throw "Portable Dufs service did not become healthy on port $port"
    }

    $content = (Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$port/portable-smoke.txt" -TimeoutSec 2).Content.Trim()
    if ($content -ne "portable smoke test") {
        throw "Portable Dufs returned unexpected content: $content"
    }
    $childIds = @(Get-Process -Name "dufs" -ErrorAction SilentlyContinue |
        Where-Object { $existingDufs -notcontains $_.Id } |
        Select-Object -ExpandProperty Id)
    if (-not $childIds) {
        throw "Portable Dufs child process was not detected"
    }
    if (-not (Test-Path -LiteralPath (Join-Path $dataDir "dufs-desktop.log") -PathType Leaf)) {
        throw "Portable log was not written to the data directory"
    }

    $null = $desktop.CloseMainWindow()
    if (-not $desktop.WaitForExit(10000)) {
        throw "Portable desktop did not exit after its main window closed"
    }
    Start-Sleep -Milliseconds 500
    $survivors = @(Get-Process -Id $childIds -ErrorAction SilentlyContinue)
    if ($survivors) {
        throw "Managed Dufs process survived desktop exit: $($survivors.Id -join ', ')"
    }
    Write-Host "Portable smoke test passed (port $port, desktop PID $($desktop.Id), Dufs PID $($childIds -join ', '))."
} finally {
    if (-not $desktop.HasExited) {
        Stop-Process -Id $desktop.Id -Force -ErrorAction SilentlyContinue
    }
    foreach ($childId in $childIds) {
        Stop-Process -Id $childId -Force -ErrorAction SilentlyContinue
    }
}
