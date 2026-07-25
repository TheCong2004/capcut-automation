# This runs Artcraft Rust in dev mode on Windows

Write-Host "Running Artcraft Rust in Dev Mode..."
Write-Host ""
Write-Host "You'll need to launch the frontend dev server as a second script!"  -ForegroundColor red -BackgroundColor white
Write-Host ""

# boring-sys2 / bindgen need libclang.dll (LLVM). Prefer an existing LIBCLANG_PATH,
# otherwise fall back to the standard LLVM install location.
if (-not $env:LIBCLANG_PATH) {
  $defaultLibclang = "C:\Program Files\LLVM\bin"
  if (Test-Path (Join-Path $defaultLibclang "libclang.dll")) {
    $env:LIBCLANG_PATH = $defaultLibclang
    Write-Host "LIBCLANG_PATH set to $defaultLibclang"
  } else {
    Write-Host "WARNING: libclang.dll not found. Install LLVM (winget install LLVM.LLVM) and set LIBCLANG_PATH." -ForegroundColor Yellow
  }
}

# This tells Tauri *which* frontend and *which* Rust app to use since we're in a monorepo with several apps.
$env:TAURI_FRONTEND_PATH=".\frontend"
$env:TAURI_APP_PATH=".\crates\desktop\artcraft"

# Put SQLx into offline mode (no DB hits / migrations).
$env:SQLX_OFFLINE = "true"

# The config file tells Tauri more instructions for the frontend build.
cargo tauri dev --config ".\crates\desktop\artcraft\tauri-dev-hot-reload.conf.json"
