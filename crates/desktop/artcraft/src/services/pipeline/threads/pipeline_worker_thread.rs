//! The pipeline worker: a background loop that drives multi-stage pipeline jobs
//! from `pending` to `complete_success` (or `complete_failure`).

use crate::core::state::data_dir::app_data_root::AppDataRoot;
use crate::core::state::task_database::TaskDatabase;
use crate::services::pipeline::artifact_store::ArtifactStore;
use crate::services::pipeline::caption_segmenter::segment_script_to_captions;
use crate::services::pipeline::clients::capcut_mate_client::{add_captions as capcut_add_captions, create_draft as capcut_create_draft, gen_video as capcut_gen_video, health_check as capcut_mate_health_check, inspect_draft as capcut_inspect_draft, poll_gen_video_status as capcut_poll_gen_video_status, save_draft as capcut_save_draft, verify_draft_exists as capcut_verify_draft_exists, DraftManifest, DEFAULT_HEIGHT, DEFAULT_WIDTH};
use crate::services::pipeline::clients::omniroute_client::{generate_structured_script, health_check as llm_health_check, StructuredScript};
use crate::services::pipeline::events::{emit_job_complete, emit_job_failed, emit_stage_complete, JobCompletePayload, JobFailedPayload, StageCompletePayload};
use crate::services::pipeline::state::cancellation_registry::{clear_job, is_cancelled, register_job};
use crate::services::pipeline::state::command_dispatcher::CommandDispatcher;
use enums::tauri::pipeline::pipeline_stage::PipelineStage;
use enums::tauri::tasks::task_status::TaskStatus;
use errors::AnyhowResult;
use log::{error, info, warn};
use once_cell::sync::Lazy;
use serde_json::{json, Value};
use sqlite_tasks::queries::pipeline::fail_pipeline_job::{fail_pipeline_job, FailPipelineJobArgs};
use sqlite_tasks::queries::pipeline::list_pending_pipeline_jobs::{list_pending_pipeline_jobs, ListPendingPipelineJobsArgs};
use sqlite_tasks::queries::pipeline::pipeline_job::PipelineJob;
use sqlite_tasks::queries::pipeline::update_pipeline_job_stage::{update_pipeline_job_stage, UpdatePipelineJobStageArgs};
use sqlite_tasks::queries::pipeline::update_pipeline_job_status::{update_pipeline_job_status, UpdatePipelineJobStatusArgs};
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::AppHandle;
use tokens::tokens::sqlite::pipeline_jobs::PipelineJobId;
use tokio::sync::OnceCell as TokioOnceCell;

/// Idle sleep when there is nothing to do.
const IDLE_SLEEP_MS: u64 = 2_000;
/// Sleep after an unexpected error in the outer loop.
const ERROR_SLEEP_MS: u64 = 5_000;

/// Output mode requested by the job (Project Brief).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum OutputMode {
  DraftOnly,
  RenderVideo,
}

impl OutputMode {
  fn parse(raw: Option<&str>) -> Self {
    match raw {
      Some("render_video") => Self::RenderVideo,
      _ => Self::DraftOnly,
    }
  }
}

/// Structured pipeline run error mapping each failure to the stage it occurred in.
#[derive(Debug, Clone)]
pub struct PipelineRunError {
  pub stage: PipelineStage,
  pub error_code: String,
  pub error_message: String,
}

impl PipelineRunError {
  pub fn new(stage: PipelineStage, error_code: &str, error_message: String) -> Self {
    Self { stage, error_code: error_code.to_string(), error_message }
  }
}

impl std::fmt::Display for PipelineRunError {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    write!(f, "[{}] {}: {}", self.stage.to_str(), self.error_code, self.error_message)
  }
}

impl std::error::Error for PipelineRunError {}

/// Extract structured `PipelineRunError` from an `anyhow::Error`.
fn extract_pipeline_error(err: &anyhow::Error) -> PipelineRunError {
  if let Some(run_err) = err.downcast_ref::<PipelineRunError>() {
    run_err.clone()
  } else {
    let err_str = format!("{err:?}");
    let err_code = extract_error_code(&err_str);
    PipelineRunError::new(PipelineStage::PreflightCheck, &err_code, err_str)
  }
}

