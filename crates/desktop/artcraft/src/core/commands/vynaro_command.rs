use std::env;
use std::io::Read;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};
use tauri::State;

pub struct VynaroProcessManager {
  pub child: Mutex<Option<Child>>,
  pub is_starting: Mutex<bool>,
}

impl Default for VynaroProcessManager {
  fn default() -> Self {
    Self {
      child: Mutex::new(None),
      is_starting: Mutex::new(false),
    }
  }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VynaroStatusResponse {
  pub status: String, // "running" | "stopped" | "starting" | "failed"
  pub pid: Option<u32>,
  pub owned: bool,
  pub message: Option<String>,
  pub error: Option<String>,
}

fn clean_win_path(p: PathBuf) -> PathBuf {
  #[cfg(target_os = "windows")]
  {
    let s = p.to_string_lossy();
    if s.starts_with(r"\\?\") {
      return PathBuf::from(&s[4..]);
    }
  }
  p
}

fn resolve_vynaro_dir() -> PathBuf {
  if let Ok(env_path) = env::var("VYNARO_ROOT") {
    let p = PathBuf::from(&env_path);
    if p.exists() {
      return clean_win_path(p.canonicalize().unwrap_or(p));
    }
  }

  if let Ok(env_path) = env::var("ARTCRAFT_ROOT") {
    let p = PathBuf::from(&env_path).join("vynaro");
    if p.exists() {
      return clean_win_path(p.canonicalize().unwrap_or(p));
    }
  }

  if let Ok(mut dir) = env::current_dir() {
    for _ in 0..6 {
      let candidate = dir.join("vynaro");
      if candidate.join("package.json").exists() || candidate.join("src-tauri").exists() {
        return clean_win_path(candidate.canonicalize().unwrap_or(candidate));
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
        return clean_win_path(candidate.canonicalize().unwrap_or(candidate));
      }
      if !dir.pop() {
        break;
      }
    }
  }

  let hardcoded_dev = PathBuf::from(r"D:\capcutpolot\artcraft\vynaro");
  if hardcoded_dev.exists() {
    return clean_win_path(hardcoded_dev.canonicalize().unwrap_or(hardcoded_dev));
  }

  clean_win_path(PathBuf::from("./vynaro"))
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

fn bring_vynaro_to_front() {
  #[cfg(target_os = "windows")]
  {
    let _ = Command::new("powershell")
      .args([
        "-NoProfile",
        "-Command",
        "(New-Object -ComObject WScript.Shell).AppActivate('vynaro')",
      ])
      .output();
  }
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

fn clean_cargo_env(cmd: &mut Command) -> &mut Command {
  cmd.env_remove("CARGO")
    .env_remove("CARGO_MANIFEST_DIR")
    .env_remove("CARGO_PKG_NAME")
    .env_remove("CARGO_PKG_VERSION")
    .env_remove("CARGO_TARGET_DIR")
    .env_remove("CARGO_MAKEFLAGS")
    .env_remove("CARGO_NUM_JOBS")
    .env_remove("CARGO_WORKSPACE_DIR")
    .env_remove("TAURI_ENV_ARCH")
    .env_remove("TAURI_ENV_PLATFORM")
    .env_remove("TAURI_ENV_TARGET_TRIPLE")
}

#[tauri::command]
pub fn vynaro_status_command(
  manager: State<'_, VynaroProcessManager>,
) -> VynaroStatusResponse {
  let (is_alive, pid) = check_and_clean_child(&manager);
  let is_exe_running = is_vynaro_process_running();
  let is_starting = *manager.is_starting.lock().unwrap_or_else(|e| e.into_inner());

  if is_starting && !is_exe_running {
    VynaroStatusResponse {
      status: "starting".to_string(),
      pid,
      owned: is_alive,
      message: Some("Opening Vynaro...".to_string()),
      error: None,
    }
  } else if is_exe_running || is_alive {
    VynaroStatusResponse {
      status: "running".to_string(),
      pid,
      owned: is_alive,
      message: Some("Vynaro is open in its desktop window".to_string()),
      error: None,
    }
  } else {
    VynaroStatusResponse {
      status: "stopped".to_string(),
      pid: None,
      owned: false,
      message: Some("Vynaro is stopped".to_string()),
      error: None,
    }
  }
}

#[tauri::command]
pub fn vynaro_start_command(
  manager: State<'_, VynaroProcessManager>,
) -> VynaroStatusResponse {
  {
    let mut starting_lock = manager.is_starting.lock().unwrap_or_else(|e| e.into_inner());
    if *starting_lock {
      return VynaroStatusResponse {
        status: "starting".to_string(),
        pid: None,
        owned: false,
        message: Some("Vynaro is already starting...".to_string()),
        error: None,
      };
    }
    *starting_lock = true;
  }

  let (is_alive, pid) = check_and_clean_child(&manager);
  if is_vynaro_process_running() || is_alive {
    {
      let mut starting_lock = manager.is_starting.lock().unwrap_or_else(|e| e.into_inner());
      *starting_lock = false;
    }
    bring_vynaro_to_front();
    return VynaroStatusResponse {
      status: "running".to_string(),
      pid,
      owned: is_alive,
      message: Some("Vynaro is already open in its desktop window".to_string()),
      error: None,
    };
  }

  let vynaro_dir = resolve_vynaro_dir();
  if !vynaro_dir.exists() || !vynaro_dir.join("package.json").exists() {
    {
      let mut starting_lock = manager.is_starting.lock().unwrap_or_else(|e| e.into_inner());
      *starting_lock = false;
    }
    return VynaroStatusResponse {
      status: "failed".to_string(),
      pid: None,
      owned: false,
      message: None,
      error: Some(format!(
        "VYNARO_ROOT_NOT_FOUND: Vynaro directory or package.json not found at: {}",
        vynaro_dir.display()
      )),
    };
  }

  let tauri_conf = vynaro_dir.join("src-tauri").join("tauri.conf.json");
  if !tauri_conf.exists() {
    {
      let mut starting_lock = manager.is_starting.lock().unwrap_or_else(|e| e.into_inner());
      *starting_lock = false;
    }
    return VynaroStatusResponse {
      status: "failed".to_string(),
      pid: None,
      owned: false,
      message: None,
      error: Some(format!(
        "VYNARO_CONFIG_NOT_FOUND: Vynaro src-tauri/tauri.conf.json missing at: {}",
        vynaro_dir.display()
      )),
    };
  }

  let prod_binary_win = vynaro_dir.join("src-tauri").join("target").join("release").join("vynaro.exe");
  let prod_binary_win_alt = vynaro_dir.join("target").join("release").join("vynaro.exe");
  let prod_binary_unix = vynaro_dir.join("src-tauri").join("target").join("release").join("vynaro");

  let (is_prod, child_res) = if prod_binary_win.exists() {
    let mut cmd = Command::new(&prod_binary_win);
    clean_cargo_env(&mut cmd);
    (
      true,
      cmd
        .current_dir(&vynaro_dir)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn(),
    )
  } else if prod_binary_win_alt.exists() {
    let mut cmd = Command::new(&prod_binary_win_alt);
    clean_cargo_env(&mut cmd);
    (
      true,
      cmd
        .current_dir(&vynaro_dir)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn(),
    )
  } else if prod_binary_unix.exists() {
    let mut cmd = Command::new(&prod_binary_unix);
    clean_cargo_env(&mut cmd);
    (
      true,
      cmd
        .current_dir(&vynaro_dir)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn(),
    )
  } else {
    #[cfg(target_os = "windows")]
    {
      let mut cmd = Command::new("cmd");
      clean_cargo_env(&mut cmd);
      (
        false,
        cmd
          .args(["/C", "pnpm", "tauri:dev"])
          .current_dir(&vynaro_dir)
          .stdout(Stdio::inherit())
          .stderr(Stdio::piped())
          .spawn(),
      )
    }
    #[cfg(not(target_os = "windows"))]
    {
      let mut cmd = Command::new("pnpm");
      clean_cargo_env(&mut cmd);
      (
        false,
        cmd
          .args(["tauri:dev"])
          .current_dir(&vynaro_dir)
          .stdout(Stdio::inherit())
          .stderr(Stdio::piped())
          .spawn(),
      )
    }
  };

  let mut child = match child_res {
    Ok(c) => c,
    Err(err) => {
      {
        let mut starting_lock = manager.is_starting.lock().unwrap_or_else(|e| e.into_inner());
        *starting_lock = false;
      }
      return VynaroStatusResponse {
        status: "failed".to_string(),
        pid: None,
        owned: false,
        message: None,
        error: Some(format!("Failed to start Vynaro process: {}", err)),
      };
    }
  };

  if is_prod {
    let pid = child.id();
    let mut lock = manager.child.lock().unwrap_or_else(|e| e.into_inner());
    *lock = Some(child);
    {
      let mut starting_lock = manager.is_starting.lock().unwrap_or_else(|e| e.into_inner());
      *starting_lock = false;
    }
    bring_vynaro_to_front();
    return VynaroStatusResponse {
      status: "running".to_string(),
      pid: Some(pid),
      owned: true,
      message: Some(format!("Vynaro executable launched from {}", vynaro_dir.display())),
      error: None,
    };
  }

  // Dev mode: poll for actual vynaro.exe process startup up to 90s
  let start_time = Instant::now();
  let timeout = Duration::from_secs(90);

  while start_time.elapsed() < timeout {
    match child.try_wait() {
      Ok(Some(exit_status)) => {
        {
          let mut starting_lock = manager.is_starting.lock().unwrap_or_else(|e| e.into_inner());
          *starting_lock = false;
        }
        let mut stderr_text = String::new();
        if let Some(mut err_stream) = child.stderr.take() {
          let _ = err_stream.read_to_string(&mut stderr_text);
        }
        let stderr_trimmed = stderr_text.trim();
        let diag = if stderr_trimmed.is_empty() {
          format!(
            "Vynaro dev launcher process exited prematurely with code {} (cwd: {})",
            exit_status,
            vynaro_dir.display()
          )
        } else {
          format!(
            "Vynaro dev launcher process exited prematurely with code {} (cwd: {}):\n{}",
            exit_status,
            vynaro_dir.display(),
            stderr_trimmed
          )
        };
        return VynaroStatusResponse {
          status: "failed".to_string(),
          pid: None,
          owned: false,
          message: None,
          error: Some(diag),
        };
      }
      Ok(None) => {}
      Err(err) => {
        {
          let mut starting_lock = manager.is_starting.lock().unwrap_or_else(|e| e.into_inner());
          *starting_lock = false;
        }
        return VynaroStatusResponse {
          status: "failed".to_string(),
          pid: None,
          owned: false,
          message: None,
          error: Some(format!("Vynaro launcher process error: {}", err)),
        };
      }
    }

    if is_vynaro_process_running() {
      let mut lock = manager.child.lock().unwrap_or_else(|e| e.into_inner());
      *lock = Some(child);
      {
        let mut starting_lock = manager.is_starting.lock().unwrap_or_else(|e| e.into_inner());
        *starting_lock = false;
      }
      bring_vynaro_to_front();
      return VynaroStatusResponse {
        status: "running".to_string(),
        pid: None,
        owned: true,
        message: Some("Vynaro desktop application started successfully".to_string()),
        error: None,
      };
    }

    thread::sleep(Duration::from_millis(500));
  }

  let mut lock = manager.child.lock().unwrap_or_else(|e| e.into_inner());
  *lock = Some(child);
  {
    let mut starting_lock = manager.is_starting.lock().unwrap_or_else(|e| e.into_inner());
    *starting_lock = false;
  }

  VynaroStatusResponse {
    status: "failed".to_string(),
    pid: None,
    owned: true,
    message: None,
    error: Some("VYNARO_START_TIMEOUT: Timed out waiting for vynaro.exe after 90s".to_string()),
  }
}

#[tauri::command]
pub fn vynaro_open_command(
  manager: State<'_, VynaroProcessManager>,
) -> VynaroStatusResponse {
  let (is_alive, pid) = check_and_clean_child(&manager);
  if is_vynaro_process_running() || is_alive {
    bring_vynaro_to_front();
    VynaroStatusResponse {
      status: "running".to_string(),
      pid,
      owned: is_alive,
      message: Some("Vynaro is open in its desktop window".to_string()),
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
  }

  VynaroStatusResponse {
    status: "stopped".to_string(),
    pid: None,
    owned: false,
    message: Some("Vynaro process tree stopped".to_string()),
    error: None,
  }
}
