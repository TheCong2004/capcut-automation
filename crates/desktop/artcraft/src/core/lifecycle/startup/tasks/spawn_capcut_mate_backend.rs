//! Start capcut-mate (Python BE) as a child process of the Tauri app.
//!
//! **When it auto-starts**
//! - **Packaged Tauri** (sidecar or `capcut-mate/` next to exe / in resources): yes
//! - **Dev / repo checkout**: **no** — run BE yourself:
//!   `cd capcut-mate` then `uv run main.py`
//! - Force dev auto-start: `CAPCUT_MATE_AUTO_START=1` (+ optional `CAPCUT_MATE_DIR`)
//! - Force off everywhere: `CAPCUT_MATE_AUTO_START=0`
//!
//! Lookup order when starting:
//! 1. Sidecar `capcut-mate-server.exe` (resources / next to app exe)
//! 2. Bundled folder `capcut-mate/` (resources / next to app exe)
//! 3. Env `CAPCUT_MATE_DIR` or repo layouts (dev, only if AUTO_START=1)

use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use log::{info, warn};
use tauri::{AppHandle, Manager};

const DEFAULT_PORT: u16 = 30000;
const SIDECAR_NAME: &str = "capcut-mate-server.exe";
const MATE_DIR_NAME: &str = "capcut-mate";

/// Managed Tauri state — killed when app process exits (Drop).
pub struct CapcutMateProcess {
  child: Mutex<Option<Child>>,
}

impl Drop for CapcutMateProcess {
  fn drop(&mut self) {
    if let Ok(mut guard) = self.child.lock() {
      if let Some(mut child) = guard.take() {
        info!("Stopping embedded capcut-mate (pid={:?})", child.id());
        let _ = child.kill();
        let _ = child.wait();
      }
    }
  }
}

fn port_open(port: u16) -> bool {
  let addr: std::net::SocketAddr = match format!("127.0.0.1:{port}").parse() {
    Ok(a) => a,
    Err(_) => return false,
  };
  TcpStream::connect_timeout(&addr, Duration::from_millis(200)).is_ok()
}

fn is_mate_dir(p: &Path) -> bool {
  p.is_dir() && p.join("main.py").is_file()
}

fn exe_dir() -> Option<PathBuf> {
  std::env::current_exe()
    .ok()
    .and_then(|p| p.parent().map(|d| d.to_path_buf()))
}

fn resource_dir(app: &AppHandle) -> Option<PathBuf> {
  app.path().resource_dir().ok()
}

fn push_if(paths: &mut Vec<PathBuf>, p: PathBuf) {
  if !paths.iter().any(|x| x == &p) {
    paths.push(p);
  }
}

/// Prefer frozen sidecar next to app / in resources.
fn resolve_sidecar(app: &AppHandle) -> Option<PathBuf> {
  let mut candidates: Vec<PathBuf> = Vec::new();

  if let Ok(p) = std::env::var("CAPCUT_MATE_SIDECAR") {
    push_if(&mut candidates, PathBuf::from(p));
  }
  if let Some(dir) = exe_dir() {
    push_if(&mut candidates, dir.join(SIDECAR_NAME));
    push_if(&mut candidates, dir.join(MATE_DIR_NAME).join(SIDECAR_NAME));
  }
  if let Some(res) = resource_dir(app) {
    push_if(&mut candidates, res.join(SIDECAR_NAME));
    push_if(&mut candidates, res.join(MATE_DIR_NAME).join(SIDECAR_NAME));
  }

  for c in candidates {
    if c.is_file() {
      return Some(c);
    }
  }
  None
}

fn resolve_mate_dir(app: &AppHandle) -> Option<PathBuf> {
  if let Ok(p) = std::env::var("CAPCUT_MATE_DIR") {
    let pb = PathBuf::from(p);
    if is_mate_dir(&pb) {
      return Some(pb);
    }
    warn!("CAPCUT_MATE_DIR is not a valid mate dir: {}", pb.display());
  }

  let mut candidates: Vec<PathBuf> = Vec::new();

  // Bundled with installed / portable app
  if let Some(dir) = exe_dir() {
    push_if(&mut candidates, dir.join(MATE_DIR_NAME));
    push_if(&mut candidates, dir.join("resources").join(MATE_DIR_NAME));
    if let Some(parent) = dir.parent() {
      push_if(&mut candidates, parent.join(MATE_DIR_NAME));
    }
  }
  if let Some(res) = resource_dir(app) {
    push_if(&mut candidates, res.join(MATE_DIR_NAME));
    push_if(&mut candidates, res.clone());
  }

  // Repo / compile-time layout (dev + build machine)
  let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
  push_if(&mut candidates, manifest.join("../../../capcut-mate"));
  push_if(&mut candidates, manifest.join("../../../../capcut-mate"));
  push_if(&mut candidates, manifest.join(MATE_DIR_NAME));
  push_if(
    &mut candidates,
    manifest.join("resources").join(MATE_DIR_NAME),
  );

  if let Ok(cwd) = std::env::current_dir() {
    push_if(&mut candidates, cwd.join(MATE_DIR_NAME));
    push_if(&mut candidates, cwd.join("artcraft").join(MATE_DIR_NAME));
  }

  for c in candidates {
    if let Ok(c) = c.canonicalize() {
      if is_mate_dir(&c) {
        return Some(c);
      }
    } else if is_mate_dir(&c) {
      return Some(c);
    }
  }
  None
}