/// A lazily-initialized shared HTTP client for CapCut Mate calls.
pub(crate) static CAPCUT_CLIENT: TokioOnceCell<reqwest::Client> = TokioOnceCell::const_new();

async fn get_capcut_client() -> AnyhowResult<&'static reqwest::Client> {
  let client = CAPCUT_CLIENT.get_or_init(|| async { reqwest::Client::builder().timeout(std::time::Duration::from_secs(120)).build().expect("Failed to build CapCut Mate HTTP client") }).await;
  Ok(client)
}

/// Statuses that mean "the worker should still act on this job".
static PIPELINE_PENDING_STATUSES: Lazy<HashSet<TaskStatus>> = Lazy::new(|| {
  let mut set = HashSet::new();
  set.insert(TaskStatus::Pending);
  set
});

pub async fn pipeline_worker_thread(app_handle: AppHandle, _app_data_root: AppDataRoot, task_database: TaskDatabase, dispatcher: CommandDispatcher) -> ! {
  info!("[FlowordDB] worker db_path={}", task_database.db_path_display());
  loop {
    let res = worker_loop(&app_handle, &task_database, &dispatcher).await;
    if let Err(err) = res {
      error!("[JOB][OUTER_LOOP_ERROR] Pipeline worker loop error: {:?}", err);
    }
    tokio::time::sleep(std::time::Duration::from_millis(ERROR_SLEEP_MS)).await;
  }
}

async fn worker_loop(app_handle: &AppHandle, task_database: &TaskDatabase, dispatcher: &CommandDispatcher) -> AnyhowResult<()> {
  loop {
    let pending = list_pending_pipeline_jobs(ListPendingPipelineJobsArgs { db: task_database.get_connection(), statuses: &PIPELINE_PENDING_STATUSES }).await?;

    if pending.jobs.is_empty() {
      tokio::time::sleep(std::time::Duration::from_millis(IDLE_SLEEP_MS)).await;
      continue;
    }

    for job in pending.jobs {
      let job_id = job.id.clone();

      // Atomic job claim: update status from Pending -> Started
      let claimed = update_pipeline_job_status(UpdatePipelineJobStatusArgs { db: task_database.get_connection(), pipeline_job_id: &job_id, status: TaskStatus::Started }).await?;

      if !claimed {
        warn!("[JOB][CLAIM_SKIP] Job {} was already claimed by another process", job_id.as_str());
        continue;
      }

      // Register a cancellation flag for this run so `cancel_floword_workflow`
      // can abort in-flight adapter work (render polling + between-stage checks).
      let cancel_flag = register_job(job_id.as_str());

      let result = run_job_pipeline(app_handle, task_database, dispatcher, &job, &cancel_flag).await;

      if let Err(err) = result {
        let run_error = extract_pipeline_error(&err);

        // A cancellation is a terminal state, not a failure.
        if run_error.error_code == "RENDER_CANCELLED" || is_cancelled(job_id.as_str()) {
          info!("[JOB][CANCELLED] Job {} cancelled by user", job_id.as_str());
          let _ = update_pipeline_job_status(UpdatePipelineJobStatusArgs { db: task_database.get_connection(), pipeline_job_id: &job_id, status: TaskStatus::CancelledByUser }).await;
          clear_job(job_id.as_str());
          continue;
        }

        let err_str = run_error.error_message.clone();
        error!("[JOB][FAILED] Job {} failed at {}: {} (code={})", job_id.as_str(), run_error.stage.to_str(), err_str, run_error.error_code);

        fail_pipeline_job(FailPipelineJobArgs { db: task_database.get_connection(), pipeline_job_id: &job_id, failure_message: &err_str }).await?;

        emit_job_failed(app_handle, JobFailedPayload { job_id: job_id.as_str().to_string(), failed_stage: run_error.stage.to_str().to_string(), error_code: run_error.error_code, error_message: err_str });
      }

      clear_job(job_id.as_str());
    }
  }
}

