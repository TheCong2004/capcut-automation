//! HTTP client for LLM / OmniRoute — used by the pipeline worker
//! to generate script content from a prompt. Reads configuration dynamically
//! from environment variables.

use errors::AnyhowResult;
use log::{error, info, warn};
use reqwest::Client;
use serde_json::{json, Value};
use std::env;
use std::time::Duration;

pub const DEFAULT_LLM_BASE_URL: &str = "http://127.0.0.1:20128";
pub const DEFAULT_LLM_MODEL: &str = "auto";
pub const DEFAULT_TIMEOUT_SECS: u64 = 120;
pub const DEFAULT_MAX_RETRIES: u32 = 3;

fn get_llm_base_url() -> String {
  env::var("LLM_BASE_URL").unwrap_or_else(|_| DEFAULT_LLM_BASE_URL.to_string())
}

fn get_llm_model() -> String {
  env::var("LLM_MODEL").unwrap_or_else(|_| DEFAULT_LLM_MODEL.to_string())
}

fn get_llm_api_key() -> Option<String> {
  env::var("LLM_API_KEY").ok().filter(|s| !s.trim().is_empty())
}

fn get_timeout() -> Duration {
  let secs = env::var("REQUEST_TIMEOUT_SECONDS").ok().and_then(|s| s.parse::<u64>().ok()).unwrap_or(DEFAULT_TIMEOUT_SECS);
  Duration::from_secs(secs)
}

fn get_max_retries() -> u32 {
  env::var("PIPELINE_MAX_RETRIES").ok().and_then(|s| s.parse::<u32>().ok()).unwrap_or(DEFAULT_MAX_RETRIES)
}

/// Health check to verify LLM service reachability. Only 2xx HTTP response is considered ready.
pub async fn health_check() -> Result<(), String> {
  let base_url = get_llm_base_url();
  let url = format!("{}/v1/models", base_url.trim_end_matches('/'));
  let client = Client::builder().timeout(Duration::from_secs(5)).build().map_err(|e| format!("LLM_UNAVAILABLE: Failed to build HTTP client: {e}"))?;

  let mut req = client.get(&url);
  if let Some(key) = get_llm_api_key() {
    req = req.header("Authorization", format!("Bearer {key}"));
  }

  match req.send().await {
    Ok(res) => {
      let status = res.status();
      let code = status.as_u16();

      if status.is_success() {
        Ok(())
      } else if code == 401 {
        Err("LLM_UNAUTHORIZED: Authentication failed (HTTP 401)".to_string())
      } else if code == 403 {
        Err("LLM_FORBIDDEN: Access forbidden (HTTP 403)".to_string())
      } else if code == 404 {
        Err("LLM_NOT_FOUND: Endpoint /v1/models not found (HTTP 404)".to_string())
      } else {
        Err(format!("LLM_UNAVAILABLE: HTTP status {code}"))
      }
    },
    Err(err) => {
      if err.is_timeout() {
        Err("LLM_TIMEOUT: Health check request timed out".to_string())
      } else {
        Err(format!("LLM_UNAVAILABLE: Connection failed to {url}: {err}"))
      }
    },
  }
}

