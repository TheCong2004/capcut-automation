use std::env;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
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
  pub status: String, // "running" | "stopped" | "starting" | "failed"
  pub pid: Option<u32>,
  pub message: Option<String>,
  pub error: Option<String>,
}

fn resolve_vynaro_dir() -> PathBuf {
  if let Ok(env_path) = env::var("VYNARO_ROOT") {
    let p = PathBuf::from(&env_path);
    if p.exists() {
      return p.canonicalize().unwrap_or(p);
    }
  }

  if let Ok(env_path) = env::var("ARTCRAFT_ROOT") {
    let p = PathBuf::from(&env_path).join("vynaro");
    if p.exists() {
      return p.canonicalize().unwrap_or(p);
    }
  }

  if let Ok(mut dir) = env::current_dir() {
    for _ in 0..6 {
      let candidate = dir.join("vynaro");
      if candidate.join("package.json").exists() || candidate.join("src-tauri").exists() {
        return candidate.canonicalize().unwrap_or(candidate);
      }
      if !dir.pop() {
        break;
      }
    }
  }

  if let Ok(exe_path) = env::current_exe() {
    let mut dir = exe_path;
    for _ in 0..6 {
      let candidate = dir.join("vynaro");
      if candidate.join("package.json").exists() || candidate.join("src-tauri").exists() {
        return candidate.canonicalize().unwrap_or(candidate);
      }
      if !dir.pop() {
        break;
      }
    }
  }

  let hardcoded_dev = PathBuf::from(r"D:\capcutpolot\artcraft\vynaro");
  if hardcoded_dev.exists() {
    return hardcoded_dev.canonicalize().unwrap_or(hardcoded_dev);
  }

  PathBuf::from("./vynaro")
}

fn is_vynaro_process_running() -> bool {
  #[cfg(target_os = "windows")]
  {
    if let Ok(output) = Command::new("tasklist")
      .args(["/FI", "IMAGENAME eq vynaro.exe"])
      .output()
    {
      let stdout = String::from_utf8_lossy(&output.stdout);
      return stdout.contains("vynaro.exe");
    }
  }
  false
}

fn check_and_clean_child(manager: &VynaroProcessManager) -> (bool, Option<u32>) {
  let mut lock = manager.child.lock().unwrap_or_else(|e| e.into_inner());
  if let Some(ref mut child) = *lock {
    match child.try_wait() {
      Ok(Some(_status)) => {
        *lock = None;
        (false, None)
      }
      Ok(None) => (true, Some(child.id())),
      Err(_) => {
        *lock = None;
        (false, None)
      }
    }
  } else {
    (false, None)
  }
}