/// Helper to parse standard error codes.
fn extract_error_code(err_str: &str) -> String {
  for code in &["LLM_UNAVAILABLE", "LLM_TIMEOUT", "LLM_UNAUTHORIZED", "LLM_RATE_LIMITED", "LLM_INVALID_RESPONSE", "LLM_EMPTY_SCRIPT", "CAPCUT_UNAVAILABLE", "DRAFT_CREATE_FAILED", "CAPTION_ADD_FAILED", "DRAFT_SAVE_FAILED", "DRAFT_INSPECT_FAILED", "RENDER_UNSUPPORTED", "RENDER_FAILED", "RENDER_TIMEOUT", "RENDER_CANCELLED", "PREFLIGHT_FAILED"] {
    if err_str.contains(code) {
      return code.to_string();
    }
  }
  "PIPELINE_ERROR".to_string()
}

/// Bail out with a cancellation error if the user requested it.
fn check_cancelled(job_id: &str, stage: PipelineStage) -> AnyhowResult<()> {
  if is_cancelled(job_id) {
    return Err(PipelineRunError::new(stage, "RENDER_CANCELLED", "User requested job cancellation".to_string()).into());
  }
  Ok(())
}

/// Execute full job pipeline through state machine stages.
async fn run_job_pipeline(app_handle: &AppHandle, task_database: &TaskDatabase, dispatcher: &CommandDispatcher, job: &PipelineJob, cancel_flag: &Arc<AtomicBool>) -> AnyhowResult<()> {
  let job_id_str = job.id.as_str().to_string();
  let input = parse_input(job);
  let prompt = input.get("prompt").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
  if prompt.is_empty() {
    return Err(PipelineRunError::new(PipelineStage::PreflightCheck, "PREFLIGHT_FAILED", "Prompt is empty".to_string()).into());
  }

  let output_mode = OutputMode::parse(input.get("output_mode").and_then(|v| v.as_str()));
  let allow_draft_fallback = input.get("allow_draft_fallback").and_then(|v| v.as_bool()).unwrap_or(false);
  let model_id = input.get("model_id").and_then(|v| v.as_str()).map(|s| s.to_string());
  let target_duration_seconds = input.get("target_duration_seconds").and_then(|v| v.as_u64()).unwrap_or(20) as u32;
  let language = input.get("language").and_then(|v| v.as_str()).unwrap_or("vi").to_string();

  // 1. Stage: PreflightCheck (5%)
  check_cancelled(&job_id_str, PipelineStage::PreflightCheck)?;
  emit_stage_progress(app_handle, task_database, &job.id, PipelineStage::PreflightCheck, PipelineStage::PreflightCheck, 5, "Verifying service readiness").await?;

  info!("[JOB][PREFLIGHT] Checking LLM and CapCut Mate service readiness...");
  if let Err(err) = llm_health_check().await {
    return Err(PipelineRunError::new(PipelineStage::PreflightCheck, "PREFLIGHT_FAILED", format!("LLM service check failed: {err}")).into());
  }
  if let Err(err) = capcut_mate_health_check().await {
    return Err(PipelineRunError::new(PipelineStage::PreflightCheck, "PREFLIGHT_FAILED", format!("CapCut Mate service check failed: {err}")).into());
  }

  let mut outputs = parse_stage_outputs(job);
  let work_dir = std::path::PathBuf::from("artifacts").join(job.id.as_str());

  // 2. Stage: ScriptGenerating (30%)
  check_cancelled(&job_id_str, PipelineStage::ScriptGenerating)?;
  emit_stage_progress(app_handle, task_database, &job.id, PipelineStage::PreflightCheck, PipelineStage::ScriptGenerating, 30, "Generating structured script").await?;

  let script: StructuredScript = {
    let _cpu_permit = dispatcher.acquire_cpu().await;
    info!("[JOB][LLM] Generating structured script (model={:?})...", model_id);
    generate_structured_script(&prompt, model_id.as_deref(), target_duration_seconds, &language).await.map_err(|e| {
      let err_str = format!("{e:?}");
      let code = extract_error_code(&err_str);
      PipelineRunError::new(PipelineStage::ScriptGenerating, &code, err_str)
    })?
  };

  let script_dir = work_dir.join("script");
  std::fs::create_dir_all(&script_dir).map_err(|e| PipelineRunError::new(PipelineStage::ScriptGenerating, "PIPELINE_ERROR", format!("Failed to create script dir: {e}")))?;
  let script_file_path = script_dir.join("script.json");
  let script_json = serde_json::to_string_pretty(&script).map_err(|e| PipelineRunError::new(PipelineStage::ScriptGenerating, "PIPELINE_ERROR", format!("Failed to serialize script: {e}")))?;
  std::fs::write(&script_file_path, &script_json).map_err(|e| PipelineRunError::new(PipelineStage::ScriptGenerating, "PIPELINE_ERROR", format!("Failed to write script file: {e}")))?;

  let script_artifact = ArtifactStore::register_artifact(&work_dir, job.id.as_str(), "step-2-omniroute", "OmniRouteAdapter", "script", &script_file_path, json!({ "prompt": prompt, "model": model_id })).map_err(|e| PipelineRunError::new(PipelineStage::ScriptGenerating, "PIPELINE_ERROR", format!("{e:?}")))?;

  outputs["script"] = serde_json::to_value(&script).unwrap_or(Value::Null);
  outputs["script_artifact"] = json!(script_artifact);
  persist_outputs(task_database, &job.id, PipelineStage::ScriptReady, &serialize_outputs(&outputs)?).await?;

  // Build narration text used for caption segmentation.
  let narration = script.scenes.iter().map(|s| s.narration.as_str()).collect::<Vec<_>>().join(" ");

  // 3. Stage: DraftCreating (45%)
  check_cancelled(&job_id_str, PipelineStage::DraftCreating)?;
  emit_stage_progress(app_handle, task_database, &job.id, PipelineStage::ScriptReady, PipelineStage::DraftCreating, 45, "Creating CapCut draft").await?;
  let client = get_capcut_client().await?;
  info!("[JOB][CAPCUT] Creating draft project...");
  let (draft_url, draft_id) = capcut_create_draft(client, DEFAULT_WIDTH, DEFAULT_HEIGHT).await.map_err(|e| map_capcut_error(PipelineStage::DraftCreating, &e))?;

  outputs["draft_url"] = json!(draft_url);
  outputs["draft_id"] = json!(draft_id);
  persist_outputs(task_database, &job.id, PipelineStage::DraftCreated, &serialize_outputs(&outputs)?).await?;

  // 4. Stage: CaptionAdding (60%)
  check_cancelled(&job_id_str, PipelineStage::CaptionAdding)?;
  emit_stage_progress(app_handle, task_database, &job.id, PipelineStage::DraftCreated, PipelineStage::CaptionAdding, 60, "Adding captions to draft").await?;
  info!("[JOB][CAPCUT] Segmenting script and injecting captions...");
  let captions = segment_script_to_captions(&narration);
  capcut_add_captions(client, &draft_url, &captions).await.map_err(|e| map_capcut_error(PipelineStage::CaptionAdding, &e))?;

  // 5. Stage: DraftSaving (75%)
  check_cancelled(&job_id_str, PipelineStage::DraftSaving)?;
  emit_stage_progress(app_handle, task_database, &job.id, PipelineStage::CaptionAdding, PipelineStage::DraftSaving, 75, "Saving draft project").await?;
  info!("[JOB][CAPCUT] Saving draft and verifying project...");
  let saved_url = capcut_save_draft(client, &draft_url).await.map_err(|e| map_capcut_error(PipelineStage::DraftSaving, &e))?;
  capcut_verify_draft_exists(client, &draft_id).await.map_err(|e| map_capcut_error(PipelineStage::DraftSaving, &e))?;

  // Read the real draft manifest from CapCut Mate (no hard-coded track counts).
  let manifest: DraftManifest = capcut_inspect_draft(client, &draft_id).await.map_err(|e| map_capcut_error(PipelineStage::DraftSaving, &e))?;

  let capcut_dir = work_dir.join("capcut");
  std::fs::create_dir_all(&capcut_dir).map_err(|e| PipelineRunError::new(PipelineStage::DraftSaving, "PIPELINE_ERROR", format!("Failed to create capcut dir: {e}")))?;
  let draft_manifest_path = capcut_dir.join("draft_manifest.json");
  let manifest_payload = json!({
    "draftId": draft_id,
    "draftPath": saved_url,
    "visualTrackCount": manifest.visual_track_count,
    "audioTrackCount": manifest.audio_track_count,
    "captionTrackCount": manifest.caption_track_count,
    "timelineDurationUs": manifest.timeline_duration_us,
    "source": manifest.source,
  });
  std::fs::write(&draft_manifest_path, serde_json::to_string_pretty(&manifest_payload).map_err(|e| PipelineRunError::new(PipelineStage::DraftSaving, "PIPELINE_ERROR", format!("{e}")))?).map_err(|e| PipelineRunError::new(PipelineStage::DraftSaving, "PIPELINE_ERROR", format!("Failed to write manifest: {e}")))?;

  let capcut_artifact = ArtifactStore::register_artifact(&work_dir, job.id.as_str(), "step-6-capcut", "CapCutAdapter", "capcut_draft", &draft_manifest_path, json!({ "draft_id": draft_id })).map_err(|e| PipelineRunError::new(PipelineStage::DraftSaving, "PIPELINE_ERROR", format!("{e:?}")))?;

  outputs["draft_url"] = json!(saved_url);
  outputs["capcut_artifact"] = json!(capcut_artifact);
  outputs["draft_manifest"] = manifest_payload;
  persist_outputs(task_database, &job.id, PipelineStage::DraftReady, &serialize_outputs(&outputs)?).await?;

  // 6. Terminal completion, gated by the requested output_mode.
  match output_mode {
    OutputMode::DraftOnly => {
      info!("[JOB][DRAFT_ONLY] output_mode=draft_only — completing at DraftReady without render.");
      outputs["video_url"] = Value::Null;
      outputs["rendering_supported"] = json!(false);
      finalize_draft_ready(app_handle, task_database, &job.id, &saved_url, &serialize_outputs(&outputs)?).await?;
    },
    OutputMode::RenderVideo => {
      check_cancelled(&job_id_str, PipelineStage::Rendering)?;
      emit_stage_progress(app_handle, task_database, &job.id, PipelineStage::DraftReady, PipelineStage::Rendering, 85, "Rendering video").await?;
      let _gpu_permit = dispatcher.acquire_gpu().await;

      info!("[JOB][CAPCUT] Rendering video (output_mode=render_video)...");
      let render_res = async {
        capcut_gen_video(client, &saved_url).await?;
        capcut_poll_gen_video_status(client, &saved_url, Some(Arc::clone(cancel_flag))).await
      }
      .await;

      match render_res {
        Ok(video_url) => {
          outputs["video_url"] = json!(video_url);
          outputs["rendering_supported"] = json!(true);
          finalize_completed(app_handle, task_database, &job.id, &saved_url, &video_url, &serialize_outputs(&outputs)?).await?;
        },
        Err(render_err) => {
          let err_str = format!("{render_err:?}");
          let code = extract_error_code(&err_str);
          if code == "RENDER_CANCELLED" {
            return Err(PipelineRunError::new(PipelineStage::Rendering, "RENDER_CANCELLED", err_str).into());
          }
          if allow_draft_fallback {
            warn!("[JOB][RENDER_FALLBACK] Render failed but allow_draft_fallback=true. Completing at DraftReady.");
            outputs["video_url"] = Value::Null;
            outputs["rendering_supported"] = json!(false);
            outputs["render_error"] = json!(err_str);
            finalize_draft_ready(app_handle, task_database, &job.id, &saved_url, &serialize_outputs(&outputs)?).await?;
          } else {
            // User asked for a real video and we could not produce one: fail.
            return Err(PipelineRunError::new(PipelineStage::Rendering, &code, err_str).into());
          }
        },
      }
    },
  }

  Ok(())
}

