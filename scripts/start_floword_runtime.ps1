# PowerShell Script to Start NEODONUT ENGINE Runtime Services cleanly
param (
    [switch]$SkipChrome = $false,
    [switch]$RequireAll = $false
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$pidsDir = ".runtime/pids"
$logsDir = ".runtime/logs"
$chromeProfileDir = ".runtime/chrome-cdp-profile"

if (-not (Test-Path $pidsDir)) { New-Item -ItemType Directory -Force -Path $pidsDir | Out-Null }
if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Force -Path $logsDir | Out-Null }
if (-not (Test-Path $chromeProfileDir)) { New-Item -ItemType Directory -Force -Path $chromeProfileDir | Out-Null }

Write-Host "[RUNTIME] Launching NEODONUT ENGINE Runtime Services from $repoRoot..." -ForegroundColor Cyan

# Track status of required services
$failedServices = @()

# Helper for starting background process
function Start-RuntimeProcess($name, $command, $argsStr, $workDir) {
    $stdoutFile = "$logsDir/$name.stdout.log"
    $stderrFile = "$logsDir/$name.stderr.log"
    
    $proc = Start-Process -FilePath $command -ArgumentList $argsStr -WorkingDirectory $workDir -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile -PassThru -NoNewWindow
    $proc.Id | Out-File "$pidsDir/$name.pid" -Force
    return $proc
}

# 1. CapCut Mate Backend (Required)
$capcutPort = 30000
$capcutConn = Get-NetTCPConnection -LocalPort $capcutPort -ErrorAction SilentlyContinue
if (-not $capcutConn) {
    Write-Host "[CAPCUT MATE] Starting service on port $capcutPort..." -ForegroundColor Yellow
    Start-RuntimeProcess "capcut-mate" "uvicorn" "main:app --host 127.0.0.1 --port 30000" "capcut-mate" | Out-Null
} else {
    Write-Host "[CAPCUT MATE] Already running on port $capcutPort." -ForegroundColor Green
}

# 2. Playwright CDP Sidecar (Required)
$sidecarPort = 9223
$sidecarConn = Get-NetTCPConnection -LocalPort $sidecarPort -ErrorAction SilentlyContinue
if (-not $sidecarConn) {
    Write-Host "[SIDECAR] Starting Playwright CDP Sidecar on port $sidecarPort..." -ForegroundColor Yellow
    Start-RuntimeProcess "playwright-sidecar" "node" "index.js" "tools/playwright-sidecar" | Out-Null
} else {
    Write-Host "[SIDECAR] Already running on port $sidecarPort." -ForegroundColor Green
}

# 3. Chrome Remote Debugging
if (-not $SkipChrome) {
    $cdpPort = 9222
    $cdpConn = Get-NetTCPConnection -LocalPort $cdpPort -ErrorAction SilentlyContinue
    if (-not $cdpConn) {
        $chromePaths = @(
            "C:\Program Files\Google\Chrome\Application\chrome.exe",
            "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
        )
        $chromeExe = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
        if ($chromeExe) {
            Write-Host "[CHROME CDP] Starting Chrome CDP Debugging on port $cdpPort..." -ForegroundColor Yellow
            $chromeArgs = "--remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --remote-allow-origins=* --user-data-dir=`"$repoRoot\$chromeProfileDir`" --no-first-run --no-default-browser-check --disable-background-mode about:blank"
            $chromeProc = Start-Process -FilePath $chromeExe -ArgumentList $chromeArgs -PassThru -NoNewWindow
            $chromeProc.Id | Out-File "$pidsDir/chrome-cdp.pid" -Force
        } else {
            Write-Host "[CHROME CDP] Executable not found in standard paths." -ForegroundColor Yellow
        }
    } else {
        Write-Host "[CHROME CDP] Already active on port $cdpPort." -ForegroundColor Green
    }
}

# Readiness verifier
function Verify-Service($url, $name, $isOptional = $false) {
    Start-Sleep -Milliseconds 800
    try {
        $res = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 2 -ErrorAction Stop
        Write-Host "[READY] $name is ONLINE at $url" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "[OFFLINE] $name failed health check at $url" -ForegroundColor Red
        if (Test-Path "$logsDir/$name.stderr.log") {
            $errSnippet = Get-Content "$logsDir/$name.stderr.log" -Tail 5 -ErrorAction SilentlyContinue
            if ($errSnippet) {
                Write-Host "  Stderr log: $errSnippet" -ForegroundColor DarkRed
            }
        }
        if (-not $isOptional) {
            $script:failedServices += $name
        }
        return $false
    }
}

Write-Host "[RUNTIME] Verifying Service Readiness..." -ForegroundColor Cyan
Verify-Service "http://127.0.0.1:30000/health" "capcut-mate" | Out-Null
Verify-Service "http://127.0.0.1:9223/health" "playwright-sidecar" | Out-Null
Verify-Service "http://127.0.0.1:20128/v1/models" "omniroute" $true | Out-Null
Verify-Service "http://127.0.0.1:8080/api/health" "mediacrawler" $true | Out-Null

if ($RequireAll -and $failedServices.Count -gt 0) {
    Write-Host "❌ [RUNTIME ERROR] Mandatory services failed health check: $($failedServices -join ', ')" -ForegroundColor Red
    exit 1
}

Write-Host "[RUNTIME] Launcher cycle complete." -ForegroundColor Green
exit 0
