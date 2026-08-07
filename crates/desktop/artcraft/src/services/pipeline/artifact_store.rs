//! Physical ArtifactStore backend for Floword Workflows.
//!
//! Validates that a produced file physically exists, is a regular non-empty file,
//! lives inside the workflow's artifact root (no path traversal), computes a real
//! streaming SHA-256 over the whole file, and records a MIME type by extension.

use errors::AnyhowResult;
use log::info;
use serde_derive::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowordArtifact {
  pub id: String,
  pub workflow_id: String,
  pub step_id: String,
  pub producer: String,
  pub artifact_type: String,
  pub path: String,
  pub size_bytes: u64,
  pub mime_type: String,
  pub sha256: String,
  pub created_at: String,
  pub metadata: serde_json::Value,
}

pub struct ArtifactStore;

impl ArtifactStore {
  /// Validate and register a physical artifact file that must live inside
  /// `workflow_root` (the per-workflow artifact directory). The file must exist,
  /// be a regular file, be non-empty, and canonicalize to a path inside the root.
  pub fn register_artifact(workflow_root: &Path, workflow_id: &str, step_id: &str, producer: &str, artifact_type: &str, file_path: &Path, metadata: serde_json::Value) -> AnyhowResult<FlowordArtifact> {
    if !file_path.exists() {
      return Err(anyhow::anyhow!("ARTIFACT_VALIDATION_FAILED: File does not exist at {:?}", file_path));
    }
    if file_path.is_dir() {
      return Err(anyhow::anyhow!("ARTIFACT_VALIDATION_FAILED: Path is a directory, not a file: {:?}", file_path));
    }

    let canonical_path = file_path.canonicalize().map_err(|e| anyhow::anyhow!("ARTIFACT_VALIDATION_FAILED: Cannot canonicalize {:?}: {e}", file_path))?;

    // Path-traversal guard: the artifact must resolve to a location inside the workflow root.
    let canonical_root = workflow_root.canonicalize().map_err(|e| anyhow::anyhow!("ARTIFACT_VALIDATION_FAILED: Cannot canonicalize workflow root {:?}: {e}", workflow_root))?;
    if !canonical_path.starts_with(&canonical_root) {
      return Err(anyhow::anyhow!("ARTIFACT_VALIDATION_FAILED: Path {:?} escapes workflow root {:?}", canonical_path, canonical_root));
    }

    let meta = std::fs::metadata(&canonical_path)?;
    if !meta.is_file() {
      return Err(anyhow::anyhow!("ARTIFACT_VALIDATION_FAILED: Not a regular file: {:?}", canonical_path));
    }
    let size_bytes = meta.len();
    if size_bytes == 0 {
      return Err(anyhow::anyhow!("ARTIFACT_VALIDATION_FAILED: File size is 0 bytes: {:?}", canonical_path));
    }

    let sha256 = compute_file_sha256(&canonical_path)?;
    let mime_type = mime_type_for_extension(&canonical_path);

    let artifact_id = format!("art_{}_{}_{}", step_id, date_stamp(), rand_id());

    let artifact = FlowordArtifact { id: artifact_id, workflow_id: workflow_id.to_string(), step_id: step_id.to_string(), producer: producer.to_string(), artifact_type: artifact_type.to_string(), path: canonical_path.to_string_lossy().to_string(), size_bytes, mime_type, sha256, created_at: chrono::Utc::now().to_rfc3339(), metadata };

    info!("[ArtifactStore] Registered artifact {} ({}) at {} ({} bytes, sha256={})", artifact.id, artifact.mime_type, artifact.path, artifact.size_bytes, artifact.sha256);

    Ok(artifact)
  }
}

/// Stream the file through SHA-256 and return the 64-char lowercase hex digest.
fn compute_file_sha256(path: &Path) -> AnyhowResult<String> {
  use std::io::Read;
  let mut file = std::fs::File::open(path)?;
  let mut hasher = Sha256::new();
  let mut buf = [0u8; 64 * 1024];
  loop {
    let n = file.read(&mut buf)?;
    if n == 0 {
      break;
    }
    hasher.update(&buf[..n]);
  }
  let digest = hasher.finalize();
  let mut hex = String::with_capacity(digest.len() * 2);
  for byte in digest.iter() {
    hex.push_str(&format!("{byte:02x}"));
  }
  Ok(hex)
}

fn mime_type_for_extension(path: &Path) -> String {
  let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
  match ext.as_str() {
    "json" => "application/json",
    "mp4" => "video/mp4",
    "mp3" => "audio/mpeg",
    "wav" => "audio/wav",
    "srt" => "text/plain",
    "png" => "image/png",
    "jpg" | "jpeg" => "image/jpeg",
    "webp" => "image/webp",
    _ => "application/octet-stream",
  }
  .to_string()
}

