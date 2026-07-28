//! Pipeline lifecycle events emitted to the frontend.
//!
//! We emit directly via `app.emit(EVENT_NAME, payload)` with string constants
//! (the same lightweight pattern as `spawn_capcut_mate_backend.rs`), rather than
//! going through the `TauriEventName` enum / `BasicSendableEvent` trait. This
//! keeps the MVP self-contained and avoids editing the shared event-name enum.

use log::warn;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

/// Fired when a job finishes a (non-terminal) stage and advances to the next.
pub const STAGE_COMPLETE_EVENT: &str = "pipeline://stage_complete";
/// Fired when a job reaches the terminal `done` stage successfully.
pub const JOB_COMPLETE_EVENT: &str = "pipeline://job_complete";
/// Fired when a job fails at any stage.
pub const JOB_FAILED_EVENT: &str = "pipeline://job_failed";

#[derive(Clone, Debug, Serialize)]
pub struct StageCompletePayload {
  pub job_id: String,
  /// The stage that just completed.
  pub completed_stage: String,
  /// The stage the worker will run next.
  pub next_stage: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct JobCompletePayload {
  pub job_id: String,
  pub video_url: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct JobFailedPayload {
  pub job_id: String,
  /// The stage the job was on when it failed.
  pub failed_stage: String,
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
