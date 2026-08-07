//! HTTP client for the CapCut Mate (JianYing) backend — used by the pipeline
//! worker to create drafts, inject captions, save projects, and query export capabilities.

use crate::services::pipeline::caption_segmenter::{segment_script_to_captions, CaptionSegment};
use errors::AnyhowResult;
use log::{error, info, warn};
use reqwest::Client;
use serde_json::{json, Value};
use std::env;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

pub const DEFAULT_CAPCUT_MATE_BASE_URL: &str = "http://127.0.0.1:30000";
pub const CAPCUT_PREFIX: &str = "/openapi/capcut-mate/v1";

pub const DEFAULT_TIMEOUT_SECS: u64 = 120;
pub const DEFAULT_POLL_INTERVAL_MS: u64 = 2000;
pub const DEFAULT_JOB_TIMEOUT_SECS: u64 = 600;

pub const DEFAULT_WIDTH: u32 = 1080;
pub const DEFAULT_HEIGHT: u32 = 1920;

fn get_capcut_mate_base_url() -> String {
  env::var("CAPCUT_MATE_BASE_URL").unwrap_or_else(|_| DEFAULT_CAPCUT_MATE_BASE_URL.to_string())
}

fn get_timeout() -> Duration {
  let secs = env::var("REQUEST_TIMEOUT_SECONDS").ok().and_then(|s| s.parse::<u64>().ok()).unwrap_or(DEFAULT_TIMEOUT_SECS);
  Duration::from_secs(secs)
}

fn get_poll_interval() -> Duration {
  let ms = env::var("PIPELINE_POLL_INTERVAL_MS").ok().and_then(|s| s.parse::<u64>().ok()).unwrap_or(DEFAULT_POLL_INTERVAL_MS);
  Duration::from_millis(ms)
}

fn get_job_timeout() -> Duration {
  let secs = env::var("PIPELINE_JOB_TIMEOUT_SECONDS").ok().and_then(|s| s.parse::<u64>().ok()).unwrap_or(DEFAULT_JOB_TIMEOUT_SECS);
  Duration::from_secs(secs)
}

/// Health check to verify CapCut Mate backend reachability.
pub async fn health_check() -> Result<(), String> {
  let base_url = get_capcut_mate_base_url();
  let url = format!("{}/health", base_url.trim_end_matches('/'));
  let client = Client::builder().timeout(Duration::from_secs(5)).build().map_err(|e| format!("CAPCUT_UNAVAILABLE: Failed to build HTTP client: {e}"))?;

  match client.get(&url).send().await {
    Ok(res) => {
      let status = res.status();
      if status.is_success() {
        Ok(())
      } else {
        Err(format!("CAPCUT_UNAVAILABLE: HTTP status {}", status.as_u16()))
      }
    },
    Err(err) => Err(format!("CAPCUT_UNAVAILABLE: Connection failed to {url}: {err}")),
  }
}

/// Assembly flow: create_draft -> add_captions -> save_draft -> verify_draft -> (gen_video if supported).
/// Individual steps are `pub` so the pipeline worker can drive the state machine stage-by-stage.

/// Create a new draft and return (draft_url, draft_id).
pub async fn create_draft(client: &Client, width: u32, height: u32) -> AnyhowResult<(String, String)> {
  let body = json!({ "width": width, "height": height });
  let response = post(client, "/create_draft", &body).await.map_err(|e| anyhow::anyhow!("DRAFT_CREATE_FAILED: {e}"))?;

  let draft_url = response.get("draft_url").and_then(|v| v.as_str()).ok_or_else(|| anyhow::anyhow!("DRAFT_CREATE_FAILED: create_draft response missing draft_url"))?.to_string();

  let draft_id = response.get("draft_id").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap_or_else(|| extract_draft_id_from_url(&draft_url));

  info!("[CAPCUT][CREATED] draft_url={}, draft_id={}", draft_url, draft_id);
  Ok((draft_url, draft_id))
}

/// Add structured captions array to draft.
pub async fn add_captions(client: &Client, draft_url: &str, captions: &[CaptionSegment]) -> AnyhowResult<()> {
  let captions_json = serde_json::to_string(captions)?;
  let body = json!({
    "draft_url": draft_url,
    "captions": captions_json,
  });

  post(client, "/add_captions", &body).await.map_err(|e| anyhow::anyhow!("CAPTION_ADD_FAILED: {e}"))?;
  info!("[CAPCUT][CAPTIONS_ADDED] Injected {} captions into timeline", captions.len());
  Ok(())
}

