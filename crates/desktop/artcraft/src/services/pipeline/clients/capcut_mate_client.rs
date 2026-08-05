//! HTTP client for the CapCut Mate (JianYing) backend — used by the pipeline
//! worker to create drafts, inject captions, save projects, and query export capabilities.

use crate::services::pipeline::caption_segmenter::{segment_script_to_captions, CaptionSegment};
use errors::AnyhowResult;
use log::{error, info, warn};
use reqwest::Client;
use serde_json::{json, Value};
use std::env;
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
  let secs = env::var("REQUEST_TIMEOUT_SECONDS")
    .ok()
    .and_then(|s| s.parse::<u64>().ok())
    .unwrap_or(DEFAULT_TIMEOUT_SECS);
  Duration::from_secs(secs)
}

fn get_poll_interval() -> Duration {
  let ms = env::var("PIPELINE_POLL_INTERVAL_MS")
    .ok()
    .and_then(|s| s.parse::<u64>().ok())
    .unwrap_or(DEFAULT_POLL_INTERVAL_MS);
  Duration::from_millis(ms)
}

fn get_job_timeout() -> Duration {
  let secs = env::var("PIPELINE_JOB_TIMEOUT_SECONDS")
    .ok()
    .and_then(|s| s.parse::<u64>().ok())
    .unwrap_or(DEFAULT_JOB_TIMEOUT_SECS);
  Duration::from_secs(secs)
}

/// Health check to verify CapCut Mate backend reachability.
pub async fn health_check() -> Result<(), String> {
  let base_url = get_capcut_mate_base_url();
  let url = format!("{}/health", base_url.trim_end_matches('/'));
  let client = Client::builder()
    .timeout(Duration::from_secs(5))
    .build()
    .map_err(|e| format!("CAPCUT_MATE_UNAVAILABLE: Failed to build HTTP client: {e}"))?;

  match client.get(&url).send().await {
    Ok(res) => {
      let status = res.status();
      if status.is_success() {
        Ok(())
      } else {
        Err(format!("CAPCUT_MATE_UNAVAILABLE: HTTP status {}", status.as_u16()))
      }
    }
    Err(err) => Err(format!("CAPCUT_MATE_UNAVAILABLE: Connection failed to {url}: {err}")),
  }
}

pub struct DraftAssemblyResult {
  pub draft_url: String,
  pub draft_id: String,
  pub video_url: Option<String>,
  pub rendering_supported: bool,
}

/// Assembly flow: create_draft -> add_captions -> save_draft -> (gen_video if supported).
pub async fn assemble_and_process_draft(script: &str) -> AnyhowResult<DraftAssemblyResult> {
  let client = Client::builder().timeout(get_timeout()).build()?;

  info!("[CAPCUT][CREATE_DRAFT] Initiating draft creation...");
  let (draft_url, draft_id) = create_draft(&client, DEFAULT_WIDTH, DEFAULT_HEIGHT).await?;
  if draft_id.is_empty() {
    return Err(anyhow::anyhow!("CAPCUT_INVALID_DRAFT: Received empty draft_id"));
  }

  info!("[CAPCUT][ADD_CAPTION] Segmenting and adding captions to draft_id={}", draft_id);
  let captions = segment_script_to_captions(script);
  if captions.is_empty() {
    warn!("[CAPCUT][ADD_CAPTION] Script produced no caption segments");
  } else {
    add_captions(&client, &draft_url, &captions).await?;
  }

  info!("[CAPCUT][SAVE] Saving draft draft_id={}", draft_id);
  let saved_draft_url = save_draft(&client, &draft_url).await?;

  // Check if render video is supported or attempted
  info!("[CAPCUT][RENDER_CHECK] Checking render capability...");
  match gen_video(&client, &saved_draft_url).await {
    Ok(_) => {
      info!("[CAPCUT][RENDER] Render job submitted. Polling status...");
      match poll_gen_video_status(&client, &saved_draft_url).await {
        Ok(video_url) => Ok(DraftAssemblyResult {
          draft_url: saved_draft_url,
          draft_id,
          video_url: Some(video_url),
          rendering_supported: true,
        }),
        Err(err) => {
          warn!("[CAPCUT][RENDER_WARN] Rendering polling failed or unavailable ({err}). Falling back to DRAFT_READY");
          Ok(DraftAssemblyResult {
            draft_url: saved_draft_url,
            draft_id,
            video_url: None,
            rendering_supported: false,
          })
        }
      }
    }
    Err(err) => {
      info!("[CAPCUT][DRAFT_READY] Rendering unavailable or unsupported on backend ({err}). Completing at DRAFT_READY stage");
      Ok(DraftAssemblyResult {
        draft_url: saved_draft_url,
        draft_id,
        video_url: None,
        rendering_supported: false,
      })
    }
  }
}

