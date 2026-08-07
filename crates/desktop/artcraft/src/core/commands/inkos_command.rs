use std::env;
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::State;

pub struct InkosProcessManager {
  pub child_api: Mutex<Option<Child>>,
  pub child_ui: Mutex<Option<Child>>,
}

impl Default for InkosProcessManager {
  fn default() -> Self {
    Self {
      child_api: Mutex::new(None),
      child_ui: Mutex::new(None),
    }
  }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InkosStatusResponse {
  pub status: String, // "ready" | "stopped" | "starting"
  pub ui_ready: bool,
  pub api_ready: bool,
  pub message: Option<String>,
  pub error: Option<String>,
}

fn resolve_inkos_dir() -> PathBuf {
  // 1. Configured INKOS_ROOT env var
  if let Ok(env_path) = env::var("INKOS_ROOT") {
    let p = PathBuf::from(&env_path);
    if p.exists() {
      return p.canonicalize().unwrap_or(p);
    }
  }

  // 2. Configured ARTCRAFT_ROOT env var
  if let Ok(env_path) = env::var("ARTCRAFT_ROOT") {
    let p = PathBuf::from(&env_path).join("inkos");
    if p.exists() {
      return p.canonicalize().unwrap_or(p);
    }
  }

  // 3. Upward search from process current_dir()
  if let Ok(mut dir) = env::current_dir() {
    for _ in 0..6 {
      let candidate = dir.join("inkos");
      if candidate.join("package.json").exists() || candidate.join("packages").exists() {
        return candidate.canonicalize().unwrap_or(candidate);
      }
      if !dir.pop() {
        break;
      }
    }
  }

  // 4. Upward search from executable directory
  if let Ok(exe_path) = env::current_exe() {
    let mut dir = exe_path;
    for _ in 0..6 {
      let candidate = dir.join("inkos");
      if candidate.join("package.json").exists() || candidate.join("packages").exists() {
        return candidate.canonicalize().unwrap_or(candidate);
      }
      if !dir.pop() {
        break;
      }
    }
  }

  // 5. Dev fallback path check
  let hardcoded_dev = PathBuf::from(r"D:\capcutpolot\artcraft\inkos");
  if hardcoded_dev.exists() {
    return hardcoded_dev.canonicalize().unwrap_or(hardcoded_dev);
  }

  PathBuf::from("./inkos")
}

fn is_port_open(port: u16) -> bool {
  TcpStream::connect(("127.0.0.1", port)).is_ok()
}

#[tauri::command]
pub fn inkos_status_command(
  _manager: State<'_, InkosProcessManager>,
) -> InkosStatusResponse {
  let ui_ready = is_port_open(4567);
  let api_ready = is_port_open(4569);

  let status = if ui_ready {
    "ready"
  } else if api_ready {
    "starting"
  } else {
    "stopped"
  };

  InkosStatusResponse {
    status: status.to_string(),
    ui_ready,
    api_ready,
    message: Some(format!("InkOS status: UI={ui_ready}, API={api_ready}")),
    error: None,
  }
}

#[tauri::command]
pub fn inkos_start_command(
  manager: State<'_, InkosProcessManager>,
) -> InkosStatusResponse {
  let ui_ready = is_port_open(4567);
  let api_ready = is_port_open(4569);

  if ui_ready {
    return InkosStatusResponse {
      status: "ready".to_string(),
      ui_ready: true,
      api_ready: true,
      message: Some("InkOS Studio is already running".to_string()),
      error: None,
    };
  }

  let inkos_dir = resolve_inkos_dir();
  if !inkos_dir.exists() {
    return InkosStatusResponse {
      status: "stopped".to_string(),
      ui_ready: false,
      api_ready: false,
      message: None,
      error: Some(format!("InkOS directory not found at {}", inkos_dir.display())),
    };
  }

  let api_script_rel = PathBuf::from("packages").join("studio").join("src").join("api").join("index.ts");

  // 1. Spawn API server (:4569) if not running
  if !api_ready {
    #[cfg(target_os = "windows")]
    {
      let mut cmd = Command::new("cmd");
      cmd.args([
        "/C",
        "pnpm",
        "--filter",
        "@actalk/inkos-studio",
        "exec",
        "tsx",
        "watch",
        api_script_rel.to_str().unwrap(),
      ])
      .env("INKOS_STUDIO_PORT", "4569")
      .env("INKOS_PROJECT_ROOT", &inkos_dir)
      .current_dir(&inkos_dir);

      if let Ok(child) = cmd.spawn() {
        let mut lock = manager.child_api.lock().unwrap_or_else(|e| e.into_inner());
        *lock = Some(child);
      }
    }
    #[cfg(not(target_os = "windows"))]
    {
      let mut cmd = Command::new("pnpm");
      cmd.args([
        "--filter",
        "@actalk/inkos-studio",
        "exec",
        "tsx",
        "watch",
        api_script_rel.to_str().unwrap(),
      ])
      .env("INKOS_STUDIO_PORT", "4569")
      .env("INKOS_PROJECT_ROOT", &inkos_dir)
      .current_dir(&inkos_dir);

      if let Ok(child) = cmd.spawn() {
        let mut lock = manager.child_api.lock().unwrap_or_else(|e| e.into_inner());
        *lock = Some(child);
      }
    }
  }

  // 2. Spawn Client UI (:4567) if not running
  if !ui_ready {
    #[cfg(target_os = "windows")]
    {
      let mut cmd = Command::new("cmd");
      cmd.args(["/C", "pnpm", "--filter", "@actalk/inkos-studio", "dev:client"])
        .current_dir(&inkos_dir);
      if let Ok(child) = cmd.spawn() {
        let mut lock = manager.child_ui.lock().unwrap_or_else(|e| e.into_inner());
        *lock = Some(child);
      }
    }
    #[cfg(not(target_os = "windows"))]
    {
      let mut cmd = Command::new("pnpm");
      cmd.args(["--filter", "@actalk/inkos-studio", "dev:client"])
        .current_dir(&inkos_dir);
      if let Ok(child) = cmd.spawn() {
        let mut lock = manager.child_ui.lock().unwrap_or_else(|e| e.into_inner());
        *lock = Some(child);
      }
    }
  }

  InkosStatusResponse {
    status: "starting".to_string(),
    ui_ready: false,
    api_ready: false,
    message: Some("Starting InkOS services...".to_string()),
    error: None,
  }
}

#[tauri::command]
pub fn inkos_stop_command(
  manager: State<'_, InkosProcessManager>,
) -> InkosStatusResponse {
  {
    let mut lock = manager.child_api.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(mut child) = lock.take() {
      let _ = child.kill();
      let _ = child.wait();
    }
  }
  {
    let mut lock = manager.child_ui.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(mut child) = lock.take() {
      let _ = child.kill();
      let _ = child.wait();
    }
  }

  InkosStatusResponse {
    status: "stopped".to_string(),
    ui_ready: false,
    api_ready: false,
    message: Some("InkOS stopped".to_string()),
    error: None,
  }
}