fn spawn_sidecar(exe: &Path) -> Result<Child, String> {
  Command::new(exe)
    .current_dir(exe.parent().unwrap_or_else(|| Path::new(".")))
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .spawn()
    .map_err(|e| format!("Failed to spawn sidecar {}: {e}", exe.display()))
}

fn spawn_mate_from_dir(dir: &Path) -> Result<Child, String> {
  // Portable venv shipped next to source (build may copy .venv)
  let venv_py = dir.join(".venv").join("Scripts").join("python.exe");
  if venv_py.is_file() {
    match Command::new(&venv_py)
      .arg("main.py")
      .current_dir(dir)
      .stdin(Stdio::null())
      .stdout(Stdio::null())
      .stderr(Stdio::null())
      .spawn()
    {
      Ok(c) => return Ok(c),
      Err(e) => warn!("venv python failed: {e}"),
    }
  }

  // Prefer uv (project uses uv run main.py)
  if let Ok(child) = Command::new("uv")
    .args(["run", "main.py"])
    .current_dir(dir)
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .spawn()
  {
    return Ok(child);
  }

  // Fallback: system python
  Command::new("python")
    .arg("main.py")
    .current_dir(dir)
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .spawn()
    .or_else(|_| {
      Command::new("python3")
        .arg("main.py")
        .current_dir(dir)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    })
    .map_err(|e| format!("Failed to spawn capcut-mate from {}: {e}", dir.display()))
}

fn env_auto_start() -> Option<bool> {
  match std::env::var("CAPCUT_MATE_AUTO_START") {
    Ok(v) => {
      let v = v.to_ascii_lowercase();
      match v.as_str() {
        "0" | "false" | "no" | "off" => Some(false),
        "1" | "true" | "yes" | "on" => Some(true),
        _ => None,
      }
    }
    Err(_) => None,
  }
}

/// True if `dir` is next to the installed app / Tauri resources (not monorepo source).
fn is_packaged_mate_dir(app: &AppHandle, dir: &Path) -> bool {
  let dir_canon = dir.canonicalize().unwrap_or_else(|_| dir.to_path_buf());

  let mut roots: Vec<PathBuf> = Vec::new();
  if let Some(exe) = exe_dir() {
    push_if(&mut roots, exe.clone());
    push_if(&mut roots, exe.join("resources"));
    if let Some(parent) = exe.parent() {
      push_if(&mut roots, parent.to_path_buf());
    }
  }
  if let Some(res) = resource_dir(app) {
    push_if(&mut roots, res);
  }

  for root in roots {
    let root_canon = root.canonicalize().unwrap_or(root);
    if dir_canon.starts_with(&root_canon) {
      return true;
    }
  }
  false
}

fn manage_empty(app: &AppHandle) {
  app.manage(CapcutMateProcess {
    child: Mutex::new(None),
  });
}

/// Call from Tauri setup. Never fails startup of the whole app.
pub fn spawn_capcut_mate_backend(app: &AppHandle) {
  // Explicit off
  if env_auto_start() == Some(false) {
    info!("CAPCUT_MATE_AUTO_START=0 — BE not started (run capcut-mate manually if needed)");
    manage_empty(app);
    return;
  }

  if port_open(DEFAULT_PORT) {
    info!("capcut-mate already listening on :{DEFAULT_PORT} — reuse (no spawn)");
    manage_empty(app);
    return;
  }

  let force_dev = env_auto_start() == Some(true);

  // 1) Frozen sidecar — only present on packaged builds (or CAPCUT_MATE_SIDECAR)
  if let Some(sidecar) = resolve_sidecar(app) {
    match spawn_sidecar(&sidecar) {
      Ok(child) => {
        info!(
          "Started capcut-mate sidecar {} (pid={}) [packaged]",
          sidecar.display(),
          child.id()
        );
        app.manage(CapcutMateProcess {
          child: Mutex::new(Some(child)),
        });
        std::thread::sleep(Duration::from_millis(1200));
        return;
      }
      Err(e) => warn!("{e}"),
    }
  }

  // 2) Folder + uv|python|.venv
  let Some(dir) = resolve_mate_dir(app) else {
    if force_dev {
      warn!(
        "CAPCUT_MATE_AUTO_START=1 but capcut-mate not found. Set CAPCUT_MATE_DIR or run: cd capcut-mate; uv run main.py"
      );
    } else {
      info!(
        "Dev mode: capcut-mate BE not auto-started. For CapCut Automation run: cd capcut-mate; uv run main.py (or build packaged app)"
      );
    }
    manage_empty(app);
    return;
  };

  // Packaged layout always starts; repo/source only with CAPCUT_MATE_AUTO_START=1
  if !force_dev && !is_packaged_mate_dir(app, &dir) {
    info!(
      "Dev mode: found source capcut-mate at {} but not auto-starting. Run: uv run main.py there (or set CAPCUT_MATE_AUTO_START=1). Packaged .exe will auto-start BE.",
      dir.display()
    );
    manage_empty(app);
    return;
  }

  match spawn_mate_from_dir(&dir) {
    Ok(child) => {
      info!(
        "Started embedded capcut-mate from {} (pid={})",
        dir.display(),
        child.id()
      );
      app.manage(CapcutMateProcess {
        child: Mutex::new(Some(child)),
      });
      std::thread::sleep(Duration::from_millis(1200));
    }
    Err(e) => {
      warn!("{e}");
      manage_empty(app);
    }
  }
}