async fn finalize_completed(app_handle: &AppHandle, task_database: &TaskDatabase, job_id: &PipelineJobId, draft_url: &str, video_url: &str, outputs_string: &str) -> AnyhowResult<()> {
  update_pipeline_job_stage(UpdatePipelineJobStageArgs { db: task_database.get_connection(), pipeline_job_id: job_id, current_stage: PipelineStage::Completed, maybe_stage_outputs: Some(outputs_string) }).await?;
  update_pipeline_job_status(UpdatePipelineJobStatusArgs { db: task_database.get_connection(), pipeline_job_id: job_id, status: TaskStatus::CompleteSuccess }).await?;
  emit_job_complete(app_handle, JobCompletePayload { job_id: job_id.as_str().to_string(), result_type: "video".to_string(), stage: PipelineStage::Completed.to_str().to_string(), progress: 100, draft_url: draft_url.to_string(), video_url: Some(video_url.to_string()), rendering_supported: true });
  Ok(())
}

async fn finalize_draft_ready(app_handle: &AppHandle, task_database: &TaskDatabase, job_id: &PipelineJobId, draft_url: &str, outputs_string: &str) -> AnyhowResult<()> {
  update_pipeline_job_stage(UpdatePipelineJobStageArgs { db: task_database.get_connection(), pipeline_job_id: job_id, current_stage: PipelineStage::DraftReady, maybe_stage_outputs: Some(outputs_string) }).await?;
  update_pipeline_job_status(UpdatePipelineJobStatusArgs { db: task_database.get_connection(), pipeline_job_id: job_id, status: TaskStatus::CompleteSuccess }).await?;
  emit_job_complete(app_handle, JobCompletePayload { job_id: job_id.as_str().to_string(), result_type: "draft".to_string(), stage: PipelineStage::DraftReady.to_str().to_string(), progress: 100, draft_url: draft_url.to_string(), video_url: None, rendering_supported: false });
  Ok(())
}

