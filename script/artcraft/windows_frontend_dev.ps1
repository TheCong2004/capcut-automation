# This runs Artcraft Frontend in dev mode on Windows

Write-Host "Running Artcraft Frontend in Dev Mode..."
Write-Host ""
Write-Host "You'll need to launch the Rust dev server as a second script!"  -ForegroundColor red -BackgroundColor white
Write-Host ""

Push-Location -Path ".\frontend\apps\artcraft"

try
{
    Write-Host "Running Vite dev server..." -ForegroundColor Cyan
    pnpm run dev
}
finally
{
    Pop-Location
}