#[tauri::command]
pub fn vynaro_status_command(
  manager: State<'_, VynaroProcessManager>,
) -> VynaroStatusResponse {
  let (is_alive, pid) = check_and_clean_child(&manager);
  let is_exe_running = is_vynaro_process_running();

  if is_exe_running || is_alive {
    VynaroStatusResponse {
      status: "running".to_string(),
      pid,
      message: Some("Vynaro is running in its desktop window".to_string()),
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
  if is_vynaro_process_running() {
    return VynaroStatusResponse {
      status: "running".to_string(),
      pid: None,
      message: Some("Vynaro is already running in its desktop window".to_string()),
      error: None,
    };
  }

  let vynaro_dir = resolve_vynaro_dir();
  if !vynaro_dir.exists() || !vynaro_dir.join("package.json").exists() {
    return VynaroStatusResponse {
      status: "failed".to_string(),
      pid: None,
      message: None,
      error: Some(format!(
        "Vynaro directory or package.json not found at: {}",
        vynaro_dir.display()
      )),
    };
  }

  let tauri_conf = vynaro_dir.join("src-tauri").join("tauri.conf.json");
  if !tauri_conf.exists() {
    return VynaroStatusResponse {
      status: "failed".to_string(),
      pid: None,
      message: None,
      error: Some(format!(
        "Vynaro src-tauri/tauri.conf.json missing at: {}",
        vynaro_dir.display()
      )),
    };
  }

  let prod_binary_win = vynaro_dir.join("src-tauri").join("target").join("release").join("vynaro.exe");
  let prod_binary_win_alt = vynaro_dir.join("target").join("release").join("vynaro.exe");
  let prod_binary_unix = vynaro_dir.join("src-tauri").join("target").join("release").join("vynaro");

  let (is_prod, child_res) = if prod_binary_win.exists() {
    (
      true,
      Command::new(&prod_binary_win)
        .current_dir(&vynaro_dir)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn(),
    )
  } else if prod_binary_win_alt.exists() {
    (
      true,
      Command::new(&prod_binary_win_alt)
        .current_dir(&vynaro_dir)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn(),
    )
  } else if prod_binary_unix.exists() {
    (
      true,
      Command::new(&prod_binary_unix)
        .current_dir(&vynaro_dir)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn(),
    )
  } else {
    #[cfg(target_os = "windows")]
    {
      (
        false,
        Command::new("cmd")
          .args(["/C", "pnpm", "tauri:dev"])
          .current_dir(&vynaro_dir)
          .stdout(Stdio::inherit())
          .stderr(Stdio::inherit())
          .spawn(),
      )
    }
    #[cfg(not(target_os = "windows"))]
    {
      (
        false,
        Command::new("pnpm")
          .args(["tauri:dev"])
          .current_dir(&vynaro_dir)
          .stdout(Stdio::inherit())
          .stderr(Stdio::inherit())
          .spawn(),
      )
    }
  };

  let mut child = match child_res {
    Ok(c) => c,
    Err(err) => {
      return VynaroStatusResponse {
        status: "failed".to_string(),
        pid: None,
        message: None,
        error: Some(format!("Failed to start Vynaro process: {}", err)),
      };
    }
  };

  if is_prod {
    let pid = child.id();
    let mut lock = manager.child.lock().unwrap_or_else(|e| e.into_inner());
    *lock = Some(child);
    return VynaroStatusResponse {
      status: "running".to_string(),
      pid: Some(pid),
      message: Some(format!("Vynaro executable launched from {}", vynaro_dir.display())),
      error: None,
    };
  }

  // Dev mode: poll for actual vynaro.exe process startup while verifying launcher process stays alive
  let start_time = Instant::now();
  let timeout = Duration::from_secs(60);

  while start_time.elapsed() < timeout {
    match child.try_wait() {
      Ok(Some(exit_status)) => {
        return VynaroStatusResponse {
          status: "failed".to_string(),
          pid: None,
          message: None,
          error: Some(format!(
            "Vynaro dev launcher process exited prematurely with code {}",
            exit_status
          )),
        };
      }
      Ok(None) => {}
      Err(err) => {
        return VynaroStatusResponse {
          status: "failed".to_string(),
          pid: None,
          message: None,
          error: Some(format!("Vynaro launcher process error: {}", err)),
        };
      }
    }

    if is_vynaro_process_running() {
      let mut lock = manager.child.lock().unwrap_or_else(|e| e.into_inner());
      *lock = Some(child);
      return VynaroStatusResponse {
        status: "running".to_string(),
        pid: None,
        message: Some("Vynaro desktop application started successfully".to_string()),
        error: None,
      };
    }

    thread::sleep(Duration::from_millis(500));
  }

  let mut lock = manager.child.lock().unwrap_or_else(|e| e.into_inner());
  *lock = Some(child);

  VynaroStatusResponse {
    status: "failed".to_string(),
    pid: None,
    message: None,
    error: Some("VYNARO_START_TIMEOUT: Timed out waiting for vynaro.exe after 60s".to_string()),
  }
}

#[tauri::command]
pub fn vynaro_open_command(
  manager: State<'_, VynaroProcessManager>,
) -> VynaroStatusResponse {
  let (is_alive, pid) = check_and_clean_child(&manager);
  if is_vynaro_process_running() || is_alive {
    VynaroStatusResponse {
      status: "running".to_string(),
      pid,
      message: Some("Vynaro is already running in its desktop window".to_string()),
      error: None,
    }
  } else {
    vynaro_start_command(manager)
  }
}

#[tauri::command]
pub fn vynaro_stop_command(
  manager: State<'_, VynaroProcessManager>,
) -> VynaroStatusResponse {
  let mut lock = manager.child.lock().unwrap_or_else(|e| e.into_inner());
  let child_pid = lock.as_ref().map(|c| c.id());

  if let Some(mut child) = lock.take() {
    let _ = child.kill();
    let _ = child.wait();
  }

  #[cfg(target_os = "windows")]
  {
    if let Some(pid) = child_pid {
      let _ = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .output();
    }
    let _ = Command::new("taskkill")
      .args(["/IM", "vynaro.exe", "/F", "/T"])
      .output();
  }

  VynaroStatusResponse {
    status: "stopped".to_string(),
    pid: None,
    message: Some("Vynaro process tree stopped".to_string()),
    error: None,
  }
}