/// Save draft.
pub async fn save_draft(client: &Client, draft_url: &str) -> AnyhowResult<String> {
  let body = json!({ "draft_url": draft_url });
  let response = post(client, "/save_draft", &body).await.map_err(|e| anyhow::anyhow!("DRAFT_SAVE_FAILED: {e}"))?;

  let saved_url = response.get("draft_url").and_then(|v| v.as_str()).unwrap_or(draft_url).to_string();

  Ok(saved_url)
}

/// Verify draft existence via get_draft API endpoint.
pub async fn verify_draft_exists(client: &Client, draft_id: &str) -> AnyhowResult<()> {
  let base_url = get_capcut_mate_base_url();
  let url = format!("{}/openapi/capcut-mate/v1/get_draft?draft_id={}", base_url.trim_end_matches('/'), draft_id);

  match client.get(&url).send().await {
    Ok(res) if res.status().is_success() => Ok(()),
    Ok(res) => {
      let status = res.status().as_u16();
      Err(anyhow::anyhow!("DRAFT_SAVE_FAILED: get_draft validation failed with HTTP {}", status))
    },
    Err(e) => Err(anyhow::anyhow!("DRAFT_SAVE_FAILED: get_draft validation error: {e}")),
  }
}

/// Real draft properties read back from CapCut Mate's `get_draft` response.
/// Track counts are `None` when the backend does not report them — the worker
/// must not substitute hard-coded numbers.
#[derive(Debug, Clone, serde::Serialize)]
pub struct DraftManifest {
  pub draft_id: String,
  pub visual_track_count: Option<u64>,
  pub audio_track_count: Option<u64>,
  pub caption_track_count: Option<u64>,
  pub timeline_duration_us: Option<u64>,
  /// Where the counts came from: "capcut_get_draft_tracks" when the backend
  /// reported a tracks array, "capcut_get_draft_no_tracks" when it did not.
  pub source: String,
}

/// Inspect a saved draft via `get_draft`, extracting whatever track/timeline
/// metadata the backend actually reports. Missing fields stay `None`.
pub async fn inspect_draft(client: &Client, draft_id: &str) -> AnyhowResult<DraftManifest> {
  let base_url = get_capcut_mate_base_url();
  let url = format!("{}/openapi/capcut-mate/v1/get_draft?draft_id={}", base_url.trim_end_matches('/'), draft_id);

  let response = client.get(&url).send().await.map_err(|e| anyhow::anyhow!("DRAFT_SAVE_FAILED: get_draft inspection error: {e}"))?;
  let status = response.status();
  let text = response.text().await.unwrap_or_default();
  if !status.is_success() {
    return Err(anyhow::anyhow!("DRAFT_SAVE_FAILED: get_draft inspection HTTP {}", status.as_u16()));
  }

  let parsed: Value = serde_json::from_str(&text).unwrap_or_else(|_| json!({}));
  // Tracks may live at the top level, under `data`, or under `draft` depending on
  // the backend version — probe each without inventing values.
  let root = parsed.get("data").or_else(|| parsed.get("draft")).unwrap_or(&parsed);

  let tracks = root.get("tracks").and_then(|v| v.as_array());
  let (mut visual, mut audio, mut caption) = (None::<u64>, None::<u64>, None::<u64>);
  let source;
  if let Some(tracks) = tracks {
    let (mut v, mut a, mut c) = (0u64, 0u64, 0u64);
    for track in tracks {
      match track.get("type").and_then(|t| t.as_str()).unwrap_or("") {
        "video" | "image" | "visual" => v += 1,
        "audio" | "voice" | "music" => a += 1,
        "text" | "caption" | "subtitle" => c += 1,
        _ => {},
      }
    }
    visual = Some(v);
    audio = Some(a);
    caption = Some(c);
    source = "capcut_get_draft_tracks".to_string();
  } else {
    source = "capcut_get_draft_no_tracks".to_string();
  }

  let timeline_duration_us = root.get("duration").or_else(|| root.get("timeline_duration_us")).and_then(|v| v.as_u64());

  Ok(DraftManifest { draft_id: draft_id.to_string(), visual_track_count: visual, audio_track_count: audio, caption_track_count: caption, timeline_duration_us, source })
}

