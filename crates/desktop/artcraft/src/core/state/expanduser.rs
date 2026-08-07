use once_cell::sync::Lazy;
use std::io;
use std::path::{PathBuf, MAIN_SEPARATOR};

static PREFIX: Lazy<String> = Lazy::new(|| format!("~{}", MAIN_SEPARATOR));

/// The "expanduser" crate doesn't compile on Windows, so we replace its functionality slightly
pub fn expanduser<P: AsRef<str>>(path: P) -> io::Result<PathBuf> {
  Ok(match path.as_ref() {
    // matches an exact "~"
    s if s == "~" => home_dir()?,
    // matches paths that start with `~/`
    s if s.starts_with(&*PREFIX) => {
      let home = home_dir()?;
      home.join(&s[2..])
    },
    // // matches paths that start with `~` but not `~/`, might be a `~username/` path
    // s if s.starts_with("~") => {
    //     let mut parts = s[1..].splitn(2, MAIN_SEPARATOR);
    //     let user = parts.next()
    //         .ok_or_else(|| io::Error::new(io::ErrorKind::Other, "malformed path"))?;
    //     let user = Passwd::from_name(&user)
    //         .map_err(|_| io::Error::new(io::ErrorKind::Other, "error searching for user"))?
    //         .ok_or_else(|| io::Error::new(io::ErrorKind::Other, format!("user '{}', does not exist", &user)))?;
    //     if let Some(ref path) = parts.next() {
    //         PathBuf::from(user.dir).join(&path)
    //     } else {
    //         PathBuf::from(user.dir)
    //     }
    // },
    // nothing to expand, just make a PathBuf
    s => PathBuf::from(s),
  })
}

pub fn home_dir() -> io::Result<PathBuf> {
  dirs::home_dir().ok_or_else(|| io::Error::new(io::ErrorKind::Other, "no home directory is set"))
}

#[cfg(test)]
mod tests {
  use crate::core::state::expanduser::{expanduser, home_dir};
  use std::path::{PathBuf, MAIN_SEPARATOR};

  // Expected values are derived from the production `home_dir()` (USERPROFILE on
  // Windows, HOME on Unix) rather than a hard-coded Unix path, and the `~<sep>`
  // input is built with the platform `MAIN_SEPARATOR` (production only expands the
  // native separator), so the expansion logic is exercised identically on every
  // platform without mutating env vars.

  #[test]
  fn test_success() {
    let home = home_dir().expect("no home dir set");
    let input = format!("~{sep}path{sep}to{sep}directory", sep = MAIN_SEPARATOR);
    let expanded = expanduser(&input).expect("io error");
    assert_eq!(expanded, home.join(format!("path{sep}to{sep}directory", sep = MAIN_SEPARATOR)));
  }

  #[test]
  fn test_only_tilde() {
    let home = home_dir().expect("no home dir set");
    let expanded = expanduser("~").expect("io error");
    assert_eq!(expanded, home);
  }

  #[test]
  fn test_no_expansion_leaves_path_unchanged() {
    let expanded = expanduser("relative/path").expect("io error");
    assert_eq!(expanded, PathBuf::from("relative/path"));
  }
}
