use std::path::{Component, Path, PathBuf};

const DANGEROUS_EXTENSIONS: &[&str] = &[
    "app", "bat", "cmd", "command", "desktop", "dll", "dylib", "exe", "lnk", "plist", "ps1",
    "service", "sh", "so",
];

const DANGEROUS_FILENAMES: &[&str] = &[
    ".bash_profile",
    ".bashrc",
    ".profile",
    ".zprofile",
    ".zshenv",
    ".zshrc",
];

const DENIED_COMMAND_NAMES: &[&str] = &[
    "bash",
    "bun",
    "cmd",
    "cmd.exe",
    "deno",
    "fish",
    "node",
    "osascript",
    "powershell",
    "powershell.exe",
    "pwsh",
    "python",
    "python3",
    "sh",
    "zsh",
];

const DANGEROUS_COMPONENTS: &[&str] = &[
    ".aws",
    ".config/autostart",
    ".gnupg",
    ".local/share/applications",
    ".ssh",
    "library/application support/google/chrome",
    "library/application support/mozilla",
    "library/keychains",
    "library/launchagents",
    "microsoft/windows/start menu/programs/startup",
];

const UNIX_SENSITIVE_PREFIXES: &[&str] = &[
    "/applications",
    "/bin",
    "/etc",
    "/library/launchagents",
    "/library/launchdaemons",
    "/private/etc",
    "/sbin",
    "/system",
    "/usr/bin",
    "/usr/sbin",
];

const WINDOWS_SENSITIVE_COMPONENTS: &[&str] = &[
    "program files",
    "program files (x86)",
    "windows",
    "windows/system32",
];

pub(super) fn validate_plugin_write_scope(path: &Path) -> Result<(), String> {
    let normalized = normalize_for_policy(path);
    if normalized.trim().is_empty() {
        return Err("Write path is empty.".to_string());
    }
    if !path.is_absolute() {
        return Err(format!(
            "Plugin write path {} must be absolute.",
            path.display()
        ));
    }
    if is_root_path(path) {
        return Err(format!(
            "Plugin write access to {} is too broad.",
            path.display()
        ));
    }
    if is_home_directory(path) {
        return Err(format!(
            "Plugin write access to the home directory is too broad: {}",
            path.display()
        ));
    }
    if is_sensitive_path(path) {
        return Err(format!(
            "Plugin write access to sensitive path {} is blocked.",
            path.display()
        ));
    }
    Ok(())
}

pub(super) fn validate_plugin_output_path(path: &Path) -> Result<(), String> {
    validate_plugin_write_scope(path)?;
    if is_dangerous_output_filename(path) {
        return Err(format!(
            "Plugin output file type is blocked by Youwee safety policy: {}",
            path.display()
        ));
    }
    Ok(())
}

pub(super) fn is_dangerous_output_filename(path: &Path) -> bool {
    let Some(filename) = path.file_name().and_then(|value| value.to_str()) else {
        return false;
    };
    let filename = filename.to_ascii_lowercase();
    if DANGEROUS_FILENAMES.contains(&filename.as_str()) {
        return true;
    }
    path.extension()
        .and_then(|value| value.to_str())
        .map(|extension| DANGEROUS_EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

pub(super) fn validate_tool_arg(tool_name: &str, arg: &str) -> Result<(), String> {
    let trimmed = arg.trim();
    if trimmed.is_empty() || trimmed.starts_with('-') || is_url_like(trimmed) {
        return Ok(());
    }
    let normalized = trimmed.strip_prefix("file:").unwrap_or(trimmed);
    let path = Path::new(normalized);
    let command_name = policy_basename(path);
    if DENIED_COMMAND_NAMES.contains(&command_name.as_str()) {
        return Err(format!(
            "Blocked unsafe {tool_name} argument that delegates command execution: {trimmed}"
        ));
    }
    if is_sensitive_path(path) || is_dangerous_output_filename(path) {
        return Err(format!(
            "Blocked unsafe {tool_name} path argument: {trimmed}"
        ));
    }
    Ok(())
}

pub(super) fn validate_command_path(command: &Path) -> Result<(), String> {
    let command_name = policy_basename(command);
    if DENIED_COMMAND_NAMES.contains(&command_name.as_str()) {
        return Err(format!(
            "Blocked unsafe command for plugin runtime: {command_name}"
        ));
    }
    Ok(())
}

fn is_root_path(path: &Path) -> bool {
    path.parent().is_none() || path.components().filter(is_normal_component).count() == 0
}

fn is_home_directory(path: &Path) -> bool {
    home_dirs().into_iter().any(|home| same_path(path, &home))
}

fn is_sensitive_path(path: &Path) -> bool {
    let normalized = normalize_for_policy(path);

    if UNIX_SENSITIVE_PREFIXES
        .iter()
        .any(|prefix| normalized == *prefix || normalized.starts_with(&format!("{prefix}/")))
    {
        return true;
    }

    if contains_component_sequence(&normalized, DANGEROUS_COMPONENTS) {
        return true;
    }

    WINDOWS_SENSITIVE_COMPONENTS
        .iter()
        .any(|component| contains_component_sequence(&normalized, &[*component]))
}

fn contains_component_sequence(path: &str, patterns: &[&str]) -> bool {
    patterns.iter().any(|pattern| {
        path == *pattern
            || path.starts_with(&format!("{pattern}/"))
            || path.ends_with(&format!("/{pattern}"))
            || path.contains(&format!("/{pattern}/"))
    })
}

fn normalize_for_policy(path: &Path) -> String {
    let canonical_or_input = std::fs::canonicalize(path).unwrap_or_else(|_| PathBuf::from(path));
    canonical_or_input
        .to_string_lossy()
        .replace('\\', "/")
        .trim_end_matches('/')
        .to_ascii_lowercase()
}

fn policy_basename(path: &Path) -> String {
    path.to_string_lossy()
        .replace('\\', "/")
        .rsplit('/')
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase()
}

fn is_url_like(value: &str) -> bool {
    let Some((scheme, _)) = value.split_once("://") else {
        return false;
    };
    let mut chars = scheme.chars();
    matches!(chars.next(), Some(first) if first.is_ascii_alphabetic())
        && chars.all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '+' | '.' | '-'))
}

fn same_path(left: &Path, right: &Path) -> bool {
    normalize_for_policy(left) == normalize_for_policy(right)
}

fn home_dirs() -> Vec<PathBuf> {
    let mut homes = Vec::new();
    if let Some(home) = std::env::var_os("HOME") {
        homes.push(PathBuf::from(home));
    }
    if let Some(profile) = std::env::var_os("USERPROFILE") {
        homes.push(PathBuf::from(profile));
    }
    homes.sort();
    homes.dedup();
    homes
}

fn is_normal_component(component: &Component<'_>) -> bool {
    matches!(component, Component::Normal(_))
}
