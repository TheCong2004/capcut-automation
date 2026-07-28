//! HTTP client for the CapCut Mate (JianYing) backend — used by the pipeline
//! worker to assemble a draft from a script and render it to a video.
//!
//! CapCut Mate runs as a sidecar on **:30000** with path prefix
//! `/openapi/capcut-mate/v1`. Response convention: the BE wraps every reply as
//! `{ "code": 0, "message": ..., ...fields }`. **`code != 0` is an error even on
//! HTTP 200** — so we check `code` on every call, not just the HTTP status.
//!
//! Two more BE quirks the MVP relies on:
//!   - Several array fields (e.g. `captions`) must be sent as a JSON-**stringified**
//!     string, not nested JSON.
//!   - Time units are **microseconds** (1 second = 1_000_000).
//!
//! NB: reqwest here has no `json` feature (see omniroute_client.rs) — bodies are
//! serialized and responses parsed with `serde_json` manually.

use errors::AnyhowResult;
use log::info;
use reqwest::Client;
use serde_json::{json, Value};
use std::time::Duration;

const CAPCUT_BASE_URL: &str = "http://localhost:30000";
const CAPCUT_PREFIX: &str = "/openapi/capcut-mate/v1";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(120);

/// Microseconds per second — CapCut Mate's time unit.
const US: u64 = 1_000_000;

/// Gap between gen_video_status polls.
const RENDER_POLL_INTERVAL: Duration = Duration::from_millis(2_000);
/// Max time to wait for a render before giving up.
const RENDER_DEADLINE: Duration = Duration::from_secs(600);

const DEFAULT_WIDTH: u32 = 1080;
const DEFAULT_HEIGHT: u32 = 1920;

/// Build a draft from a script and render it to a video. Returns the video URL.
///
/// MVP flow: create_draft → add_captions → gen_video → poll gen_video_status.
pub async fn assemble_and_render(script: &str) -> AnyhowResult<String> {
  let client = Client::builder()
      .timeout(REQUEST_TIMEOUT)
      .build()?;

  let draft_url = create_draft(&client, DEFAULT_WIDTH, DEFAULT_HEIGHT).await?;
  add_captions(&client, &draft_url, script).await?;
  gen_video(&client, &draft_url).await?;
  let video_url = poll_gen_video_status(&client, &draft_url).await?;

  Ok(video_url)
}

/// Create a new draft, returning its `draft_url`.
async fn create_draft(client: &Client, width: u32, height: u32) -> AnyhowResult<String> {
  let body = json!({ "width": width, "height": height });
  let response = post(client, "/create_draft", &body).await?;

  let draft_url = response
      .get("draft_url")
      .and_then(|v| v.as_str())
      .ok_or_else(|| anyhow::anyhow!("create_draft response missing draft_url"))?;

  info!("CapCut Mate created draft: {}", draft_url);
  Ok(draft_url.to_string())
}

/// Add the script as captions. The BE expects `captions` as a JSON-stringified array.
async fn add_captions(client: &Client, draft_url: &str, script: &str) -> AnyhowResult<()> {
  // MVP: one caption spanning 5 seconds. Real timing/segmentation comes later.
  let captions = json!([
    {
      "text": script,
      "start": 0,
      "end": 5 * US,
    }
  ]);
  let captions_string = serde_json::to_string(&captions)?;

  let body = json!({
    "draft_url": draft_url,
    "captions": captions_string,
  });
  post(client, "/add_captions", &body).await?;
  Ok(())
}

/// Kick off rendering. Returns once the BE accepts the job (poll status separately).
async fn gen_video(client: &Client, draft_url: &str) -> AnyhowResult<()> {
  let body = json!({ "draft_url": draft_url });
  post(client, "/gen_video", &body).await?;
  info!("CapCut Mate started render for draft: {}", draft_url);
  Ok(())
}

/// Poll gen_video_status until the render reaches a terminal state.
/// Returns the video URL on success.
async fn poll_gen_video_status(client: &Client, draft_url: &str) -> AnyhowResult<String> {
  let deadline = std::time::Instant::now() + RENDER_DEADLINE;
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
            .ok_or_else(|| anyhow::anyhow!(
              "gen_video_status success but missing video_url"
            ))?;
        info!("CapCut Mate render complete: {}", video_url);
        return Ok(video_url.to_string());
      }
      "failed" | "error" => {
        let error_message = response
            .get("error_message")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown render error");
        return Err(anyhow::anyhow!("CapCut Mate render failed: {}", error_message));
      }
      _ => {
        if std::time::Instant::now() >= deadline {
          return Err(anyhow::anyhow!(
            "CapCut Mate render did not finish within {}s (last status: {})",
            RENDER_DEADLINE.as_secs(),
            status,
          ));
        }
        tokio::time::sleep(RENDER_POLL_INTERVAL).await;
      }
    }
  }
}

/// POST to `{base}{prefix}{path}` with a JSON body, enforcing the `code == 0`
/// convention. Returns the parsed response body on success.
async fn post(client: &Client, path: &str, body: &Value) -> AnyhowResult<Value> {
  let url = format!("{CAPCUT_BASE_URL}{CAPCUT_PREFIX}{path}");
  let body_string = serde_json::to_string(body)?;

  let response = client.post(&url)
      .header("Content-Type", "application/json")
      .header("Accept", "application/json")
      .body(body_string)
      .send()
      .await?;

  let status = response.status();
  let text = response.text().await?;

  if !status.is_success() {
    return Err(anyhow::anyhow!(
      "CapCut Mate returned HTTP {} for {}: {}",
      status.as_u16(),
      path,
      text,
    ));
  }

  let parsed: Value = serde_json::from_str(&text)?;

  // The BE signals logical errors via `code != 0` even on HTTP 200.
  let code = parsed.get("code").and_then(|v| v.as_i64()).unwrap_or(-1);
  if code != 0 {
    let message = parsed
        .get("message")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown error");
    return Err(anyhow::anyhow!(
      "CapCut Mate {} failed (code {}): {}",
      path,
      code,
      message,
    ));
  }

  Ok(parsed)
}