/// Create a new draft and return (draft_url, draft_id).
async fn create_draft(client: &Client, width: u32, height: u32) -> AnyhowResult<(String, String)> {
  let body = json!({ "width": width, "height": height });
  let response = post(client, "/create_draft", &body).await?;

  let draft_url = response
    .get("draft_url")
    .and_then(|v| v.as_str())
    .ok_or_else(|| anyhow::anyhow!("create_draft response missing draft_url"))?
    .to_string();

  let draft_id = response
    .get("draft_id")
    .and_then(|v| v.as_str())
    .map(|s| s.to_string())
    .unwrap_or_else(|| extract_draft_id_from_url(&draft_url));

  info!("[CAPCUT][CREATED] draft_url={}, draft_id={}", draft_url, draft_id);
  Ok((draft_url, draft_id))
}

/// Add structured captions array to draft.
async fn add_captions(client: &Client, draft_url: &str, captions: &[CaptionSegment]) -> AnyhowResult<()> {
  let captions_json = serde_json::to_string(captions)?;
  let body = json!({
    "draft_url": draft_url,
    "captions": captions_json,
  });

  post(client, "/add_captions", &body).await?;
  info!("[CAPCUT][CAPTIONS_ADDED] Injected {} captions into timeline", captions.len());
  Ok(())
}

/// Save draft.
async fn save_draft(client: &Client, draft_url: &str) -> AnyhowResult<String> {
  let body = json!({ "draft_url": draft_url });
  let response = post(client, "/save_draft", &body).await?;

  let saved_url = response
    .get("draft_url")
    .and_then(|v| v.as_str())
    .unwrap_or(draft_url)
    .to_string();

  Ok(saved_url)
}

/// Kick off video rendering task if supported.
async fn gen_video(client: &Client, draft_url: &str) -> AnyhowResult<()> {
  let body = json!({ "draft_url": draft_url });
  post(client, "/gen_video", &body).await?;
  Ok(())
}

/// Poll video rendering status until completed, failed, or deadline exceeded.
async fn poll_gen_video_status(client: &Client, draft_url: &str) -> AnyhowResult<String> {
  let deadline = std::time::Instant::now() + get_job_timeout();
  let poll_interval = get_poll_interval();
  let body = json!({ "draft_url": draft_url });

  loop {
    let response = post(client, "/gen_video_status", &body).await?;

    let status = response
      .get("status")
      .and_then(|v| v.as_str())
      .unwrap_or("");

    match status {
      "success" | "completed" | "done" => {
        let video_url = response
          .get("video_url")
          .and_then(|v| v.as_str())
          .ok_or_else(|| anyhow::anyhow!("gen_video_status completed but missing video_url"))?;
        return Ok(video_url.to_string());
      }
      "failed" | "error" => {
        let err_msg = response
          .get("error_message")
          .and_then(|v| v.as_str())
          .unwrap_or("unknown render error");
        return Err(anyhow::anyhow!("CapCut render failed: {}", err_msg));
      }
      _ => {
        if std::time::Instant::now() >= deadline {
          return Err(anyhow::anyhow!("CapCut render polling timed out after deadline"));
        }
        tokio::time::sleep(poll_interval).await;
      }
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

  let response = client
    .post(&url)
    .header("Content-Type", "application/json")
    .header("Accept", "application/json")
    .body(body_string)
    .send()
    .await?;

  let status = response.status();
  let text = response.text().await?;

  if !status.is_success() {
    return Err(anyhow::anyhow!(
      "CapCut Mate HTTP error {} for {}: {}",
      status.as_u16(),
      path,
      text
    ));
  }

  let parsed: Value = serde_json::from_str(&text)?;

  // CapCut Mate signals logical errors via code != 0 even on HTTP 200
  let code = parsed.get("code").and_then(|v| v.as_i64()).unwrap_or(-1);
  if code != 0 {
    let message = parsed
      .get("message")
      .and_then(|v| v.as_str())
      .unwrap_or("unknown backend error");
    return Err(anyhow::anyhow!("CapCut Mate API failure at {} (code {}): {}", path, code, message));
  }

  Ok(parsed)
}
