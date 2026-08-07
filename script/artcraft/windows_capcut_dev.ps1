# Start ArtCraft stack for desktop with Unified Backend on :30000

$ErrorActionPreference = "Stop"
$ArtcraftRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$MateRoot = Join-Path $ArtcraftRoot "capcut-mate"
$YouweeRoot = Join-Path $ArtcraftRoot "be-youwee"
$MediaCrawlerRoot = Join-Path $ArtcraftRoot "MediaCrawler-be"
$OpenMontageRoot = Join-Path $ArtcraftRoot "OpenMontage"

Write-Host "Artcraft: $ArtcraftRoot" -ForegroundColor Cyan
Write-Host "capcut-mate: $MateRoot"
Write-Host "be-youwee: $YouweeRoot"
Write-Host "MediaCrawler-be: $MediaCrawlerRoot"
Write-Host "OpenMontage: $OpenMontageRoot"
Write-Host ""

function Test-Port([int]$Port) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $c.Connect("127.0.0.1", $Port)
    $c.Close()
    return $true
  } catch {
    return $false
  }
}

# --- 1. Unified Backend on :30000 ---
if (Test-Port 30000) {
  Write-Host "Unified Backend is already running on :30000" -ForegroundColor Green
} elseif (Test-Path (Join-Path $ArtcraftRoot "unified_server.py")) {
  Write-Host "Starting Unified Backend on :30000 ..." -ForegroundColor Cyan
  Start-Process -WorkingDirectory $MateRoot -FilePath "uv" -ArgumentList "run","python","..\unified_server.py" -WindowStyle Minimized
  Start-Sleep -Seconds 2
} else {
  Write-Host "WARNING: Unified backend unified_server.py not found at $ArtcraftRoot" -ForegroundColor Yellow
}

# --- 2. FreeLLMAPI Server on :3001 ---
$FreeLLMAPIRoot = Join-Path $ArtcraftRoot "frontend\apps\artcraft\app\src\pages\freellmapi\server"
if (Test-Port 3001) {
  Write-Host "FreeLLMAPI API already on :3001" -ForegroundColor Green
} elseif (Test-Path (Join-Path $FreeLLMAPIRoot "package.json")) {
  Write-Host "Starting FreeLLMAPI API on :3001 ..." -ForegroundColor Cyan
  $freeLlmLogDir = Join-Path $env:TEMP "artcraft-freellmapi"
  New-Item -ItemType Directory -Path $freeLlmLogDir -Force | Out-Null
  $freeLlmStdout = Join-Path $freeLlmLogDir "api.stdout.log"
  $freeLlmStderr = Join-Path $freeLlmLogDir "api.stderr.log"
  Remove-Item -LiteralPath $freeLlmStdout -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $freeLlmStderr -Force -ErrorAction SilentlyContinue

  $freeLlmProcess = Start-Process `
    -WorkingDirectory $FreeLLMAPIRoot `
    -FilePath "cmd.exe" `
    -ArgumentList "/c","pnpm","run","dev" `
    -RedirectStandardOutput $freeLlmStdout `
    -RedirectStandardError $freeLlmStderr `
    -WindowStyle Hidden `
    -PassThru

  Write-Host "FreeLLMAPI API started on :3001 (PID $($freeLlmProcess.Id))" -ForegroundColor Green
} else {
  Write-Host "WARNING: FreeLLMAPI server not found at $FreeLLMAPIRoot" -ForegroundColor Yellow
}

# --- 2.5. OmniRoute AI Router on :20128 ---
$OmniRouteRoot = Join-Path $ArtcraftRoot "frontend\apps\artcraft\app\src\pages\OmniRoute"
if (Test-Port 20128) {
  Write-Host "OmniRoute AI Router already running on :20128" -ForegroundColor Green
} elseif (Test-Path (Join-Path $OmniRouteRoot "package.json")) {
  Write-Host "Starting OmniRoute AI Router on :20128 ..." -ForegroundColor Cyan
  $omniLogDir = Join-Path $env:TEMP "artcraft-omniroute"
  New-Item -ItemType Directory -Path $omniLogDir -Force | Out-Null
  $omniStdout = Join-Path $omniLogDir "omniroute.stdout.log"
  $omniStderr = Join-Path $omniLogDir "omniroute.stderr.log"
  Remove-Item -LiteralPath $omniStdout -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $omniStderr -Force -ErrorAction SilentlyContinue

  $omniProcess = Start-Process `
    -WorkingDirectory $OmniRouteRoot `
    -FilePath "cmd.exe" `
    -ArgumentList "/c","npm","run","dev" `
    -RedirectStandardOutput $omniStdout `
    -RedirectStandardError $omniStderr `
    -WindowStyle Hidden `
    -PassThru

  Write-Host "OmniRoute AI Router started on :20128 (PID $($omniProcess.Id))" -ForegroundColor Green
} else {
  Write-Host "WARNING: OmniRoute not found at $OmniRouteRoot" -ForegroundColor Yellow
}

