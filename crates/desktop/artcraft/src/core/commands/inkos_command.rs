use std::env;
use std::fs;
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};
use tauri::State;

pub struct InkosProcessManager {
  pub child: Mutex<Option<Child>>,
}

impl Default for InkosProcessManager {
  fn default() -> Self {
    Self {
      child: Mutex::new(None),
    }
  }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InkosStatusResponse {
  pub status: String, // "ready" | "stopped" | "starting" | "failed"
  pub ui_ready: bool,
  pub api_ready: bool,
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

fn resolve_node_executable() -> PathBuf {
  #[cfg(target_os = "windows")]
  {
    if let Ok(output) = Command::new("where.exe").arg("node").output() {
      if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
          let trimmed = line.trim();
          if !trimmed.is_empty() {
            let p = PathBuf::from(trimmed);
            if p.is_file() {
              return p;
            }
          }
        }
      }
    }
  }
  PathBuf::from("node")
}

fn resolve_inkos_dir() -> PathBuf {
  if let Ok(env_path) = env::var("INKOS_ROOT") {
    let p = PathBuf::from(&env_path);
    if p.exists() {
      return clean_win_path(p.canonicalize().unwrap_or(p));
    }
  }

  if let Ok(env_path) = env::var("ARTCRAFT_ROOT") {
    let p = PathBuf::from(&env_path).join("inkos");
    if p.exists() {
      return clean_win_path(p.canonicalize().unwrap_or(p));
    }
  }

  if let Ok(mut dir) = env::current_dir() {
    for _ in 0..6 {
      let candidate = dir.join("inkos");
      if candidate.join("package.json").exists() || candidate.join("packages").exists() {
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
      let candidate = dir.join("inkos");
      if candidate.join("package.json").exists() || candidate.join("packages").exists() {
        return clean_win_path(candidate.canonicalize().unwrap_or(candidate));
      }
      if !dir.pop() {
        break;
      }
    }
  }

  let hardcoded_dev = PathBuf::from(r"D:\capcutpolot\artcraft\inkos");
  if hardcoded_dev.exists() {
    return clean_win_path(hardcoded_dev.canonicalize().unwrap_or(hardcoded_dev));
  }

  PathBuf::from("./inkos")
}

fn is_port_open(port: u16) -> bool {
  TcpStream::connect(("127.0.0.1", port)).is_ok()
}

fn ensure_inkos_json(inkos_dir: &PathBuf) {
  let json_path = inkos_dir.join("inkos.json");
  if !json_path.exists() {
    let default_content = r#"{
  "name": "artcraft-inkos-workspace",
  "version": "0.1.0",
  "notify": [],
  "daemon": {
    "schedule": {
      "radarCron": "0 */6 * * *",
      "writeCron": "*/15 * * * *"
    },
    "maxConcurrentBooks": 3
  },
  "language": "en"
}"#;
    let _ = fs::write(&json_path, default_content);
  }
}

