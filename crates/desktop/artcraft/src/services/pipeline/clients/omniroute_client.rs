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

/// Resolve the model to use: prefer the caller-provided model (from the job's
/// Project Brief), falling back to the env default only when none is given.
fn resolve_model(requested: Option<&str>) -> String {
  match requested {
    Some(m) if !m.trim().is_empty() => m.trim().to_string(),
    _ => get_llm_model(),
  }
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

/// A single scene within a generated video script.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ScriptScene {
  pub id: String,
  pub index: u32,
  pub narration: String,
  pub caption: String,
  #[serde(default)]
  pub visual_instruction: String,
  #[serde(default)]
  pub search_keywords: Vec<String>,
  #[serde(default)]
  pub emotion: String,
  pub duration_ms: u64,
}

/// Structured script returned by the LLM and validated by the worker before any
/// downstream stage runs. There is no synthetic fallback — invalid JSON fails the job.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StructuredScript {
  pub title: String,
  pub hook: String,
  pub cta: String,
  pub language: String,
  pub target_duration_seconds: u32,
  pub scenes: Vec<ScriptScene>,
}

/// A model advertised by the OmniRoute gateway.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OmniRouteModel {
  pub id: String,
  #[serde(default)]
  pub provider: String,
}

/// List models advertised by the OmniRoute gateway. Errors (with a structured code)
/// when the gateway is unreachable — callers must never substitute a hard-coded list.
pub async fn list_models() -> AnyhowResult<Vec<OmniRouteModel>> {
  let base_url = get_llm_base_url();
  let url = format!("{}/v1/models", base_url.trim_end_matches('/'));
  let client = Client::builder().timeout(Duration::from_secs(5)).build()?;

  let mut req = client.get(&url);
  if let Some(key) = get_llm_api_key() {
    req = req.header("Authorization", format!("Bearer {key}"));
  }

  let response = req.send().await.map_err(|e| if e.is_timeout() { anyhow::anyhow!("OMNIROUTE_UNAVAILABLE: models request timed out") } else { anyhow::anyhow!("OMNIROUTE_UNAVAILABLE: connection failed to {url}: {e}") })?;

  let status = response.status();
  if status.as_u16() == 401 || status.as_u16() == 403 {
    return Err(anyhow::anyhow!("OMNIROUTE_UNAUTHORIZED: HTTP {}", status.as_u16()));
  }
  if !status.is_success() {
    return Err(anyhow::anyhow!("OMNIROUTE_UNAVAILABLE: HTTP {}", status.as_u16()));
  }

  let text = response.text().await?;
  let parsed: Value = serde_json::from_str(&text).map_err(|e| anyhow::anyhow!("OMNIROUTE_INVALID_RESPONSE: {e}"))?;

  let data = parsed.get("data").and_then(|v| v.as_array()).ok_or_else(|| anyhow::anyhow!("OMNIROUTE_INVALID_RESPONSE: missing data array"))?;

  let models = data
    .iter()
    .filter_map(|m| {
      let id = m.get("id").or_else(|| m.get("name")).and_then(|v| v.as_str())?;
      let provider = m.get("provider").and_then(|v| v.as_str()).unwrap_or("").to_string();
      Some(OmniRouteModel { id: id.to_string(), provider })
    })
    .collect::<Vec<_>>();

  Ok(models)
}

/// Generate a validated structured script. Sends a JSON-schema prompt, parses the
/// response into `StructuredScript`, and retries the parse exactly once (asking the
/// model to repair its output) before failing with `LLM_INVALID_RESPONSE`.
pub async fn generate_structured_script(prompt: &str, model: Option<&str>, target_duration_seconds: u32, language: &str) -> AnyhowResult<StructuredScript> {
  if prompt.trim().is_empty() {
    return Err(anyhow::anyhow!("LLM_EMPTY_SCRIPT: Prompt cannot be empty"));
  }

  let schema_prompt = build_structured_prompt(prompt, target_duration_seconds, language);
  let raw = generate_script(&schema_prompt, model).await?;

  match parse_structured_script(&raw) {
    Ok(script) => Ok(script),
    Err(first_err) => {
      warn!("[LLM][REPAIR] Structured script parse failed ({first_err}). Requesting one repair.");
      let repair_prompt = format!("Your previous response could not be parsed as valid JSON matching the required schema. Error: {first_err}.\n\nReturn ONLY the corrected JSON object, no prose, no markdown fences. Original request:\n\n{schema_prompt}");
      let repaired = generate_script(&repair_prompt, model).await?;
      parse_structured_script(&repaired).map_err(|e| anyhow::anyhow!("LLM_INVALID_RESPONSE: script JSON invalid after one repair: {e}"))
    },
  }
}

