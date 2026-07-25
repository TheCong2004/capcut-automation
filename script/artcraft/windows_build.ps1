# Build Production Artcraft + embed capcut-mate BE (1 command)
# Run from anywhere:
#   cd d:\capcutpolot\artcraft
#   .\script\artcraft\windows_build.ps1
#
# Env:
#   CAPCUT_BUILD_SIDECAR=0  → skip PyInstaller (faster; needs uv/python on target)
#   CAPCUT_BUILD_SIDECAR=1  → default; try freeze capcut-mate-server.exe

$ErrorActionPreference = "Stop"

Write-Host "Building production Artcraft (+ CapCut BE)..." -ForegroundColor Cyan
Write-Host ""

$ArtcraftRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $ArtcraftRoot
Write-Host "Root: $ArtcraftRoot"

# --- 1) Stage BE into Tauri resources ---
& "$PSScriptRoot\stage_unified_backend.ps1"
if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
  throw "Failed to stage unified backend sidecar."
}

# --- 2) Frontend deps ---
try {
  Push-Location -Path ".\frontend"

  Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
  npm install --verbose
  if ($LASTEXITCODE -ne 0) { throw "npm install failed (exit $LASTEXITCODE)" }
}
finally {
  Pop-Location
}

$env:VITE_ENVIRONMENT_TYPE = "production"
$env:SQLX_OFFLINE = "true"

if (-not $env:LIBCLANG_PATH) {
  $defaultLibclang = "C:\Program Files\LLVM\bin"
  if (Test-Path (Join-Path $defaultLibclang "libclang.dll")) {
    $env:LIBCLANG_PATH = $defaultLibclang
    Write-Host "LIBCLANG_PATH set to $defaultLibclang"
  } else {
    Write-Host "WARNING: libclang.dll not found. Install LLVM (winget install LLVM.LLVM) and set LIBCLANG_PATH." -ForegroundColor Yellow
  }
}

$env:TAURI_FRONTEND_PATH = ".\frontend"
$env:TAURI_APP_PATH = ".\crates\desktop\artcraft"

$configPath = ".\crates\desktop\artcraft\tauri.artcraft_3d.no_dev.conf.json"
if (-not (Test-Path $configPath)) {
  $configPath = ".\crates\desktop\artcraft\tauri.conf.json"
  Write-Host "Using fallback config: $configPath" -ForegroundColor Yellow
}

# --- 3) Tauri production build ---
Write-Host "cargo tauri build --config $configPath" -ForegroundColor Cyan
cargo tauri build --config $configPath
if ($LASTEXITCODE -ne 0) {
  throw "cargo tauri build failed (exit $LASTEXITCODE)"
}

# --- 4) Also copy BE next to bare ArtCraft.exe (portable folder) ---
$releaseDir = Join-Path $ArtcraftRoot "target\release"
$stageMate = Join-Path $ArtcraftRoot "crates\desktop\artcraft\resources\capcut-mate"
$stageSidecar = Join-Path $ArtcraftRoot "crates\desktop\artcraft\resources\capcut-mate-server.exe"
$mediaCrawlerSidecar = Join-Path $ArtcraftRoot "crates\desktop\artcraft\resources\media-crawler\media-crawler-server.exe"
$openMontageSidecar = Join-Path $ArtcraftRoot "crates\desktop\artcraft\resources\openmontage\openmontage-server.exe"
$mediaCrawlerResources = Join-Path $ArtcraftRoot "crates\desktop\artcraft\resources\media-crawler"
$openMontageResources = Join-Path $ArtcraftRoot "crates\desktop\artcraft\resources\openmontage"

$stageUnifiedSidecar = Join-Path $ArtcraftRoot "crates\desktop\artcraft\resources\artcraft-server.exe"

if (Test-Path $stageUnifiedSidecar) {
  Stop-Process -Name "artcraft-server" -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  Copy-Item $stageUnifiedSidecar -Destination (Join-Path $releaseDir "artcraft-server.exe") -Force
  Write-Host "Copied unified sidecar → $releaseDir\artcraft-server.exe"
}
if (Test-Path $stageMate) {
  $destMate = Join-Path $releaseDir "capcut-mate"
  if (Test-Path $destMate) { Remove-Item -Recurse -Force $destMate }
  Copy-Item $stageMate -Destination $destMate -Recurse -Force
  Write-Host "Copied capcut-mate → $destMate"
}
if (Test-Path $stageSidecar) {
  Copy-Item $stageSidecar -Destination (Join-Path $releaseDir "capcut-mate-server.exe") -Force
  Write-Host "Copied sidecar → $releaseDir\capcut-mate-server.exe"
}
if (Test-Path $mediaCrawlerSidecar) {
  $mediaPortable = Join-Path $releaseDir "media-crawler"
  if (Test-Path $mediaPortable) { Remove-Item -LiteralPath $mediaPortable -Recurse -Force }
  Copy-Item $mediaCrawlerResources -Destination $mediaPortable -Recurse -Force
  Write-Host "Copied MediaCrawler runtime -> $mediaPortable"
}
if (Test-Path $openMontageSidecar) {
  $openMontagePortable = Join-Path $releaseDir "openmontage"
  if (Test-Path $openMontagePortable) { Remove-Item -LiteralPath $openMontagePortable -Recurse -Force }
  Copy-Item $openMontageResources -Destination $openMontagePortable -Recurse -Force
  Write-Host "Copied OpenMontage runtime -> $openMontagePortable"
}

$nsisDir = Join-Path $ArtcraftRoot "target\release\bundle\nsis"
$exePath = Join-Path $releaseDir "ArtCraft.exe"

Write-Host ""
Write-Host "Production Build Done!" -ForegroundColor Green
Write-Host ""
Write-Host "Portable run (no install):" -ForegroundColor Cyan
Write-Host "  $exePath"
Write-Host "  (CapCut, MediaCrawler and OpenMontage backends auto-start with ArtCraft)"
Write-Host ""
if (Test-Path $nsisDir) {
  Write-Host "Installer: $nsisDir\ArtCraft_*-setup.exe"
  Start-Process "explorer.exe" -ArgumentList $nsisDir
} else {
  Write-Host "NSIS folder not found: $nsisDir" -ForegroundColor Yellow
}
if (Test-Path $exePath) {
  Write-Host "Exe: $exePath"
}
