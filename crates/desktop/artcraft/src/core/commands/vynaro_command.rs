use std::env;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::State;

pub struct VynaroProcessManager {
  pub child: Mutex<Option<Child>>,
}

impl Default for VynaroProcessManager {
  fn default() -> Self {
    Self {
      child: Mutex::new(None),
    }
  }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VynaroStatusResponse {
  pub status: String, // "running" | "stopped" | "starting"
  pub pid: Option<u32>,
  pub message: Option<String>,
  pub error: Option<String>,
}

fn resolve_vynaro_dir() -> PathBuf {
  if let Ok(env_path) = env::var("VYNARO_ROOT") {
    let p = PathBuf::from(&env_path);
    if p.exists() {
      return p;
    }
  }

  if let Ok(cwd) = env::current_dir() {
    let p = cwd.join("vynaro");
    if p.exists() {
      return p;
    }
    let parent_p = cwd.join("artcraft").join("vynaro");
    if parent_p.exists() {
      return parent_p;
    }
  }

  PathBuf::from("./vynaro")
}

fn check_and_clean_child(manager: &VynaroProcessManager) -> Option<u32> {
  let mut lock = manager.child.lock().unwrap_or_else(|e| e.into_inner());
  if let Some(ref mut child) = *lock {
    match child.try_wait() {
      Ok(Some(_status)) => {
        // Child exited
        *lock = None;
        None
      }
      Ok(None) => {
        // Child is still alive
        Some(child.id())
      }
      Err(_) => {
        *lock = None;
        None
      }
    }
  } else {
    None
  }
}

#[tauri::command]
pub fn vynaro_status_command(
  manager: State<'_, VynaroProcessManager>,
) -> VynaroStatusResponse {
  if let Some(pid) = check_and_clean_child(&manager) {
    VynaroStatusResponse {
      status: "running".to_string(),
      pid: Some(pid),
      message: Some("Vynaro is running".to_string()),
      error: None,
    }
  } else {
    VynaroStatusResponse {
      status: "stopped".to_string(),
      pid: None,
      message: Some("Vynaro is stopped".to_string()),
      error: None,
    }
  }
}

#[tauri::command]
pub fn vynaro_start_command(
  manager: State<'_, VynaroProcessManager>,
) -> VynaroStatusResponse {
  if let Some(pid) = check_and_clean_child(&manager) {
    return VynaroStatusResponse {
      status: "running".to_string(),
      pid: Some(pid),
      message: Some("Vynaro is already running".to_string()),
      error: None,
    };
  }

  let vynaro_dir = resolve_vynaro_dir();
  if !vynaro_dir.exists() {
    return VynaroStatusResponse {
      status: "stopped".to_string(),
      pid: None,
      message: None,
      error: Some(format!(
        "Vynaro directory not found at: {}",
        vynaro_dir.display()
      )),
    };
  }

  // Check DEV vs PROD mode
  // Production binary paths to check:
  let prod_binary_win = vynaro_dir.join("src-tauri").join("target").join("release").join("vynaro.exe");
  let prod_binary_win_alt = vynaro_dir.join("target").join("release").join("vynaro.exe");
  let prod_binary_unix = vynaro_dir.join("src-tauri").join("target").join("release").join("vynaro");

  let mut child_res = if prod_binary_win.exists() {
    Command::new(&prod_binary_win)
      .current_dir(&vynaro_dir)
      .spawn()
  } else if prod_binary_win_alt.exists() {
    Command::new(&prod_binary_win_alt)
      .current_dir(&vynaro_dir)
      .spawn()
  } else if prod_binary_unix.exists() {
    Command::new(&prod_binary_unix)
      .current_dir(&vynaro_dir)
      .spawn()
  } else if vynaro_dir.join("package.json").exists() {
    // Development mode fallback: spawn pnpm tauri:dev
    #[cfg(target_os = "windows")]
    {
      Command::new("cmd")
        .args(["/C", "pnpm", "tauri:dev"])
        .current_dir(&vynaro_dir)
        .spawn()
    }
    #[cfg(not(target_os = "windows"))]
    {
      Command::new("pnpm")
        .args(["tauri:dev"])
        .current_dir(&vynaro_dir)
        .spawn()
    }
  } else {
    return VynaroStatusResponse {
      status: "stopped".to_string(),
      pid: None,
      message: None,
      error: Some(format!(
        "Vynaro is not built or installed in {}",
        vynaro_dir.display()
      )),
    };
  };

  match child_res {
    Ok(child) => {
      let pid = child.id();
      let mut lock = manager.child.lock().unwrap_or_else(|e| e.into_inner());
      *lock = Some(child);
      VynaroStatusResponse {
        status: "running".to_string(),
        pid: Some(pid),
        message: Some("Vynaro launched successfully".to_string()),
        error: None,
      }
    }
    Err(err) => VynaroStatusResponse {
      status: "stopped".to_string(),
      pid: None,
      message: None,
      error: Some(format!("Failed to start Vynaro process: {}", err)),
    },
  }
}

#[tauri::command]
pub fn vynaro_open_command(
  manager: State<'_, VynaroProcessManager>,
) -> VynaroStatusResponse {
  vynaro_start_command(manager)
}

#[tauri::command]
pub fn vynaro_stop_command(
  manager: State<'_, VynaroProcessManager>,
) -> VynaroStatusResponse {
  let mut lock = manager.child.lock().unwrap_or_else(|e| e.into_inner());
  if let Some(mut child) = lock.take() {
    let _ = child.kill();
    let _ = child.wait();
    VynaroStatusResponse {
      status: "stopped".to_string(),
      pid: None,
      message: Some("Vynaro stopped".to_string()),
      error: None,
    }
  } else {
    VynaroStatusResponse {
      status: "stopped".to_string(),
      pid: None,
      message: Some("Vynaro is not running".to_string()),
      error: None,
    }
  }
}
