# PowerShell Script to stop runtime services launched by start_floword_runtime.ps1
$logsDir = ".runtime/pids"

Write-Host "[RUNTIME] Stopping NEODONUT ENGINE Launched Runtime Services..." -ForegroundColor Yellow

$pidFiles = Get-ChildItem -Path $logsDir -Filter "*.pid" -ErrorAction SilentlyContinue
foreach ($file in $pidFiles) {
    $procId = Get-Content $file.FullName
    if ($procId) {
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "Stopping Process ID $procId ($($proc.ProcessName))..." -ForegroundColor Red
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    }
    Remove-Item $file.FullName -Force -ErrorAction SilentlyContinue
}

Write-Host "[RUNTIME] Cleanup completed cleanly." -ForegroundColor Green
exit 0
