# Stage capcut-mate into Tauri resources for packaging.
# Called by windows_build.ps1 - can also run alone:
#   .\script\artcraft\stage_capcut_mate.ps1

$ErrorActionPreference = "Stop"

$ArtcraftRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$MateSrc = Join-Path $ArtcraftRoot "capcut-mate"
$StageRoot = Join-Path $ArtcraftRoot "crates\desktop\artcraft\resources"
$StageMate = Join-Path $StageRoot "capcut-mate"
$SidecarOut = Join-Path $StageRoot "capcut-mate-server.exe"

if (-not (Test-Path (Join-Path $MateSrc "main.py"))) {
  throw "capcut-mate not found at $MateSrc"
}

Write-Host "Staging capcut-mate -> $StageMate" -ForegroundColor Cyan

if (Test-Path $StageMate) {
  Remove-Item -Recurse -Force $StageMate
}
New-Item -ItemType Directory -Path $StageMate -Force | Out-Null

# Copy source tree (skip heavy/dev junk)
$excludeDirs = @(
  ".git", ".venv", "venv", "__pycache__", ".pytest_cache", ".mypy_cache",
  "node_modules", "desktop-client", "logs", "temp", "output", "db",
  "build", "dist", ".ruff_cache", "htmlcov"
)

Get-ChildItem -Path $MateSrc -Force | ForEach-Object {
  $name = $_.Name
  if ($excludeDirs -contains $name) { return }
  if ($name -eq "uv.lock") {
    Copy-Item $_.FullName -Destination $StageMate -Force
    return
  }
  if ($_.PSIsContainer) {
    Copy-Item $_.FullName -Destination (Join-Path $StageMate $name) -Recurse -Force
  } else {
    Copy-Item $_.FullName -Destination $StageMate -Force
  }
}

# Strip nested caches after copy
Get-ChildItem -Path $StageMate -Recurse -Directory -Filter "__pycache__" -ErrorAction SilentlyContinue |
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path $StageMate -Recurse -Directory -Filter "tests" -ErrorAction SilentlyContinue |
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# Launcher for manual debug next to staged folder
$launcher = @'
@echo off
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" main.py
  exit /b %ERRORLEVEL%
)
where uv >nul 2>&1 && (
  uv run main.py
  exit /b %ERRORLEVEL%
)
python main.py
'@
Set-Content -Path (Join-Path $StageMate "run_be.cmd") -Value $launcher -Encoding ASCII

# Optional: freeze sidecar with PyInstaller (portable, no uv on target PC)
$BuildSidecar = $env:CAPCUT_BUILD_SIDECAR
if (-not $BuildSidecar) { $BuildSidecar = "1" }

if ($BuildSidecar -eq "1") {
  Write-Host "Building BE sidecar (PyInstaller)..." -ForegroundColor Cyan
  try {
    Push-Location $MateSrc

    & uv run --with pyinstaller python -c "import PyInstaller; print(PyInstaller.__version__)" 2>$null
    if ($LASTEXITCODE -ne 0) {
      & uv pip install pyinstaller
    }

    $work = Join-Path $MateSrc "build\pyinstaller-work"
    $specDir = Join-Path $MateSrc "build\pyinstaller-spec"
    New-Item -ItemType Directory -Path $work -Force | Out-Null
    New-Item -ItemType Directory -Path $specDir -Force | Out-Null

    & uv run --with pyinstaller pyinstaller `
      --noconfirm --clean --onefile `
      --name capcut-mate-server `
      --distpath $StageRoot `
      --workpath $work `
      --specpath $specDir `
      --hidden-import uvicorn `
      --hidden-import uvicorn.logging `
      --hidden-import uvicorn.loops `
      --hidden-import uvicorn.loops.auto `
      --hidden-import uvicorn.protocols `
      --hidden-import uvicorn.protocols.http `
      --hidden-import uvicorn.protocols.http.auto `
      --hidden-import uvicorn.protocols.websockets `
      --hidden-import uvicorn.protocols.websockets.auto `
      --hidden-import uvicorn.lifespan `
      --hidden-import uvicorn.lifespan.on `
      --hidden-import fastapi `
      --hidden-import multipart `
      --hidden-import config `
      --hidden-import sqlite3 `
      --hidden-import httpx `
      --hidden-import aiofiles `
      --collect-submodules src `
      --collect-submodules core `
      --add-data "config;config" `
      --add-data "template;template" `
      main.py

    if (($LASTEXITCODE -eq 0) -and (Test-Path $SidecarOut)) {
      Write-Host "Sidecar OK: $SidecarOut" -ForegroundColor Green
      Copy-Item $SidecarOut -Destination (Join-Path $StageMate "capcut-mate-server.exe") -Force
    } else {
      Write-Host "WARNING: PyInstaller sidecar failed - package will use source + uv/python on target." -ForegroundColor Yellow
    }
  } catch {
    Write-Host "WARNING: sidecar build error: $_" -ForegroundColor Yellow
  } finally {
    Pop-Location
  }
} else {
  Write-Host "Skip sidecar (CAPCUT_BUILD_SIDECAR=0). Staged source only." -ForegroundColor Yellow
}

Write-Host "Stage done." -ForegroundColor Green
Write-Host "  Folder : $StageMate"
if (Test-Path $SidecarOut) {
  Write-Host "  Sidecar: $SidecarOut"
}
