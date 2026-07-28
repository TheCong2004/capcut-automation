//! HTTP client for OmniRoute (the unified AI router product) — used by the
//! pipeline worker to generate a short-film script from an idea/prompt.
//!
//! OmniRoute runs as a standalone product on **:20128** (API + dashboard on the
//! same port). It exposes an OpenAI-compatible `POST /v1/chat/completions`.
//!
//! ⚠️ Do NOT target :30000 — there `/v1/*` is hijacked by unified_server.py's
//! FreeLLMAPI proxy (→ :3001), a different service.
//!
//! NB: the workspace's reqwest is built with `default-features = false` and only
//! `multipart`/`stream` — there is NO `json` feature. So we serialize the request
//! body and parse the response with `serde_json` manually instead of `.json()`.

use errors::AnyhowResult;
use log::info;
use reqwest::Client;
use serde_json::{json, Value};
use std::time::Duration;

const OMNIROUTE_BASE_URL: &str = "http://localhost:20128";
const CHAT_COMPLETIONS_PATH: &str = "/v1/chat/completions";
const DEFAULT_MODEL: &str = "auto";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(120);

/// Generate a script from an idea/prompt via OmniRoute's chat-completions endpoint.
/// Returns the assistant message content as a plain string.
pub async fn generate_script(prompt: &str) -> AnyhowResult<String> {
  let url = format!("{OMNIROUTE_BASE_URL}{CHAT_COMPLETIONS_PATH}");

  let body = json!({
    "model": DEFAULT_MODEL,
    "messages": [
      {
        "role": "user",
        "content": prompt,
      }
    ],
    "stream": false,
  });

  let body_string = serde_json::to_string(&body)?;

  let client = Client::builder()
      .timeout(REQUEST_TIMEOUT)
      .build()?;

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
      "OmniRoute returned HTTP {} for {}: {}",
      status.as_u16(),
      url,
      text,
    ));
  }

  let parsed: Value = serde_json::from_str(&text)?;

  let content = parsed
      .get("choices")
      .and_then(|choices| choices.get(0))
      .and_then(|choice| choice.get("message"))
      .and_then(|message| message.get("content"))
      .and_then(|content| content.as_str())
      .ok_or_else(|| anyhow::anyhow!(
        "OmniRoute response missing choices[0].message.content: {}",
        text,
      ))?;

  info!("OmniRoute generated a script ({} chars)", content.len());

  Ok(content.to_string())
}