fn map_capcut_error(stage: PipelineStage, err: &anyhow::Error) -> PipelineRunError {
  let err_str = format!("{err:?}");
  let code = extract_error_code(&err_str);
  PipelineRunError::new(stage, &code, err_str)
}

async fn emit_stage_progress(app_handle: &AppHandle, task_database: &TaskDatabase, job_id: &PipelineJobId, current: PipelineStage, next: PipelineStage, progress: u32, message: &str) -> AnyhowResult<()> {
  update_pipeline_job_stage(UpdatePipelineJobStageArgs { db: task_database.get_connection(), pipeline_job_id: job_id, current_stage: next, maybe_stage_outputs: None }).await?;

  emit_stage_complete(app_handle, StageCompletePayload { job_id: job_id.as_str().to_string(), completed_stage: current.to_str().to_string(), next_stage: next.to_str().to_string(), progress, stage_message: Some(message.to_string()) });

  Ok(())
}

async fn persist_outputs(task_database: &TaskDatabase, job_id: &PipelineJobId, stage: PipelineStage, stage_outputs: &str) -> AnyhowResult<()> {
  update_pipeline_job_stage(UpdatePipelineJobStageArgs { db: task_database.get_connection(), pipeline_job_id: job_id, current_stage: stage, maybe_stage_outputs: Some(stage_outputs) }).await?;
  Ok(())
}

