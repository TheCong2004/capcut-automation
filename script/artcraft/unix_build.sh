#!/usr/bin/env bash
# This works on Linux and MacOS to build production Artcraft

set -euxo pipefail

echo "Building production Artcraft..."
echo ""

root_dir=$(pwd)
frontend_path="${root_dir}/frontend"
rust_crate_path="${root_dir}/crates/desktop/artcraft"

# The tauri dev server integration is super annoying: It eats ctrl-c interrupts,
# it decoheres the and corrupts terminal output, and it's slow. This configuration
# allows us to start without it. Simply launch `nx` and the dev server as a separate
# process and leave tauri out of the loop
config_path="${rust_crate_path}/tauri.artcraft_3d.no_dev.conf.json"

pushd "${frontend_path}" || exit

npm install --verbose

popd || exit

export TAURI_FRONTEND_PATH="${frontend_path}"
export TAURI_APP_PATH="${rust_crate_path}"

# NB: The "frontend dev" script sets "production" too, so this must only control the
# hostnames we use, not minification, etc.
export VITE_ENVIRONMENT_TYPE="production"

# This appears to trigger "nx build" instead of "nx dev".
cargo tauri build --config "${config_path}"

echo "Done!"

date "+Finished on %A, %B %e - %H:%M:%S (local timezone)"

