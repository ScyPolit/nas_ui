param([switch]$Debug)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$FrontendRoot = Join-Path $ProjectRoot 'web'
$CargoBin = Join-Path $env:USERPROFILE '.cargo\bin'

if (Test-Path -LiteralPath $CargoBin) { $env:Path = "$CargoBin;$env:Path" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 22 or newer is required.' }
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { throw 'Rust/Cargo is required. Install it from https://rustup.rs.' }

if ($IsWindows -or $env:OS -eq 'Windows_NT') {
    $vswhere = 'C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe'
    if (Test-Path -LiteralPath $vswhere) {
        $env:Path = "$(Split-Path -Parent $vswhere);$env:Path"
        $installation = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
        if ($installation) {
            $vsDevCmd = Join-Path $installation 'Common7\Tools\VsDevCmd.bat'
            $environment = & cmd.exe /d /c "`"$vsDevCmd`" -no_logo -arch=amd64 && set"
            foreach ($line in $environment) {
                if ($line -match '^([^=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process') }
            }
        }
    }
}

Push-Location $FrontendRoot
try {
    npm.cmd ci
    npm.cmd test
    npm.cmd run build
} finally { Pop-Location }

Push-Location $ProjectRoot
try {
    cargo fmt --all -- --check
    if ($Debug) {
        cargo build --locked
        Write-Host "Build complete: $ProjectRoot\target\debug\dufs.exe"
    } else {
        cargo build --locked --release
        Write-Host "Build complete: $ProjectRoot\target\release\dufs.exe"
    }
} finally { Pop-Location }