# --- 2.6. InkOS Story Studio (:4569 API & :4567 UI) ---
$InkOSRoot = Join-Path $ArtcraftRoot "inkos"
$InkOSStudioRoot = Join-Path $InkOSRoot "packages\studio"
if (Test-Path $InkOSStudioRoot) {
  if (Test-Port 4569) {
    Write-Host "InkOS API Server already running on :4569" -ForegroundColor Green
  } else {
    Write-Host "Starting InkOS API Server on :4569 ..." -ForegroundColor Cyan
    $inkosApiLogDir = Join-Path $env:TEMP "artcraft-inkos-api"
    New-Item -ItemType Directory -Path $inkosApiLogDir -Force | Out-Null
    $inkosApiStdout = Join-Path $inkosApiLogDir "api.stdout.log"
    $inkosApiStderr = Join-Path $inkosApiLogDir "api.stderr.log"
    Remove-Item -LiteralPath $inkosApiStdout -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $inkosApiStderr -Force -ErrorAction SilentlyContinue

    $inkosApiProcess = Start-Process `
      -WorkingDirectory $InkOSRoot `
      -FilePath "powershell.exe" `
      -ArgumentList "-Command", "`$env:INKOS_STUDIO_PORT='4569'; `$env:INKOS_PROJECT_ROOT='$InkOSRoot'; pnpm --filter @actalk/inkos-studio exec tsx watch src/api/index.ts" `
      -RedirectStandardOutput $inkosApiStdout `
      -RedirectStandardError $inkosApiStderr `
      -WindowStyle Hidden `
      -PassThru
    Write-Host "InkOS API Server started on :4569 (PID $($inkosApiProcess.Id))" -ForegroundColor Green
  }

  if (Test-Port 4567) {
    Write-Host "InkOS Client UI already running on :4567" -ForegroundColor Green
  } else {
    Write-Host "Starting InkOS Client UI on :4567 ..." -ForegroundColor Cyan
    $inkosUiLogDir = Join-Path $env:TEMP "artcraft-inkos-ui"
    New-Item -ItemType Directory -Path $inkosUiLogDir -Force | Out-Null
    $inkosUiStdout = Join-Path $inkosUiLogDir "ui.stdout.log"
    $inkosUiStderr = Join-Path $inkosUiLogDir "ui.stderr.log"
    Remove-Item -LiteralPath $inkosUiStdout -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $inkosUiStderr -Force -ErrorAction SilentlyContinue

    $inkosUiProcess = Start-Process `
      -WorkingDirectory $InkOSRoot `
      -FilePath "cmd.exe" `
      -ArgumentList "/c","pnpm","--filter","@actalk/inkos-studio","dev:client" `
      -RedirectStandardOutput $inkosUiStdout `
      -RedirectStandardError $inkosUiStderr `
      -WindowStyle Hidden `
      -PassThru
    Write-Host "InkOS Client UI started on :4567 (PID $($inkosUiProcess.Id))" -ForegroundColor Green
  }
}


# --- 3. Embedded Youwee dependencies ---
$YouweeManifest = Join-Path $YouweeRoot "Cargo.toml"
$YouweeBinDir = Join-Path $YouweeRoot "bin"
$YouweeYtDlp = Join-Path $YouweeBinDir "youwee-yt-dlp-x86_64-pc-windows-msvc.exe"
$ArtcraftDevYtDlp = Join-Path $ArtcraftRoot "target\debug\youwee-yt-dlp.exe"
$YouweeSdkRoot = Join-Path $ArtcraftRoot "frontend\apps\artcraft\app\src\pages\PageYouwee\sdk-js"
$TypeScriptCompiler = Join-Path $ArtcraftRoot "frontend\node_modules\.bin\tsc.cmd"

if (Test-Path $YouweeManifest) {
  if (Test-Path (Join-Path $YouweeSdkRoot "tsconfig.json")) {
    if (Test-Path $TypeScriptCompiler) {
      if (-not (Test-Path $YouweeYtDlp)) {
        Write-Host "Downloading Youwee yt-dlp sidecar ..." -ForegroundColor Cyan
        New-Item -ItemType Directory -Path $YouweeBinDir -Force | Out-Null
        try {
          Invoke-WebRequest -Uri "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -OutFile $YouweeYtDlp -UseBasicParsing
        } catch {
          if (Test-Path $YouweeYtDlp) { Remove-Item -LiteralPath $YouweeYtDlp -Force }
        }
      }
      Write-Host "Building Youwee JS SDK ..." -ForegroundColor Cyan
      & $TypeScriptCompiler -p (Join-Path $YouweeSdkRoot "tsconfig.json")
      New-Item -ItemType Directory -Path (Split-Path $ArtcraftDevYtDlp -Parent) -Force | Out-Null
      if (Test-Path $YouweeYtDlp) { Copy-Item -LiteralPath $YouweeYtDlp -Destination $ArtcraftDevYtDlp -Force }
    }
  }
}

# --- 4. Vite Frontend FE ---
Write-Host "Starting Vite FE (new window) ..." -ForegroundColor Cyan
Start-Process powershell -WorkingDirectory $ArtcraftRoot -ArgumentList @(
  "-NoExit", "-Command",
  ".\script\artcraft\windows_frontend_dev.ps1"
)

Start-Sleep -Seconds 3

# --- 5. Tauri App ---
Write-Host "Starting Tauri app (this window) ..." -ForegroundColor Cyan
$env:CAPCUT_MATE_DIR = $MateRoot
$env:CAPCUT_MATE_AUTO_START = "0"
Set-Location $ArtcraftRoot
& "$PSScriptRoot\windows_rust_dev.ps1"
