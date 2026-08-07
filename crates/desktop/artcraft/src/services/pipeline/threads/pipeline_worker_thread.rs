//! The pipeline worker: a background loop that drives multi-stage pipeline jobs
//! from `pending` to `complete_success` (or `complete_failure`).

use crate::core::state::data_dir::app_data_root::AppDataRoot;
use crate::core::state::task_database::TaskDatabase;
use crate::services::pipeline::artifact_store::ArtifactStore;
use crate::services::pipeline::caption_segmenter::segment_script_to_captions;
use crate::services::pipeline::clients::capcut_mate_client::{
  add_captions as capcut_add_captions, create_draft as capcut_create_draft, gen_video as capcut_gen_video, health_check as capcut_mate_health_check, poll_gen_video_status as capcut_poll_gen_video_status, save_draft as capcut_save_draft, verify_draft_exists as capcut_verify_draft_exists, DEFAULT_HEIGHT, DEFAULT_WIDTH,
};
use crate::services::pipeline::clients::omniroute_client::{generate_script, health_check as llm_health_check};
use crate::services::pipeline::events::{
  emit_job_complete, emit_job_failed, emit_stage_complete, JobCompletePayload, JobFailedPayload, StageCompletePayload,
};
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
use tokio::sync::OnceCell as TokioOnceCell;

/// Structured pipeline run error mapping each failure to the stage it occurred in.
#[derive(Debug, Clone)]
pub struct PipelineRunError {
  pub stage: PipelineStage,
  pub error_code: String,
  pub error_message: String,
}

impl PipelineRunError {
  pub fn new(stage: PipelineStage, error_code: &str, error_message: String) -> Self {
    Self {
      stage,
      error_code: error_code.to_string(),
      error_message,
    }
  }

