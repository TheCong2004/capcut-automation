//! The pipeline worker: a background loop that drives multi-stage pipeline jobs
//! from `pending` to `complete_success` (or `complete_failure`).

use crate::core::state::data_dir::app_data_root::AppDataRoot;
use crate::core::state::task_database::TaskDatabase;
use crate::services::pipeline::clients::capcut_mate_client::{assemble_and_process_draft, health_check as capcut_mate_health_check, DraftAssemblyResult};
use crate::services::pipeline::clients::omniroute_client::{generate_script, health_check as llm_health_check};
use crate::services::pipeline::events::{emit_job_complete, emit_job_failed, emit_stage_complete, JobCompletePayload, JobFailedPayload, StageCompletePayload};
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
use tauri::AppHandle;
use tokens::tokens::sqlite::pipeline_jobs::PipelineJobId;

/// Statuses that mean "the worker should still act on this job".
static PIPELINE_PENDING_STATUSES: Lazy<HashSet<TaskStatus>> = Lazy::new(|| {
  let mut set = HashSet::new();
  set.insert(TaskStatus::Pending);
  set
});

/// Idle sleep when there is nothing to do.
const IDLE_SLEEP_MS: u64 = 2_000;
/// Sleep after an unexpected error in the outer loop.
const ERROR_SLEEP_MS: u64 = 5_000;

pub async fn pipeline_worker_thread(app_handle: AppHandle, _app_data_root: AppDataRoot, task_database: TaskDatabase, dispatcher: CommandDispatcher) -> ! {
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

      let result = run_job_pipeline(app_handle, task_database, dispatcher, &job).await;

      if let Err(err) = result {
        let err_str = format!("{err:?}");
        let err_code = extract_error_code(&err_str);
        error!("[JOB][FAILED] Job {} failed: {}", job_id.as_str(), err_str);

        fail_pipeline_job(FailPipelineJobArgs { db: task_database.get_connection(), pipeline_job_id: &job_id, failure_message: &err_str }).await?;

        emit_job_failed(app_handle, JobFailedPayload { job_id: job_id.as_str().to_string(), failed_stage: job.current_stage.to_str().to_string(), error_code: err_code, error_message: err_str });
      }
    }
  }
}

/// Helper to parse standard error codes (e.g. LLM_UNAVAILABLE, RENDER_FAILED, PREFLIGHT_FAILED).
fn extract_error_code(err_str: &str) -> String {
  for code in &["LLM_UNAVAILABLE", "LLM_TIMEOUT", "LLM_UNAUTHORIZED", "LLM_RATE_LIMITED", "LLM_INVALID_RESPONSE", "LLM_EMPTY_SCRIPT", "CAPCUT_UNAVAILABLE", "DRAFT_CREATE_FAILED", "CAPTION_ADD_FAILED", "DRAFT_SAVE_FAILED", "RENDER_FAILED", "RENDER_TIMEOUT", "PREFLIGHT_FAILED"] {
    if err_str.contains(code) {
      return code.to_string();
    }
  }
  "PIPELINE_ERROR".to_string()
}

