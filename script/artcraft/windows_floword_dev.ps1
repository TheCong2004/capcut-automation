# Launch Standalone Floword Studio Application
# 1. CapCut Mate backend on :30000
# 2. Floword Studio Vite App on :5180

$ErrorActionPreference = "Stop"
$ArtcraftRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$MateRoot = Join-Path $ArtcraftRoot "capcut-mate"
$FlowordRoot = Join-Path $ArtcraftRoot "frontend\apps\artcraft\app\src\pages\FlowordStudio"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  FLOWORD STUDIO — CAPCUT WORKFLOW AUTOMATION" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Artcraft Root: $ArtcraftRoot"
Write-Host "CapCut Mate:   $MateRoot"
Write-Host "Floword Studio: $FlowordRoot"
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

# --- 1. Start CapCut Mate Backend on :30000 ---
if (Test-Port 30000) {
  Write-Host "[BE] CapCut Mate Backend is already running on :30000" -ForegroundColor Green
} elseif (Test-Path (Join-Path $ArtcraftRoot "unified_server.py")) {
  Write-Host "[BE] Starting CapCut Mate Backend on :30000 ..." -ForegroundColor Cyan
  Start-Process -WorkingDirectory $MateRoot -FilePath "uv" -ArgumentList "run","python","..\unified_server.py" -WindowStyle Minimized
  Start-Sleep -Seconds 2
} else {
  Write-Host "[WARNING] unified_server.py not found at $ArtcraftRoot" -ForegroundColor Yellow
}

# --- 2. Start Standalone Floword Studio Vite App on :5180 ---
Write-Host "[FE] Launching Floword Studio App on http://localhost:5180 ..." -ForegroundColor Cyan
Start-Process powershell -WorkingDirectory $FlowordRoot -ArgumentList @(
  "-NoExit", "-Command",
  "npm run dev"
)

Write-Host ""
Write-Host "✅ Floword Studio app launched successfully!" -ForegroundColor Green
Write-Host "🌐 Open in browser: http://localhost:5180" -ForegroundColor Yellow