fn build_structured_prompt(prompt: &str, target_duration_seconds: u32, language: &str) -> String {
  format!(
    r#"You are an automated video scriptwriter. Produce a short-form video script.

User request: "{prompt}"
Target duration: {target_duration_seconds} seconds
Language: {language}

Return ONLY a single valid JSON object (no markdown fences, no commentary) matching EXACTLY this schema:
{{
  "title": "string",
  "hook": "string",
  "cta": "string",
  "language": "{language}",
  "target_duration_seconds": {target_duration_seconds},
  "scenes": [
    {{
      "id": "scene-1",
      "index": 0,
      "narration": "string",
      "caption": "string",
      "visual_instruction": "string",
      "search_keywords": ["string"],
      "emotion": "string",
      "duration_ms": 4000
    }}
  ]
}}

Rules: at least 2 scenes, scene indexes start at 0 and increase by 1, every field required, duration_ms > 0."#
  )
}

/// Parse and validate the LLM's raw text into a `StructuredScript`.
/// Tolerates markdown code fences but requires schema-valid content.
fn parse_structured_script(raw: &str) -> AnyhowResult<StructuredScript> {
  let json_text = extract_json_block(raw);
  let script: StructuredScript = serde_json::from_str(&json_text).map_err(|e| anyhow::anyhow!("parse error: {e}"))?;

  if script.scenes.is_empty() {
    return Err(anyhow::anyhow!("script has zero scenes"));
  }
  for (i, scene) in script.scenes.iter().enumerate() {
    if scene.narration.trim().is_empty() {
      return Err(anyhow::anyhow!("scene {i} has empty narration"));
    }
    if scene.duration_ms == 0 {
      return Err(anyhow::anyhow!("scene {i} has zero duration_ms"));
    }
  }
  Ok(script)
}

/// Extract a JSON object from raw LLM text, stripping ```json fences if present.
fn extract_json_block(raw: &str) -> String {
  let trimmed = raw.trim();
  if let Some(start) = trimmed.find("```") {
    let after = &trimmed[start + 3..];
    let after = after.strip_prefix("json").unwrap_or(after);
    if let Some(end) = after.find("```") {
      return after[..end].trim().to_string();
    }
  }
  // Fall back to the outermost { .. } span.
  if let (Some(open), Some(close)) = (trimmed.find('{'), trimmed.rfind('}')) {
    if close > open {
      return trimmed[open..=close].to_string();
    }
  }
  trimmed.to_string()
}

/// Generate raw script text via OpenAI-compatible chat completions with backoff retries.
/// `model` overrides the env default (comes from the job's Project Brief).
pub async fn generate_script(prompt: &str, model: Option<&str>) -> AnyhowResult<String> {
  if prompt.trim().is_empty() {
    return Err(anyhow::anyhow!("LLM_EMPTY_SCRIPT: Prompt cannot be empty"));
  }

  let base_url = get_llm_base_url();
  let model = resolve_model(model);
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

    info!("[LLM][POST] Sending script generation request (attempt {}/{}, model={})", attempt, max_retries, model);

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

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn parses_plain_json_script() {
    let raw = r#"{"title":"T","hook":"H","cta":"C","language":"vi","target_duration_seconds":20,"scenes":[{"id":"scene-1","index":0,"narration":"n","caption":"c","visual_instruction":"v","search_keywords":["k"],"emotion":"e","duration_ms":4000}]}"#;
    let script = parse_structured_script(raw).unwrap();
    assert_eq!(script.scenes.len(), 1);
    assert_eq!(script.target_duration_seconds, 20);
  }

  #[test]
  fn parses_fenced_json_script() {
    let raw = "```json\n{\"title\":\"T\",\"hook\":\"H\",\"cta\":\"C\",\"language\":\"vi\",\"target_duration_seconds\":20,\"scenes\":[{\"id\":\"s1\",\"index\":0,\"narration\":\"n\",\"caption\":\"c\",\"duration_ms\":4000}]}\n```";
    let script = parse_structured_script(raw).unwrap();
    assert_eq!(script.scenes.len(), 1);
  }

  #[test]
  fn rejects_zero_scenes() {
    let raw = r#"{"title":"T","hook":"H","cta":"C","language":"vi","target_duration_seconds":20,"scenes":[]}"#;
    assert!(parse_structured_script(raw).is_err());
  }

  #[test]
  fn rejects_non_json() {
    assert!(parse_structured_script("sorry I cannot do that").is_err());
  }
}