fn serialize_outputs(outputs: &Value) -> AnyhowResult<String> {
  Ok(serde_json::to_string(outputs)?)
}

fn parse_input(job: &PipelineJob) -> Value {
  job.maybe_input_payload.as_deref().and_then(|s| serde_json::from_str::<Value>(s).ok()).unwrap_or_else(|| json!({}))
}

fn parse_stage_outputs(job: &PipelineJob) -> Value {
  job.maybe_stage_outputs.as_deref().and_then(|s| serde_json::from_str::<Value>(s).ok()).unwrap_or_else(|| json!({}))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn output_mode_parses_render_video_and_defaults_to_draft_only() {
    assert_eq!(OutputMode::parse(Some("render_video")), OutputMode::RenderVideo);
    assert_eq!(OutputMode::parse(Some("draft_only")), OutputMode::DraftOnly);
    assert_eq!(OutputMode::parse(None), OutputMode::DraftOnly);
    assert_eq!(OutputMode::parse(Some("garbage")), OutputMode::DraftOnly);
  }

  #[test]
  fn error_code_extraction_recognizes_render_and_llm_codes() {
    assert_eq!(extract_error_code("boom RENDER_TIMEOUT boom"), "RENDER_TIMEOUT");
    assert_eq!(extract_error_code("LLM_INVALID_RESPONSE: bad json"), "LLM_INVALID_RESPONSE");
    assert_eq!(extract_error_code("nothing matches here"), "PIPELINE_ERROR");
  }
}