/// Kick off video rendering task if supported.
pub async fn gen_video(client: &Client, draft_url: &str) -> AnyhowResult<()> {
  let body = json!({ "draft_url": draft_url });
  post(client, "/gen_video", &body).await?;
  Ok(())
}

/// Poll video rendering status with cancellation check and strict deadline.
pub async fn poll_gen_video_status(client: &Client, draft_url: &str, cancel_flag: Option<Arc<AtomicBool>>) -> AnyhowResult<String> {
  let deadline = std::time::Instant::now() + get_job_timeout();
  let poll_interval = get_poll_interval();
  let body = json!({ "draft_url": draft_url });

  loop {
    // Check cancellation requested
    if let Some(ref flag) = cancel_flag {
      if flag.load(Ordering::Relaxed) {
        info!("[CAPCUT][RENDER_CANCEL] Cancellation requested during render polling");
        return Err(anyhow::anyhow!("RENDER_CANCELLED: User requested job cancellation"));
      }
    }

    let response = match post(client, "/gen_video_status", &body).await {
      Ok(res) => res,
      Err(err) => {
        warn!("[CAPCUT][POLL_ERR] Error querying gen_video_status: {err}");
        if std::time::Instant::now() >= deadline {
          return Err(anyhow::anyhow!("RENDER_TIMEOUT: Polling failed repeatedly and deadline exceeded: {err}"));
        }
        tokio::time::sleep(poll_interval).await;
        continue;
      },
    };

    let status = response.get("status").and_then(|v| v.as_str()).unwrap_or("");

    match status {
      "success" | "completed" | "done" => {
        let video_url = response.get("video_url").and_then(|v| v.as_str()).ok_or_else(|| anyhow::anyhow!("RENDER_FAILED: gen_video_status completed but missing video_url"))?;
        return Ok(video_url.to_string());
      },
      "failed" | "error" => {
        let err_msg = response.get("error_message").and_then(|v| v.as_str()).unwrap_or("unknown render error");
        return Err(anyhow::anyhow!("RENDER_FAILED: CapCut render failed: {err_msg}"));
      },
      _ => {
        if std::time::Instant::now() >= deadline {
          return Err(anyhow::anyhow!("RENDER_TIMEOUT: Render did not complete within deadline"));
        }
        tokio::time::sleep(poll_interval).await;
      },
    }
  }
}

/// Helper function to extract draft_id query parameter from draft_url if not in response payload.
fn extract_draft_id_from_url(draft_url: &str) -> String {
  if let Some(pos) = draft_url.find("draft_id=") {
    let sub = &draft_url[pos + 9..];
    let end = sub.find('&').unwrap_or(sub.len());
    return sub[..end].to_string();
  }
  draft_url.split('/').last().unwrap_or("").to_string()
}

/// Send POST request to `{base_url}{CAPCUT_PREFIX}{path}` and validate `code == 0` convention.
async fn post(client: &Client, path: &str, body: &Value) -> AnyhowResult<Value> {
  let base_url = get_capcut_mate_base_url();
  let url = format!("{}/openapi/capcut-mate/v1{}", base_url.trim_end_matches('/'), path);
  let body_string = serde_json::to_string(body)?;

  let response = client.post(&url).header("Content-Type", "application/json").header("Accept", "application/json").body(body_string).send().await.map_err(|e| anyhow::anyhow!("CAPCUT_UNAVAILABLE: Connection failed to {url}: {e}"))?;

  let status = response.status();
  let text = response.text().await?;

  if !status.is_success() {
    return Err(anyhow::anyhow!("CAPCUT_UNAVAILABLE: CapCut Mate HTTP error {} for {}: {}", status.as_u16(), path, text));
  }

  let parsed: Value = serde_json::from_str(&text)?;

  // CapCut Mate signals logical errors via code != 0 even on HTTP 200
  let code = parsed.get("code").and_then(|v| v.as_i64()).unwrap_or(-1);
  if code != 0 {
    let message = parsed.get("message").and_then(|v| v.as_str()).unwrap_or("unknown backend error");
    return Err(anyhow::anyhow!("CAPCUT_API_ERROR: Path {path} failed (code {code}): {message}"));
  }

  Ok(parsed)
}