/// Execute full job pipeline through state machine stages.
async fn run_job_pipeline(app_handle: &AppHandle, task_database: &TaskDatabase, dispatcher: &CommandDispatcher, job: &PipelineJob) -> AnyhowResult<()> {
  let prompt = extract_prompt(job)?;
  if prompt.trim().is_empty() {
    return Err(anyhow::anyhow!("PREFLIGHT_FAILED: Prompt is empty"));
  }

  // 1. Stage: PreflightCheck (5%)
  emit_stage_progress(app_handle, task_database, &job.id, PipelineStage::PreflightCheck, PipelineStage::ScriptGenerating, 5, "Verifying service readiness").await?;

  info!("[JOB][PREFLIGHT] Checking LLM and CapCut Mate service readiness...");
  if let Err(err) = llm_health_check().await {
    return Err(anyhow::anyhow!("PREFLIGHT_FAILED: LLM service check failed: {err}"));
  }
  if let Err(err) = capcut_mate_health_check().await {
    return Err(anyhow::anyhow!("PREFLIGHT_FAILED: CapCut Mate service check failed: {err}"));
  }

  // 2. Stage: ScriptGenerating (30%)
  emit_stage_progress(app_handle, task_database, &job.id, PipelineStage::ScriptGenerating, PipelineStage::ScriptReady, 30, "Generating script via LLM").await?;
  let _cpu_permit = dispatcher.acquire_cpu().await;
  info!("[JOB][LLM] Generating script for prompt...");
  let script = generate_script(&prompt).await?;

  let mut outputs = parse_stage_outputs(job);
  outputs["script"] = json!(script);
  let outputs_string = serde_json::to_string(&outputs)?;
  persist_outputs(task_database, &job.id, PipelineStage::ScriptReady, &outputs_string).await?;

  // 3. Stage: DraftCreating & Captioning (60%)
  emit_stage_progress(app_handle, task_database, &job.id, PipelineStage::DraftCreating, PipelineStage::CaptionAdding, 60, "Creating CapCut draft and captioning").await?;
  let _gpu_permit = dispatcher.acquire_gpu().await;

  info!("[JOB][CAPCUT] Assembling draft project from script...");
  let assembly_res: DraftAssemblyResult = assemble_and_process_draft(&script, None).await?;

  let mut outputs = outputs;
  outputs["draft_url"] = json!(assembly_res.draft_url);
  outputs["draft_id"] = json!(assembly_res.draft_id);
  outputs["rendering_supported"] = json!(assembly_res.rendering_supported);

  if let Some(ref v_url) = assembly_res.video_url {
    outputs["video_url"] = json!(v_url);
  } else {
    outputs["video_url"] = json!(Value::Null);
  }

  let outputs_string = serde_json::to_string(&outputs)?;

  // 4. Terminal Stage: DraftReady vs Completed
  if let Some(video_url) = assembly_res.video_url {
    // Finished with video render -> Completed (100%)
    update_pipeline_job_stage(UpdatePipelineJobStageArgs { db: task_database.get_connection(), pipeline_job_id: &job.id, current_stage: PipelineStage::Completed, maybe_stage_outputs: Some(&outputs_string) }).await?;

    update_pipeline_job_status(UpdatePipelineJobStatusArgs { db: task_database.get_connection(), pipeline_job_id: &job.id, status: TaskStatus::CompleteSuccess }).await?;

    emit_job_complete(app_handle, JobCompletePayload { job_id: job.id.as_str().to_string(), result_type: "video".to_string(), stage: PipelineStage::Completed.to_str().to_string(), progress: 100, draft_url: assembly_res.draft_url, video_url: Some(video_url), rendering_supported: true });
  } else {
    // Finished at DraftReady (rendering unsupported) -> DraftReady (100%)
    update_pipeline_job_stage(UpdatePipelineJobStageArgs { db: task_database.get_connection(), pipeline_job_id: &job.id, current_stage: PipelineStage::DraftReady, maybe_stage_outputs: Some(&outputs_string) }).await?;

    update_pipeline_job_status(UpdatePipelineJobStatusArgs { db: task_database.get_connection(), pipeline_job_id: &job.id, status: TaskStatus::CompleteSuccess }).await?;

    emit_job_complete(app_handle, JobCompletePayload { job_id: job.id.as_str().to_string(), result_type: "draft".to_string(), stage: PipelineStage::DraftReady.to_str().to_string(), progress: 100, draft_url: assembly_res.draft_url, video_url: None, rendering_supported: false });
  }

  Ok(())
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

fn extract_prompt(job: &PipelineJob) -> AnyhowResult<String> {
  let raw = job.maybe_input_payload.as_deref().ok_or_else(|| anyhow::anyhow!("Pipeline job {} missing input payload", job.id.as_str()))?;

  if let Ok(value) = serde_json::from_str::<Value>(raw) {
    if let Some(prompt) = value.get("prompt").and_then(|v| v.as_str()) {
      return Ok(prompt.to_string());
    }
    if let Some(prompt) = value.as_str() {
      return Ok(prompt.to_string());
    }
  }

  Ok(raw.to_string())
}

fn parse_stage_outputs(job: &PipelineJob) -> Value {
  job.maybe_stage_outputs.as_deref().and_then(|s| serde_json::from_str::<Value>(s).ok()).unwrap_or_else(|| json!({}))
}