fn date_stamp() -> String {
  chrono::Utc::now().format("%Y%m%d%H%M%S").to_string()
}

fn rand_id() -> String {
  format!("{:04x}", rand::random::<u16>())
}

/// The per-workflow artifact root path, given a base artifacts directory.
pub fn workflow_artifact_root(base: &Path, workflow_id: &str) -> PathBuf {
  base.join(workflow_id)
}

#[cfg(test)]
mod tests {
  use super::*;
  use serde_json::json;
  use std::fs;

  fn write_file(dir: &Path, name: &str, contents: &[u8]) -> PathBuf {
    let path = dir.join(name);
    if let Some(parent) = path.parent() {
      fs::create_dir_all(parent).unwrap();
    }
    fs::write(&path, contents).unwrap();
    path
  }

  #[test]
  fn identical_contents_produce_identical_sha256() {
    let tmp = tempfile::tempdir().unwrap();
    let root = tmp.path();
    let a = write_file(root, "a.json", b"{\"hello\":\"world\"}");
    let b = write_file(root, "b.json", b"{\"hello\":\"world\"}");

    let art_a = ArtifactStore::register_artifact(root, "wf1", "step-1", "P", "script", &a, json!({})).unwrap();
    let art_b = ArtifactStore::register_artifact(root, "wf1", "step-1", "P", "script", &b, json!({})).unwrap();

    assert_eq!(art_a.sha256, art_b.sha256);
    assert_eq!(art_a.sha256.len(), 64);
    assert!(art_a.sha256.chars().all(|c| c.is_ascii_hexdigit()));
  }

  #[test]
  fn different_contents_produce_different_sha256() {
    let tmp = tempfile::tempdir().unwrap();
    let root = tmp.path();
    let a = write_file(root, "a.json", b"content-a");
    let b = write_file(root, "b.json", b"content-b-different");

    let art_a = ArtifactStore::register_artifact(root, "wf1", "step-1", "P", "script", &a, json!({})).unwrap();
    let art_b = ArtifactStore::register_artifact(root, "wf1", "step-1", "P", "script", &b, json!({})).unwrap();

    assert_ne!(art_a.sha256, art_b.sha256);
  }

  #[test]
  fn known_vector_matches_sha256_of_abc() {
    // SHA-256("abc") is a well-known test vector.
    let tmp = tempfile::tempdir().unwrap();
    let root = tmp.path();
    let f = write_file(root, "abc.txt", b"abc");
    let art = ArtifactStore::register_artifact(root, "wf1", "step-1", "P", "script", &f, json!({})).unwrap();
    assert_eq!(art.sha256, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  }

  #[test]
  fn empty_file_is_rejected() {
    let tmp = tempfile::tempdir().unwrap();
    let root = tmp.path();
    let f = write_file(root, "empty.json", b"");
    let err = ArtifactStore::register_artifact(root, "wf1", "step-1", "P", "script", &f, json!({})).unwrap_err();
    assert!(err.to_string().contains("0 bytes"), "unexpected error: {err}");
  }

  #[test]
  fn directory_is_rejected() {
    let tmp = tempfile::tempdir().unwrap();
    let root = tmp.path();
    let subdir = root.join("some_dir");
    fs::create_dir_all(&subdir).unwrap();
    let err = ArtifactStore::register_artifact(root, "wf1", "step-1", "P", "script", &subdir, json!({})).unwrap_err();
    assert!(err.to_string().contains("directory"), "unexpected error: {err}");
  }

  #[test]
  fn file_outside_workflow_root_is_rejected() {
    let root_tmp = tempfile::tempdir().unwrap();
    let outside_tmp = tempfile::tempdir().unwrap();
    let root = root_tmp.path();
    let outside_file = write_file(outside_tmp.path(), "escape.json", b"outside");

    let err = ArtifactStore::register_artifact(root, "wf1", "step-1", "P", "script", &outside_file, json!({})).unwrap_err();
    assert!(err.to_string().contains("escapes workflow root"), "unexpected error: {err}");
  }

  #[test]
  fn missing_file_is_rejected() {
    let tmp = tempfile::tempdir().unwrap();
    let root = tmp.path();
    let missing = root.join("nope.json");
    let err = ArtifactStore::register_artifact(root, "wf1", "step-1", "P", "script", &missing, json!({})).unwrap_err();
    assert!(err.to_string().contains("does not exist"), "unexpected error: {err}");
  }
}
