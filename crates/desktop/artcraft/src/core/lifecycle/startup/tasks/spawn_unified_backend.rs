//! Starts the unified Python backend sidecar (artcraft-server.exe).

use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use log::{info, warn};
use tauri::{AppHandle, Manager};

const UNIFIED_PORT: u16 = 30000;
const SIDECAR_NAME: &str = "artcraft-server.exe";

pub struct UnifiedBackendProcess {
  child: Mutex<Option<Child>>,
}

impl Drop for UnifiedBackendProcess {
  fn drop(&mut self) {
    if let Ok(mut guard) = self.child.lock() {
      if let Some(mut child) = guard.take() {
        info!("Stopping unified backend sidecar (pid={:?})", child.id());
        let _ = child.kill();
        let _ = child.wait();
      }
    }
  }
}

fn port_open(port: u16) -> bool {
  let Ok(addr) = format!("127.0.0.1:{port}").parse() else {
    return false;
  };
  TcpStream::connect_timeout(&addr, Duration::from_millis(200)).is_ok()
}

fn push_if(paths: &mut Vec<PathBuf>, p: PathBuf) {
  if !paths.iter().any(|x| x == &p) {
    paths.push(p);
  }
}

fn resolve_sidecar(app: &AppHandle) -> Option<PathBuf> {
  let mut candidates: Vec<PathBuf> = Vec::new();

  if let Ok(p) = std::env::var("ARTCRAFT_UNIFIED_SIDECAR") {
    push_if(&mut candidates, PathBuf::from(p));
  }

  if let Ok(exe) = std::env::current_exe() {
    if let Some(dir) = exe.parent() {
      push_if(&mut candidates, dir.join(SIDECAR_NAME));
      push_if(&mut candidates, dir.join("resources").join(SIDECAR_NAME));
    }
  }

  if let Ok(res) = app.path().resource_dir() {
    push_if(&mut candidates, res.join(SIDECAR_NAME));
    push_if(&mut candidates, res.join("capcut-mate").join("capcut-mate-server.exe"));
  }

  candidates.into_iter().find(|c| c.is_file())
}

fn spawn_sidecar(exe: &Path) -> Result<Child, String> {
  Command::new(exe)
    .current_dir(exe.parent().unwrap_or_else(|| Path::new(".")))
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .spawn()
    .map_err(|e| format!("Failed to spawn unified sidecar {}: {e}", exe.display()))
}

pub fn spawn_unified_backend(app: &AppHandle) {
  if port_open(UNIFIED_PORT) {
    info!("Unified backend already listening on :{UNIFIED_PORT} — re-using");
    app.manage(UnifiedBackendProcess { child: Mutex::new(None) });
    return;
  }

  let Some(sidecar) = resolve_sidecar(app) else {
    info!("Unified backend sidecar not found; falling back to separate auto-starters");
    app.manage(UnifiedBackendProcess { child: Mutex::new(None) });
    return;
  };

  match spawn_sidecar(&sidecar) {
    Ok(child) => {
      info!(
        "Started unified backend sidecar {} (pid={})",
        sidecar.display(),
        child.id()
      );
      app.manage(UnifiedBackendProcess {
        child: Mutex::new(Some(child)),
      });
      // PyInstaller exe cần 3-8s để giải nén và khởi động uvicorn.
      // Chờ cho đến khi cổng 30000 thực sự LISTEN trước khi để FE load.
      let deadline = std::time::Instant::now() + Duration::from_secs(15);
      loop {
        if port_open(UNIFIED_PORT) {
          info!("Unified backend ready on :{UNIFIED_PORT}");
          break;
        }
        if std::time::Instant::now() >= deadline {
          warn!("Unified backend did not start within 15s — continuing anyway");
          break;
        }
        std::thread::sleep(Duration::from_millis(400));
      }
    }
    Err(e) => {
      warn!("{e}");
      app.manage(UnifiedBackendProcess { child: Mutex::new(None) });
    }
  }
}
