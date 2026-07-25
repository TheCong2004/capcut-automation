# Start CapCut Automation stack for desktop:
#   1) capcut-mate BE :30000 (if not already up)
#   2) Vite FE :5173
#   3) Tauri shell (window) — also auto-spawns BE if free
#
# Usage (from artcraft repo root):
#   .\script\artcraft\windows_capcut_dev.ps1

$ErrorActionPreference = "Stop"
$ArtcraftRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not (Test-Path (Join-Path $ArtcraftRoot "Cargo.toml"))) {
  # script/artcraft → artcraft
  $ArtcraftRoot = Split-Path $PSScriptRoot -Parent
  $ArtcraftRoot = Split-Path $ArtcraftRoot -Parent
}
# Prefer: d:\capcutpolot\artcraft when script is artcraft\script\artcraft\
$ArtcraftRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
# monorepo: artcraft/capcut-mate (not parent of artcraft)
$MateRoot = Join-Path $ArtcraftRoot "capcut-mate"
$YouweeRoot = Join-Path $ArtcraftRoot "be-youwee"
$MediaCrawlerRoot = Join-Path $ArtcraftRoot "MediaCrawler-be"
$OpenMontageRoot = Join-Path $ArtcraftRoot "OpenMontage"
if (-not (Test-Path (Join-Path $MateRoot "main.py"))) {
  $alt = Join-Path (Split-Path $ArtcraftRoot -Parent) "capcut-mate"
  if (Test-Path (Join-Path $alt "main.py")) { $MateRoot = $alt }
}

Write-Host "Artcraft: $ArtcraftRoot"
Write-Host "capcut-mate: $MateRoot"
Write-Host "be-youwee: $YouweeRoot"
Write-Host "MediaCrawler-be: $MediaCrawlerRoot"
Write-Host "OpenMontage: $OpenMontageRoot"
Write-Host ""
Write-Host "Note: Tauri does NOT auto-spawn BE in dev (only packaged .exe does)." -ForegroundColor DarkGray
Write-Host "This script starts BE in a separate process like: cd capcut-mate; uv run main.py" -ForegroundColor DarkGray
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

# --- BE (manual process — same as `cd capcut-mate; uv run main.py`) ---
# --- OpenMontage API ---
if (Test-Port 4750) {
  Write-Host "OpenMontage API already on :4750" -ForegroundColor Green
} elseif (Test-Path (Join-Path $OpenMontageRoot "backlot\server.py")) {
  if (-not (Get-Command "uv" -ErrorAction SilentlyContinue)) {
    throw "uv is required to run OpenMontage. Install uv and run the script again."
  }
  Write-Host "Starting OpenMontage API on :4750 ..." -ForegroundColor Cyan
  $openMontageLogDir = Join-Path $env:TEMP "artcraft-openmontage"
  New-Item -ItemType Directory -Path $openMontageLogDir -Force | Out-Null
  $openMontageStdout = Join-Path $openMontageLogDir "api.stdout.log"
  $openMontageStderr = Join-Path $openMontageLogDir "api.stderr.log"
  Remove-Item -LiteralPath $openMontageStdout -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $openMontageStderr -Force -ErrorAction SilentlyContinue

  $openMontageProcess = Start-Process `
    -WorkingDirectory $OpenMontageRoot `
    -FilePath "uv" `
    -ArgumentList "run","--with-requirements","requirements.txt","python","-m","backlot","serve","--port","4750" `
    -RedirectStandardOutput $openMontageStdout `
    -RedirectStandardError $openMontageStderr `
    -WindowStyle Hidden `
    -PassThru

  $openMontageReady = $false
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    Start-Sleep -Milliseconds 500
    if ($openMontageProcess.HasExited) {
      $openMontageError = if (Test-Path $openMontageStderr) {
        Get-Content -LiteralPath $openMontageStderr -Raw
      } else {
        "No error log was produced."
      }
      throw "OpenMontage API exited early (code $($openMontageProcess.ExitCode)).`n$openMontageError"
    }
    if (Test-Port 4750) {
      $openMontageReady = $true
      break
    }
  }
  if (-not $openMontageReady) {
    throw "OpenMontage API did not start on port 4750."
  }
  Write-Host "OpenMontage API is ready on :4750 (PID $($openMontageProcess.Id))" -ForegroundColor Green
  Write-Host "OpenMontage logs: $openMontageStdout" -ForegroundColor DarkGray
  Write-Host "OpenMontage errors: $openMontageStderr" -ForegroundColor DarkGray
} else {
  Write-Host "WARNING: OpenMontage backend not found at $OpenMontageRoot" -ForegroundColor Yellow
}

if (Test-Port 30000) {
  Write-Host "BE already on :30000" -ForegroundColor Green
} elseif (Test-Path (Join-Path $MateRoot "main.py")) {
  Write-Host "Starting capcut-mate on :30000 (separate window) ..." -ForegroundColor Cyan
  Start-Process -WorkingDirectory $MateRoot -FilePath "uv" -ArgumentList "run","main.py" -WindowStyle Minimized
  Start-Sleep -Seconds 2
} else {
  Write-Host "WARNING: capcut-mate not found at $MateRoot" -ForegroundColor Yellow
}

