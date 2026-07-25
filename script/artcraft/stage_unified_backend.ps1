# Stage and build unified Python backend (artcraft-server.exe) for packaging.
# Merges CapCutMate, OpenMontage, and MediaCrawler into a single 50MB sidecar.

$ErrorActionPreference = "Stop"

$ArtcraftRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$StageRoot = Join-Path $ArtcraftRoot "crates\desktop\artcraft\resources"
$SidecarOut = Join-Path $StageRoot "artcraft-server.exe"

$CapcutMateRoot = Join-Path $ArtcraftRoot "capcut-mate"
$OpenMontageRoot = Join-Path $ArtcraftRoot "OpenMontage"
$MediaCrawlerRoot = Join-Path $ArtcraftRoot "MediaCrawler-be"

if (-not (Test-Path (Join-Path $ArtcraftRoot "unified_server.py"))) {
  throw "unified_server.py not found at $ArtcraftRoot"
}

New-Item -ItemType Directory -Path $StageRoot -Force | Out-Null

# Stage resource subfolders for Tauri bundle compatibility
$StageMate = Join-Path $StageRoot "capcut-mate"
$StageMedia = Join-Path $StageRoot "media-crawler"
$StageOpen = Join-Path $StageRoot "openmontage"

New-Item -ItemType Directory -Path $StageMate -Force | Out-Null
New-Item -ItemType Directory -Path $StageMedia -Force | Out-Null
New-Item -ItemType Directory -Path $StageOpen -Force | Out-Null

Write-Host "Building Unified Backend sidecar (PyInstaller)..." -ForegroundColor Cyan

Push-Location $ArtcraftRoot
try {
  $capcutDeps = @(
    "pyinstaller",
    "email-validator",
    "fastapi",
    "pymediainfo",
    "requests",
    "uvicorn[standard]",
    "cos-python-sdk-v5",
    "oss2",
    "imageio",
    "pywin32",
    "pyautogui",
    "uiautomation",
    "jsonschema",
    "pyyaml",
    "python-dotenv",
    "pillow",
    "numpy"
  )
  $withArgs = @()
  foreach ($pkg in $capcutDeps) {
    $withArgs += "--with"
    $withArgs += $pkg
  }
  $withArgs += "--with-requirements"
  $withArgs += "$OpenMontageRoot\requirements.txt"
  $withArgs += "--with-requirements"
  $withArgs += "$MediaCrawlerRoot\requirements.txt"

  & uv run @withArgs pyinstaller `
    --noconfirm --clean --onefile --noconsole `
    --name artcraft-server `
    --distpath $StageRoot `
    --workpath (Join-Path $ArtcraftRoot "build\pyinstaller-work") `
    --specpath (Join-Path $ArtcraftRoot "build\pyinstaller-spec") `
    --paths $CapcutMateRoot `
    --paths $OpenMontageRoot `
    --paths $MediaCrawlerRoot `
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
    --hidden-import main `
    --hidden-import config `
    --hidden-import sqlite3 `
    --hidden-import httpx `
    --hidden-import aiofiles `
    --hidden-import pymediainfo `
    --hidden-import jsonschema `
    --hidden-import yaml `
    --hidden-import dotenv `
    --hidden-import PIL `
    --hidden-import email_validator `
    --hidden-import requests `
    --hidden-import imageio `
    --collect-all main `
    --collect-all backlot `
    --collect-all api `
    --collect-submodules src `
    --collect-submodules core `
    --collect-submodules lib `
    --collect-submodules schemas `
    --collect-submodules base `
    --collect-submodules cache `
    --collect-submodules cmd_arg `
    --collect-submodules constant `
    --collect-submodules database `
    --collect-submodules media_platform `
    --collect-submodules model `
    --collect-submodules proxy `
    --collect-submodules store `
    --collect-submodules tools `
    --add-data "$CapcutMateRoot\config;config" `
    --add-data "$CapcutMateRoot\template;template" `
    --add-data "$OpenMontageRoot\pipeline_defs;pipeline_defs" `
    --add-data "$OpenMontageRoot\schemas;schemas" `
    --add-data "$MediaCrawlerRoot\libs;libs" `
    unified_server.py

  if (($LASTEXITCODE -eq 0) -and (Test-Path $SidecarOut)) {
    Write-Host "Unified Sidecar OK: $SidecarOut" -ForegroundColor Green
    # Also copy sidecar into capcut-mate resource folder for backwards lookup fallback
    Copy-Item $SidecarOut -Destination (Join-Path $StageMate "capcut-mate-server.exe") -Force
    Copy-Item $SidecarOut -Destination (Join-Path $StageOpen "openmontage-server.exe") -Force
    Copy-Item $SidecarOut -Destination (Join-Path $StageMedia "media-crawler-server.exe") -Force
  } else {
    Write-Host "WARNING: Unified PyInstaller build failed." -ForegroundColor Yellow
  }
} finally {
  Pop-Location
}

Write-Host "Unified Staging Complete." -ForegroundColor Green
