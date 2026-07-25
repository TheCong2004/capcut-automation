# Build and stage the MediaCrawler and OpenMontage production sidecars.

$ErrorActionPreference = "Stop"

$ArtcraftRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$ResourceRoot = Join-Path $ArtcraftRoot "crates\desktop\artcraft\resources"
$MediaCrawlerRoot = Join-Path $ArtcraftRoot "MediaCrawler-be"
$OpenMontageRoot = Join-Path $ArtcraftRoot "OpenMontage"
$MediaStage = Join-Path $ResourceRoot "media-crawler"
$OpenMontageStage = Join-Path $ResourceRoot "openmontage"
$MediaExe = Join-Path $MediaStage "media-crawler-server.exe"
$OpenMontageExe = Join-Path $OpenMontageStage "openmontage-server.exe"

if (-not (Get-Command "uv" -ErrorAction SilentlyContinue)) {
  throw "uv is required to build the Python backend sidecars."
}
if (-not (Test-Path (Join-Path $MediaCrawlerRoot "api\main.py"))) {
  throw "MediaCrawler backend not found: $MediaCrawlerRoot"
}
if (-not (Test-Path (Join-Path $OpenMontageRoot "backlot\sidecar.py"))) {
  throw "OpenMontage backend not found: $OpenMontageRoot"
}

New-Item -ItemType Directory -Path $MediaStage -Force | Out-Null
New-Item -ItemType Directory -Path $OpenMontageStage -Force | Out-Null

Write-Host "Building MediaCrawler sidecar..." -ForegroundColor Cyan
$mediaWork = Join-Path $MediaCrawlerRoot "build\pyinstaller-work"
$mediaSpec = Join-Path $MediaCrawlerRoot "build\pyinstaller-spec"
$mediaLibs = Join-Path $MediaCrawlerRoot "libs"
New-Item -ItemType Directory -Path $mediaWork -Force | Out-Null
New-Item -ItemType Directory -Path $mediaSpec -Force | Out-Null

Push-Location $MediaCrawlerRoot
try {
  & uv run --with pyinstaller pyinstaller `
    --noconfirm --clean --onefile `
    --name media-crawler-server `
    --distpath $MediaStage `
    --workpath $mediaWork `
    --specpath $mediaSpec `
    --hidden-import uvicorn.logging `
    --hidden-import uvicorn.loops.auto `
    --hidden-import uvicorn.protocols.http.auto `
    --hidden-import uvicorn.protocols.websockets.auto `
    --hidden-import uvicorn.lifespan.on `
    --collect-submodules api `
    --collect-submodules base `
    --collect-submodules cache `
    --collect-submodules cmd_arg `
    --collect-submodules config `
    --collect-submodules constant `
    --collect-submodules database `
    --collect-submodules media_platform `
    --collect-submodules model `
    --collect-submodules proxy `
    --collect-submodules store `
    --collect-submodules tools `
    --add-data "$mediaLibs;libs" `
    sidecar.py
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $MediaExe)) {
    throw "Failed to build MediaCrawler sidecar."
  }
  # Skipping Playwright Chromium staging (CDP / Donut Browser integration)
  $playwrightStage = Join-Path $MediaStage "ms-playwright"
  if (Test-Path $playwrightStage) {
    Remove-Item -LiteralPath $playwrightStage -Recurse -Force
  }
}
finally {
  Pop-Location
}

Write-Host "Building OpenMontage sidecar..." -ForegroundColor Cyan
$openWork = Join-Path $OpenMontageRoot "build\pyinstaller-work"
$openSpec = Join-Path $OpenMontageRoot "build\pyinstaller-spec"
$pipelineData = Join-Path $OpenMontageRoot "pipeline_defs"
$schemaData = Join-Path $OpenMontageRoot "schemas"
New-Item -ItemType Directory -Path $openWork -Force | Out-Null
New-Item -ItemType Directory -Path $openSpec -Force | Out-Null

Push-Location $OpenMontageRoot
try {
  & uv run --with-requirements requirements.txt --with pyinstaller pyinstaller `
    --noconfirm --clean --onefile `
    --name openmontage-server `
    --distpath $OpenMontageStage `
    --workpath $openWork `
    --specpath $openSpec `
    --hidden-import uvicorn.logging `
    --hidden-import uvicorn.loops.auto `
    --hidden-import uvicorn.protocols.http.auto `
    --hidden-import uvicorn.protocols.websockets.auto `
    --hidden-import uvicorn.lifespan.on `
    --collect-submodules backlot `
    --collect-submodules lib `
    --collect-submodules schemas `
    --add-data "$pipelineData;pipeline_defs" `
    --add-data "$schemaData;schemas" `
    backlot\sidecar.py
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $OpenMontageExe)) {
    throw "Failed to build OpenMontage sidecar."
  }
}
finally {
  Pop-Location
}

Write-Host "Auxiliary backend sidecars are ready:" -ForegroundColor Green
Write-Host "  $MediaExe"
Write-Host "  $OpenMontageExe"