# --- MediaCrawler API ---
if (Test-Port 8080) {
  Write-Host "MediaCrawler API already on :8080" -ForegroundColor Green
} elseif (Test-Path (Join-Path $MediaCrawlerRoot "api\main.py")) {
  if (-not (Get-Command "uv" -ErrorAction SilentlyContinue)) {
    throw "uv is required to run MediaCrawler-be. Install uv and run the script again."
  }
  Write-Host "Starting MediaCrawler API on :8080 ..." -ForegroundColor Cyan
  $mediaCrawlerLogDir = Join-Path $env:TEMP "artcraft-mediacrawler"
  New-Item -ItemType Directory -Path $mediaCrawlerLogDir -Force | Out-Null
  $mediaCrawlerStdout = Join-Path $mediaCrawlerLogDir "api.stdout.log"
  $mediaCrawlerStderr = Join-Path $mediaCrawlerLogDir "api.stderr.log"
  Remove-Item -LiteralPath $mediaCrawlerStdout -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $mediaCrawlerStderr -Force -ErrorAction SilentlyContinue

  $mediaCrawlerProcess = Start-Process `
    -WorkingDirectory $MediaCrawlerRoot `
    -FilePath "uv" `
    -ArgumentList "run","uvicorn","api.main:app","--host","127.0.0.1","--port","8080" `
    -RedirectStandardOutput $mediaCrawlerStdout `
    -RedirectStandardError $mediaCrawlerStderr `
    -WindowStyle Hidden `
    -PassThru

  $mediaCrawlerReady = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 500
    if ($mediaCrawlerProcess.HasExited) {
      $mediaCrawlerError = if (Test-Path $mediaCrawlerStderr) {
        Get-Content -LiteralPath $mediaCrawlerStderr -Raw
      } else {
        "No error log was produced."
      }
      throw "MediaCrawler API exited early (code $($mediaCrawlerProcess.ExitCode)).`n$mediaCrawlerError"
    }
    if (Test-Port 8080) {
      $mediaCrawlerReady = $true
      break
    }
  }
  if (-not $mediaCrawlerReady) {
    throw "MediaCrawler API did not start on port 8080."
  }
  Write-Host "MediaCrawler API is ready on :8080 (PID $($mediaCrawlerProcess.Id))" -ForegroundColor Green
  Write-Host "MediaCrawler logs: $mediaCrawlerStdout" -ForegroundColor DarkGray
  Write-Host "MediaCrawler errors: $mediaCrawlerStderr" -ForegroundColor DarkGray
} else {
  Write-Host "WARNING: MediaCrawler-be not found at $MediaCrawlerRoot" -ForegroundColor Yellow
}

# --- Embedded Youwee backend dependencies ---
$YouweeManifest = Join-Path $YouweeRoot "Cargo.toml"
$YouweeBinDir = Join-Path $YouweeRoot "bin"
$YouweeYtDlp = Join-Path $YouweeBinDir "youwee-yt-dlp-x86_64-pc-windows-msvc.exe"
$ArtcraftDevYtDlp = Join-Path $ArtcraftRoot "target\debug\youwee-yt-dlp.exe"
$YouweeSdkRoot = Join-Path $ArtcraftRoot "frontend\apps\artcraft\app\src\pages\PageYouwee\sdk-js"
$TypeScriptCompiler = Join-Path $ArtcraftRoot "frontend\node_modules\.bin\tsc.cmd"

if (-not (Test-Path $YouweeManifest)) {
  throw "Youwee backend manifest not found: $YouweeManifest"
}
if (-not (Test-Path (Join-Path $YouweeSdkRoot "tsconfig.json"))) {
  throw "Youwee SDK source not found: $YouweeSdkRoot"
}
if (-not (Test-Path $TypeScriptCompiler)) {
  throw "TypeScript compiler not found: $TypeScriptCompiler. Run npm install in frontend first."
}

if (-not (Test-Path $YouweeYtDlp)) {
  Write-Host "Downloading the Youwee yt-dlp sidecar ..." -ForegroundColor Cyan
  New-Item -ItemType Directory -Path $YouweeBinDir -Force | Out-Null
  try {
    Invoke-WebRequest `
      -Uri "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" `
      -OutFile $YouweeYtDlp `
      -UseBasicParsing
  } catch {
    if (Test-Path $YouweeYtDlp) {
      Remove-Item -LiteralPath $YouweeYtDlp -Force
    }
    throw "Failed to download the Youwee yt-dlp sidecar: $($_.Exception.Message)"
  }
}

Write-Host "Building Youwee JavaScript SDK ..." -ForegroundColor Cyan
& $TypeScriptCompiler -p (Join-Path $YouweeSdkRoot "tsconfig.json")
if ($LASTEXITCODE -ne 0) {
  throw "Failed to build Youwee JavaScript SDK (exit code $LASTEXITCODE)."
}

New-Item -ItemType Directory -Path (Split-Path $ArtcraftDevYtDlp -Parent) -Force | Out-Null
Copy-Item -LiteralPath $YouweeYtDlp -Destination $ArtcraftDevYtDlp -Force
Write-Host "Youwee backend is embedded in Artcraft; yt-dlp staged for dev." -ForegroundColor Green

# --- FE ---
Write-Host "Starting Vite FE (new window) ..." -ForegroundColor Cyan
Start-Process powershell -WorkingDirectory $ArtcraftRoot -ArgumentList @(
  "-NoExit", "-Command",
  ".\script\artcraft\windows_frontend_dev.ps1"
)

Start-Sleep -Seconds 3

# --- Tauri (reuse existing BE; do not double-spawn from app) ---
Write-Host "Starting Tauri app (this window) ..." -ForegroundColor Cyan
$env:CAPCUT_MATE_DIR = $MateRoot
# 0 = app won't spawn BE; we already started it above (or user did)
$env:CAPCUT_MATE_AUTO_START = "0"
Set-Location $ArtcraftRoot
& "$PSScriptRoot\windows_rust_dev.ps1"