fn check_and_clean_child(manager: &InkosProcessManager) -> (bool, Option<u32>) {
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
pub fn inkos_status_command(
  manager: State<'_, InkosProcessManager>,
) -> InkosStatusResponse {
  let (is_alive, _pid) = check_and_clean_child(&manager);
  let port_ready = is_port_open(4567);

  if port_ready {
    InkosStatusResponse {
      status: "ready".to_string(),
      ui_ready: true,
      api_ready: true,
      message: Some("InkOS Studio single-process server is ready on port 4567".to_string()),
      error: None,
    }
  } else if is_alive {
    InkosStatusResponse {
      status: "starting".to_string(),
      ui_ready: false,
      api_ready: false,
      message: Some("InkOS Studio process is running, waiting for port 4567...".to_string()),
      error: None,
    }
  } else {
    InkosStatusResponse {
      status: "stopped".to_string(),
      ui_ready: false,
      api_ready: false,
      message: Some("InkOS Studio is stopped".to_string()),
      error: None,
    }
  }
}

#[tauri::command]
pub fn inkos_start_command(
  manager: State<'_, InkosProcessManager>,
) -> InkosStatusResponse {
  if is_port_open(4567) {
    return InkosStatusResponse {
      status: "ready".to_string(),
      ui_ready: true,
      api_ready: true,
      message: Some("InkOS Studio port 4567 is already reachable".to_string()),
      error: None,
    };
  }

  let inkos_dir = resolve_inkos_dir();
  if !inkos_dir.exists() || !inkos_dir.join("package.json").exists() {
    return InkosStatusResponse {
      status: "failed".to_string(),
      ui_ready: false,
      api_ready: false,
      message: None,
      error: Some(format!(
        "INKOS_ENTRY_NOT_FOUND: InkOS directory or package.json missing at {}",
        inkos_dir.display()
      )),
    };
  }

  let studio_package = inkos_dir.join("packages").join("studio").join("package.json");
  if !studio_package.exists() {
    return InkosStatusResponse {
      status: "failed".to_string(),
      ui_ready: false,
      api_ready: false,
      message: None,
      error: Some(format!(
        "INKOS_ENTRY_NOT_FOUND: packages/studio/package.json missing at {}",
        inkos_dir.display()
      )),
    };
  }

  ensure_inkos_json(&inkos_dir);

  let raw_built_entry = inkos_dir
    .join("packages")
    .join("studio")
    .join("dist")
    .join("api")
    .join("index.js");

  let studio_entry = if raw_built_entry.exists() {
    clean_win_path(raw_built_entry.canonicalize().unwrap_or(raw_built_entry))
  } else {
    raw_built_entry
  };

  if !studio_entry.is_file() {
    return InkosStatusResponse {
      status: "failed".to_string(),
      ui_ready: false,
      api_ready: false,
      message: None,
      error: Some(format!(
        "INKOS_ENTRY_NOT_FOUND: InkOS Studio entry file missing at {}. Please run: cd {} && pnpm --filter @actalk/inkos-studio build",
        studio_entry.display(),
        inkos_dir.display()
      )),
    };
  }

  let studio_html = inkos_dir
    .join("packages")
    .join("studio")
    .join("dist")
    .join("index.html");

  if !studio_html.is_file() {
    return InkosStatusResponse {
      status: "failed".to_string(),
      ui_ready: false,
      api_ready: false,
      message: None,
      error: Some(format!(
        "INKOS_NOT_BUILT: InkOS Studio index.html missing at {}. Please run: cd {} && pnpm --filter @actalk/inkos-studio build",
        studio_html.display(),
        inkos_dir.display()
      )),
    };
  }

  let node_exe = resolve_node_executable();
  let project_root = inkos_dir.clone();

  println!("[InkOS] node_exe = {}", node_exe.display());
  println!("[InkOS] studio_entry = {}", studio_entry.display());
  println!("[InkOS] project_root = {}", project_root.display());
  println!("[InkOS] cwd = {}", inkos_dir.display());
  println!("[InkOS] studio_entry.is_file() = {}", studio_entry.is_file());

  let mut cmd = Command::new(&node_exe);
  cmd.arg(&studio_entry)
    .arg(&project_root)
    .env("INKOS_STUDIO_PORT", "4567")
    .env("INKOS_PROJECT_ROOT", &project_root)
    .current_dir(&inkos_dir)
    .stdout(Stdio::inherit())
    .stderr(Stdio::inherit());

  println!("[InkOS] program = {:?}", cmd.get_program());
  println!("[InkOS] args = {:?}", cmd.get_args().collect::<Vec<_>>());

  let mut child = match cmd.spawn() {
    Ok(c) => c,
    Err(e) => {
      return InkosStatusResponse {
        status: "failed".to_string(),
        ui_ready: false,
        api_ready: false,
        message: None,
        error: Some(format!("INKOS_SPAWN_FAILED: Failed to spawn InkOS process with node: {}", e)),
      };
    }
  };

  // Poll for readiness on port 4567 while verifying process stays alive
  let start_time = Instant::now();
  let timeout = Duration::from_secs(25);

  while start_time.elapsed() < timeout {
    match child.try_wait() {
      Ok(Some(exit_status)) => {
        return InkosStatusResponse {
          status: "failed".to_string(),
          ui_ready: false,
          api_ready: false,
          message: None,
          error: Some(format!(
            "INKOS_PROCESS_EXITED: InkOS process exited prematurely with code {}",
            exit_status
          )),
        };
      }
      Ok(None) => {}
      Err(err) => {
        return InkosStatusResponse {
          status: "failed".to_string(),
          ui_ready: false,
          api_ready: false,
          message: None,
          error: Some(format!("INKOS_SPAWN_FAILED: Process status error: {}", err)),
        };
      }
    }

    if is_port_open(4567) {
      let mut lock = manager.child.lock().unwrap_or_else(|e| e.into_inner());
      *lock = Some(child);
      return InkosStatusResponse {
        status: "ready".to_string(),
        ui_ready: true,
        api_ready: true,
        message: Some("InkOS Studio single-process server started successfully on port 4567".to_string()),
        error: None,
      };
    }

    thread::sleep(Duration::from_millis(400));
  }

  let mut lock = manager.child.lock().unwrap_or_else(|e| e.into_inner());
  *lock = Some(child);

  InkosStatusResponse {
    status: "failed".to_string(),
    ui_ready: false,
    api_ready: false,
    message: None,
    error: Some("INKOS_START_TIMEOUT: Timed out waiting for port 4567 after 25s".to_string()),
  }
}

#[tauri::command]
pub fn inkos_stop_command(
  manager: State<'_, InkosProcessManager>,
) -> InkosStatusResponse {
  let mut lock = manager.child.lock().unwrap_or_else(|e| e.into_inner());
  if let Some(mut child) = lock.take() {
    let pid = child.id();
    let _ = child.kill();
    let _ = child.wait();

    #[cfg(target_os = "windows")]
    {
      let _ = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .output();
    }

    InkosStatusResponse {
      status: "stopped".to_string(),
      ui_ready: false,
      api_ready: false,
      message: Some("InkOS process terminated".to_string()),
      error: None,
    }
  } else {
    InkosStatusResponse {
      status: "stopped".to_string(),
      ui_ready: false,
      api_ready: false,
      message: Some("No InkOS process handle found".to_string()),
      error: None,
    }
  }
}