/// Generate a script from prompt via OpenAI-compatible chat completions with backoff retries.
pub async fn generate_script(prompt: &str) -> AnyhowResult<String> {
  if prompt.trim().is_empty() {
    return Err(anyhow::anyhow!("LLM_EMPTY_SCRIPT: Prompt cannot be empty"));
  }

  let base_url = get_llm_base_url();
  let model = get_llm_model();
  let url = format!("{}/v1/chat/completions", base_url.trim_end_matches('/'));
  let timeout = get_timeout();
  let max_retries = get_max_retries();

  let body = json!({
    "model": model,
    "messages": [
      {
        "role": "user",
        "content": prompt,
      }
    ],
    "stream": false,
  });
  let body_string = serde_json::to_string(&body)?;

  let client = Client::builder().timeout(timeout).build()?;

  let mut attempt = 0;
  loop {
    attempt += 1;

    let mut req = client.post(&url).header("Content-Type", "application/json").header("Accept", "application/json");

    if let Some(key) = get_llm_api_key() {
      req = req.header("Authorization", format!("Bearer {key}"));
    }

    info!("[LLM][POST] Sending script generation request (attempt {}/{})", attempt, max_retries);

    let res_result = req.body(body_string.clone()).send().await;

    match res_result {
      Ok(response) => {
        let status = response.status();
        let status_code = status.as_u16();

        if status_code == 401 {
          error!("[LLM][AUTH_ERROR] HTTP 401 Unauthorized");
          return Err(anyhow::anyhow!("LLM_UNAUTHORIZED: Authentication failed (HTTP 401)"));
        }

        if status_code == 403 {
          error!("[LLM][FORBIDDEN] HTTP 403 Forbidden");
          return Err(anyhow::anyhow!("LLM_UNAUTHORIZED: Permission denied (HTTP 403)"));
        }

        if status_code == 404 {
          error!("[LLM][NOT_FOUND] HTTP 404 Not Found");
          return Err(anyhow::anyhow!("LLM_INVALID_RESPONSE: Endpoint not found (HTTP 404)"));
        }

        if status_code == 400 {
          let text = response.text().await.unwrap_or_default();
          error!("[LLM][BAD_REQUEST] {}", text);
          return Err(anyhow::anyhow!("LLM_INVALID_RESPONSE: Bad request (HTTP 400): {}", text));
        }

        if status_code == 429 {
          if attempt < max_retries {
            warn!("[LLM][RATE_LIMIT] Rate limited (HTTP 429). Retrying after delay...");
            tokio::time::sleep(Duration::from_millis(1500 * attempt as u64)).await;
            continue;
          } else {
            return Err(anyhow::anyhow!("LLM_RATE_LIMITED: Rate limit exceeded (HTTP 429)"));
          }
        }

        if status.is_server_error() {
          let text = response.text().await.unwrap_or_default();
          if attempt < max_retries {
            warn!("[LLM][SERVER_ERROR] HTTP {}: {}. Retrying...", status_code, text);
            tokio::time::sleep(Duration::from_millis(1000 * attempt as u64)).await;
            continue;
          } else {
            return Err(anyhow::anyhow!("LLM_UNAVAILABLE: Server error (HTTP {}): {}", status_code, text));
          }
        }

        if !status.is_success() {
          return Err(anyhow::anyhow!("LLM_UNAVAILABLE: Unexpected HTTP status {}", status_code));
        }

        let text = response.text().await?;
        let parsed: Value = match serde_json::from_str(&text) {
          Ok(v) => v,
          Err(e) => return Err(anyhow::anyhow!("LLM_INVALID_RESPONSE: JSON parse error: {}", e)),
        };

        let content = parsed.get("choices").and_then(|c| c.get(0)).and_then(|c| c.get("message")).and_then(|m| m.get("content")).and_then(|v| v.as_str()).ok_or_else(|| anyhow::anyhow!("LLM_INVALID_RESPONSE: Missing choices[0].message.content"))?;

        let trimmed = content.trim();
        if trimmed.is_empty() {
          return Err(anyhow::anyhow!("LLM_EMPTY_SCRIPT: LLM returned empty script text"));
        }

        info!("[LLM][SUCCESS] Generated script ({} characters)", trimmed.len());
        return Ok(trimmed.to_string());
      },
      Err(err) => {
        let is_timeout = err.is_timeout();
        let err_msg = if is_timeout { "LLM_TIMEOUT".to_string() } else { format!("LLM_UNAVAILABLE: {err}") };

        if attempt < max_retries {
          warn!("[LLM][RETRY] Request failed ({err_msg}). Retrying {}/{}", attempt, max_retries);
          tokio::time::sleep(Duration::from_millis(1000 * attempt as u64)).await;
        } else {
          return Err(anyhow::anyhow!("{}", err_msg));
        }
      },
    }
  }
}
