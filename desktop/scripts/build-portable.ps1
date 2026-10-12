[CmdletBinding()]
param(
    [string]$Target = "x86_64-pc-windows-msvc",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$desktopDir = Split-Path -Parent $PSScriptRoot
$repoDir = Split-Path -Parent $desktopDir
$package = Get-Content (Join-Path $desktopDir "package.json") -Raw | ConvertFrom-Json
$version = $package.version
$releaseDir = Join-Path $desktopDir "src-tauri\target\$Target\release"
$outputDir = Join-Path $repoDir "artifacts\desktop\$version"
$folderName = "DufsDesktop_${version}_windows_x64_portable"
$stageDir = Join-Path $outputDir $folderName
$zipPath = Join-Path $outputDir "$folderName.zip"

if (-not $SkipBuild) {
    Push-Location (Join-Path $repoDir "web")
    try {
        npm run build
    } finally {
        Pop-Location
    }

    Push-Location $repoDir
    try {
        cargo build --locked --release --target $Target
    } finally {
        Pop-Location
    }

    Push-Location $desktopDir
    try {
        $env:TAURI_TARGET = $Target
        npm run check:version
        npm run prepare:sidecar
        npm run tauri:build -- --target $Target --no-bundle
    } finally {
        Pop-Location
    }
}

$appSource = Join-Path $releaseDir "dufs-desktop.exe"
$sidecarSource = Join-Path $releaseDir "dufs.exe"
foreach ($source in @($appSource, $sidecarSource)) {
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        throw "Portable build input is missing: $source"
    }
}
& (Join-Path $PSScriptRoot "check-windows-subsystems.ps1") -AppPath $appSource -SidecarPath $sidecarSource -Target $Target

if (Test-Path -LiteralPath $stageDir) {
    $resolvedStage = (Resolve-Path -LiteralPath $stageDir).Path
    $resolvedOutput = (Resolve-Path -LiteralPath $outputDir).Path
    if (-not $resolvedStage.StartsWith($resolvedOutput, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove stage directory outside output: $resolvedStage"
    }
    Remove-Item -LiteralPath $stageDir -Recurse -Force
}
New-Item -ItemType Directory -Path (Join-Path $stageDir "data") -Force | Out-Null
Copy-Item -LiteralPath $appSource -Destination (Join-Path $stageDir "DufsDesktopPortable.exe")
Copy-Item -LiteralPath $sidecarSource -Destination (Join-Path $stageDir "dufs.exe")
Copy-Item -LiteralPath (Join-Path $repoDir "LICENSE-MIT") -Destination $stageDir
Copy-Item -LiteralPath (Join-Path $repoDir "LICENSE-APACHE") -Destination $stageDir
Copy-Item -LiteralPath (Join-Path $repoDir "THIRD_PARTY_LICENSES.md") -Destination $stageDir
New-Item -ItemType File -Path (Join-Path $stageDir "portable.mode") -Force | Out-Null

$readme = @"
Dufs Desktop Portable $version

1. Double-click DufsDesktopPortable.exe. No installation is required.
2. Keep dufs.exe and portable.mode beside the main executable.
3. Settings and logs are stored in the data folder. Move the whole folder to retain them.
4. Use the tray menu's exit command to stop the managed Dufs service before unplugging a drive.

System requirement: Windows 10/11 x64 with Microsoft Edge WebView2 Runtime.
The portable build does not write application settings or logs to the user profile.
"@
Set-Content -LiteralPath (Join-Path $stageDir "README.txt") -Value $readme -Encoding UTF8

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}
Compress-Archive -LiteralPath $stageDir -DestinationPath $zipPath -CompressionLevel Optimal
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $zipPath).Hash.ToLowerInvariant()
Set-Content -LiteralPath "$zipPath.sha256" -Value "$hash  $(Split-Path -Leaf $zipPath)" -Encoding ASCII

Write-Host "Portable package: $zipPath"
Write-Host "SHA256: $hash"
