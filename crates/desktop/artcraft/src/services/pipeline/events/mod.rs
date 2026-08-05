//! Pipeline lifecycle events emitted to the frontend.

use log::warn;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

pub const STAGE_COMPLETE_EVENT: &str = "pipeline://stage_complete";
pub const JOB_COMPLETE_EVENT: &str = "pipeline://job_complete";
pub const JOB_FAILED_EVENT: &str = "pipeline://job_failed";

#[derive(Clone, Debug, Serialize)]
pub struct StageCompletePayload {
  pub job_id: String,
  pub completed_stage: String,
  pub next_stage: String,
  pub progress: u32,
  pub stage_message: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct JobCompletePayload {
  pub job_id: String,
  pub result_type: String, // "draft" | "video"
  pub stage: String,
  pub progress: u32,
  pub draft_url: String,
  pub video_url: Option<String>,
  pub rendering_supported: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct JobFailedPayload {
  pub job_id: String,
  pub failed_stage: String,
  pub error_code: String,
  pub error_message: String,
}

pub fn emit_stage_complete(app: &AppHandle, payload: StageCompletePayload) {
  emit(app, STAGE_COMPLETE_EVENT, payload);
}

pub fn emit_job_complete(app: &AppHandle, payload: JobCompletePayload) {
  emit(app, JOB_COMPLETE_EVENT, payload);
}

pub fn emit_job_failed(app: &AppHandle, payload: JobFailedPayload) {
  emit(app, JOB_FAILED_EVENT, payload);
}

fn emit<T: Serialize + Clone>(app: &AppHandle, event: &str, payload: T) {
  if let Err(err) = app.emit(event, payload) {
    warn!("Failed to emit {event}: {err}");
  }
}