  pub fn from_anyhow(stage: PipelineStage, err: &anyhow::Error) -> Self {
    let err_str = format!("{err:?}");
    let err_code = extract_error_code(&err_str);
    Self::new(stage, &err_code, err_str)
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
  let client = CAPCUT_CLIENT
    .get_or_init(|| async {
      reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .expect("Failed to build CapCut Mate HTTP client")
    })
    .await;
  Ok(client)
}

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

pub async fn pipeline_worker_thread(
  app_handle: AppHandle,
  _app_data_root: AppDataRoot,
  task_database: TaskDatabase,
  dispatcher: CommandDispatcher,
) -> ! {
  loop {
    let res = worker_loop(&app_handle, &task_database, &dispatcher).await;
    if let Err(err) = res {
      error!("[JOB][OUTER_LOOP_ERROR] Pipeline worker loop error: {:?}", err);
    }
    tokio::time::sleep(std::time::Duration::from_millis(ERROR_SLEEP_MS)).await;
  }
}

async fn worker_loop(
  app_handle: &AppHandle,
  task_database: &TaskDatabase,
  dispatcher: &CommandDispatcher,
) -> AnyhowResult<()> {
  loop {
    let pending = list_pending_pipeline_jobs(ListPendingPipelineJobsArgs {
      db: task_database.get_connection(),
      statuses: &PIPELINE_PENDING_STATUSES,
    })
    .await?;

    if pending.jobs.is_empty() {
      tokio::time::sleep(std::time::Duration::from_millis(IDLE_SLEEP_MS)).await;
      continue;
    }

    for job in pending.jobs {
      let job_id = job.id.clone();

      // Atomic job claim: update status from Pending -> Started
      let claimed = update_pipeline_job_status(UpdatePipelineJobStatusArgs {
        db: task_database.get_connection(),
        pipeline_job_id: &job_id,
        status: TaskStatus::Started,
      })
      .await?;

      if !claimed {
        warn!("[JOB][CLAIM_SKIP] Job {} was already claimed by another process", job_id.as_str());
        continue;
      }

      // Set stage to PreflightCheck synchronously at claim time so the DB
      // reflects the real starting stage (fixes "failed at queued").
      let _ = update_pipeline_job_stage(UpdatePipelineJobStageArgs {
        db: task_database.get_connection(),
        pipeline_job_id: &job_id,
        current_stage: PipelineStage::PreflightCheck,
        maybe_stage_outputs: None,
      })
      .await;

      let result = run_job_pipeline(app_handle, task_database, dispatcher, &job).await;

      if let Err(err) = result {
        // IMPORTANT: do NOT read `job.current_stage` from the stale snapshot
        // taken BEFORE the pipeline ran. Use the stage captured inside the error.
        let run_error = extract_pipeline_error(&err);
        let err_str = run_error.error_message.clone();
        error!("[JOB][FAILED] Job {} failed at {}: {} (code={})", job_id.as_str(), run_error.stage.to_str(), err_str, run_error.error_code);

        fail_pipeline_job(FailPipelineJobArgs {
          db: task_database.get_connection(),
          pipeline_job_id: &job_id,
          failure_message: &err_str,
        })
        .await?;

        emit_job_failed(
          app_handle,
          JobFailedPayload {
            job_id: job_id.as_str().to_string(),
            failed_stage: run_error.stage.to_str().to_string(),
            error_code: run_error.error_code,
            error_message: err_str,
          },
        );
      }
    }
  }
}

/// Helper to parse standard error codes (e.g. LLM_UNAVAILABLE, RENDER_FAILED, PREFLIGHT_FAILED).
fn extract_error_code(err_str: &str) -> String {
  for code in &[
    "LLM_UNAVAILABLE",
    "LLM_TIMEOUT",
    "LLM_UNAUTHORIZED",
    "LLM_RATE_LIMITED",
    "LLM_INVALID_RESPONSE",
    "LLM_EMPTY_SCRIPT",
    "CAPCUT_UNAVAILABLE",
    "DRAFT_CREATE_FAILED",
    "CAPTION_ADD_FAILED",
    "DRAFT_SAVE_FAILED",
    "RENDER_FAILED",
    "RENDER_TIMEOUT",
    "PREFLIGHT_FAILED",
  ] {
    if err_str.contains(code) {
      return code.to_string();
    }
  }
  "PIPELINE_ERROR".to_string()
}

/// Execute full job pipeline through state machine stages.
async fn run_job_pipeline(
  app_handle: &AppHandle,
  task_database: &TaskDatabase,
  dispatcher: &CommandDispatcher,
  job: &PipelineJob,
) -> AnyhowResult<()> {
  let prompt = extract_prompt(job)?;
  if prompt.trim().is_empty() {
    return Err(PipelineRunError::new(PipelineStage::PreflightCheck, "PREFLIGHT_FAILED", "Prompt is empty".to_string()).into());
  }

  // 1. Stage: PreflightCheck (5%)
  emit_stage_progress(app_handle, task_database, &job.id, PipelineStage::PreflightCheck, PipelineStage::ScriptGenerating, 5, "Verifying service readiness").await?;

  info!("[JOB][PREFLIGHT] Checking LLM and CapCut Mate service readiness...");
  if let Err(err) = llm_health_check().await {
    return Err(PipelineRunError::new(PipelineStage::PreflightCheck, "PREFLIGHT_FAILED", format!("LLM service check failed: {err}")).into());
  }
  if let Err(err) = capcut_mate_health_check().await {
    return Err(PipelineRunError::new(PipelineStage::PreflightCheck, "PREFLIGHT_FAILED", format!("CapCut Mate service check failed: {err}")).into());
  }

  // 2. Stage: ScriptGenerating (30%)
  let _cpu_permit = dispatcher.acquire_cpu().await;
  info!("[JOB][LLM] Generating script for prompt...");
  let script = generate_script(&prompt).await.map_err(|e| {
    let err_str = format!("{e:?}");
    let code = extract_error_code(&err_str);
    PipelineRunError::new(PipelineStage::ScriptGenerating, &code, err_str)
  })?;

  // Write script artifact to disk & register via ArtifactStore
  let work_dir = std::path::PathBuf::from("artifacts").join(job.id.as_str());
  let script_dir = work_dir.join("script");
  let _ = std::fs::create_dir_all(&script_dir);
  let script_file_path = script_dir.join("script.json");
  let script_json_payload = json!({
    "title": prompt,
    "hook": "Script generated by OmniRoute Adapter",
    "cta": "Like & Subscribe",
    "language": "vi",
    "targetDurationSeconds": 20,
    "narration_script": script
  });
  let _ = std::fs::write(&script_file_path, serde_json::to_string_pretty(&script_json_payload)?);

  let script_artifact = ArtifactStore::register_artifact(
    job.id.as_str(),
    "step-2-omniroute",
    "OmniRouteAdapter",
    "script",
    &script_file_path,
    json!({ "prompt": prompt }),
  )?;

  let mut outputs = parse_stage_outputs(job);
  outputs["script"] = json!(script);
  outputs["script_artifact"] = json!(script_artifact);
  let outputs_string = serde_json::to_string(&outputs)?;
  persist_outputs(task_database, &job.id, PipelineStage::ScriptReady, &outputs_string).await?;

  // 3. Stage: DraftCreating (45%)
  emit_stage_progress(app_handle, task_database, &job.id, PipelineStage::ScriptReady, PipelineStage::DraftCreating, 45, "Creating CapCut draft").await?;
  let client = get_capcut_client().await?;
  info!("[JOB][CAPCUT] Creating draft project...");
  let (draft_url, draft_id) = capcut_create_draft(client, DEFAULT_WIDTH, DEFAULT_HEIGHT).await.map_err(|e| {
    let err_str = format!("{e:?}");
    let code = extract_error_code(&err_str);
    PipelineRunError::new(PipelineStage::DraftCreating, &code, err_str)
  })?;

  outputs["draft_url"] = json!(draft_url);
  outputs["draft_id"] = json!(draft_id);
  let outputs_string = serde_json::to_string(&outputs)?;
  persist_outputs(task_database, &job.id, PipelineStage::DraftCreated, &outputs_string).await?;

  // 4. Stage: CaptionAdding (60%)
  emit_stage_progress(app_handle, task_database, &job.id, PipelineStage::DraftCreated, PipelineStage::CaptionAdding, 60, "Adding captions to draft").await?;
  info!("[JOB][CAPCUT] Segmenting script and injecting captions...");
  let captions = segment_script_to_captions(&script);
  capcut_add_captions(client, &draft_url, &captions).await.map_err(|e| {
    let err_str = format!("{e:?}");
    let code = extract_error_code(&err_str);
    PipelineRunError::new(PipelineStage::CaptionAdding, &code, err_str)
  })?;

  // 5. Stage: DraftSaving (75%)
  emit_stage_progress(app_handle, task_database, &job.id, PipelineStage::CaptionAdding, PipelineStage::DraftSaving, 75, "Saving draft project").await?;
  info!("[JOB][CAPCUT] Saving draft and verifying project...");
  let saved_url = capcut_save_draft(client, &draft_url).await.map_err(|e| {
    let err_str = format!("{e:?}");
    let code = extract_error_code(&err_str);
    PipelineRunError::new(PipelineStage::DraftSaving, &code, err_str)
  })?;

  capcut_verify_draft_exists(client, &draft_id).await.map_err(|e| {
    let err_str = format!("{e:?}");
    let code = extract_error_code(&err_str);
    PipelineRunError::new(PipelineStage::DraftSaving, &code, err_str)
  })?;

  // Save CapCut draft manifest to disk & register via ArtifactStore
  let capcut_dir = work_dir.join("capcut");
  let _ = std::fs::create_dir_all(&capcut_dir);
  let draft_manifest_path = capcut_dir.join("draft_manifest.json");
  let capcut_manifest_payload = json!({
    "draftId": draft_id,
    "draftPath": saved_url,
    "visualTrackCount": 1,
    "audioTrackCount": 1,
    "captionTrackCount": captions.len(),
    "timelineDurationUs": 20000000
  });
  let _ = std::fs::write(&draft_manifest_path, serde_json::to_string_pretty(&capcut_manifest_payload)?);

  let capcut_artifact = ArtifactStore::register_artifact(
    job.id.as_str(),
    "step-6-capcut",
    "CapCutAdapter",
    "capcut_draft",
    &draft_manifest_path,
    json!({ "draft_id": draft_id }),
  )?;

  outputs["draft_url"] = json!(saved_url);
  outputs["capcut_artifact"] = json!(capcut_artifact);
  let outputs_string = serde_json::to_string(&outputs)?;
  persist_outputs(task_database, &job.id, PipelineStage::DraftReady, &outputs_string).await?;

  // 6. Stage: VideoRendering / Terminal Completion
  emit_stage_progress(app_handle, task_database, &job.id, PipelineStage::DraftReady, PipelineStage::Rendering, 85, "Rendering video").await?;
  let _gpu_permit = dispatcher.acquire_gpu().await;

  info!("[JOB][CAPCUT] Attempting video rendering...");
  let render_res = async {
    capcut_gen_video(client, &saved_url).await?;
    capcut_poll_gen_video_status(client, &saved_url, None).await
  }
  .await;

  match render_res {
    Ok(video_url) => {
      outputs["video_url"] = json!(video_url);
      outputs["rendering_supported"] = json!(true);
      let outputs_string = serde_json::to_string(&outputs)?;

      update_pipeline_job_stage(UpdatePipelineJobStageArgs {
        db: task_database.get_connection(),
        pipeline_job_id: &job.id,
        current_stage: PipelineStage::Completed,
        maybe_stage_outputs: Some(&outputs_string),
      })
      .await?;

      update_pipeline_job_status(UpdatePipelineJobStatusArgs {
        db: task_database.get_connection(),
        pipeline_job_id: &job.id,
        status: TaskStatus::CompleteSuccess,
      })
      .await?;

      emit_job_complete(
        app_handle,
        JobCompletePayload {
          job_id: job.id.as_str().to_string(),
          result_type: "video".to_string(),
          stage: PipelineStage::Completed.to_str().to_string(),
          progress: 100,
          draft_url: saved_url,
          video_url: Some(video_url),
          rendering_supported: true,
        },
      );
    }
    Err(render_err) => {
      warn!("[JOB][RENDER_SKIP] Video rendering not completed: {render_err:?}. Completing job at DraftReady.");
      outputs["video_url"] = json!(Value::Null);
      outputs["rendering_supported"] = json!(false);
      let outputs_string = serde_json::to_string(&outputs)?;

      update_pipeline_job_stage(UpdatePipelineJobStageArgs {
        db: task_database.get_connection(),
        pipeline_job_id: &job.id,
        current_stage: PipelineStage::DraftReady,
        maybe_stage_outputs: Some(&outputs_string),
      })
      .await?;

      update_pipeline_job_status(UpdatePipelineJobStatusArgs {
        db: task_database.get_connection(),
        pipeline_job_id: &job.id,
        status: TaskStatus::CompleteSuccess,
      })
      .await?;

      emit_job_complete(
        app_handle,
        JobCompletePayload {
          job_id: job.id.as_str().to_string(),
          result_type: "draft".to_string(),
          stage: PipelineStage::DraftReady.to_str().to_string(),
          progress: 100,
          draft_url: saved_url,
          video_url: None,
          rendering_supported: false,
        },
      );
    }
  }

  Ok(())
}

async fn emit_stage_progress(
  app_handle: &AppHandle,
  task_database: &TaskDatabase,
  job_id: &PipelineJobId,
  current: PipelineStage,
  next: PipelineStage,
  progress: u32,
  message: &str,
) -> AnyhowResult<()> {
  update_pipeline_job_stage(UpdatePipelineJobStageArgs {
    db: task_database.get_connection(),
    pipeline_job_id: job_id,
    current_stage: next,
    maybe_stage_outputs: None,
  })
  .await?;

  emit_stage_complete(
    app_handle,
    StageCompletePayload {
      job_id: job_id.as_str().to_string(),
      completed_stage: current.to_str().to_string(),
      next_stage: next.to_str().to_string(),
      progress,
      stage_message: Some(message.to_string()),
    },
  );

  Ok(())
}

async fn persist_outputs(
  task_database: &TaskDatabase,
  job_id: &PipelineJobId,
  stage: PipelineStage,
  stage_outputs: &str,
) -> AnyhowResult<()> {
  update_pipeline_job_stage(UpdatePipelineJobStageArgs {
    db: task_database.get_connection(),
    pipeline_job_id: job_id,
    current_stage: stage,
    maybe_stage_outputs: Some(stage_outputs),
  })
  .await?;
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
