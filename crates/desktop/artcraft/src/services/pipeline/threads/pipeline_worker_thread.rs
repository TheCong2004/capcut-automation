//! The pipeline worker: a background loop that drives multi-stage pipeline jobs
//! from `pending` to `complete_success` (or `complete_failure`).
//!
//! Pattern mirrors `services/sora/threads/sora_task_polling/sora_task_polling_thread.rs`:
//! an outer loop that catches errors + sleeps, and an inner loop that reads
//! pending jobs and processes them one stage at a time.
//!
//! MVP stages (see `PipelineStage`):
//!   ScriptGeneration --(OmniRoute)--> VideoAssembly --(CapCut Mate)--> Done
//!
//! The CommandDispatcher gates each stage: script generation takes a CPU permit,
//! video assembly takes a GPU permit (rendering is the heavy step).

use crate::core::state::data_dir::app_data_root::AppDataRoot;
use crate::core::state::task_database::TaskDatabase;
use crate::services::pipeline::clients::capcut_mate_client::assemble_and_render;
use crate::services::pipeline::clients::omniroute_client::generate_script;
use crate::services::pipeline::events::{
  emit_job_complete, emit_job_failed, emit_stage_complete, JobCompletePayload, JobFailedPayload,
  StageCompletePayload,
};
use crate::services::pipeline::state::command_dispatcher::CommandDispatcher;
use enums::tauri::pipeline::pipeline_stage::PipelineStage;
use enums::tauri::tasks::task_status::TaskStatus;
use errors::AnyhowResult;
use log::{error, info};
use once_cell::sync::Lazy;
use serde_json::{json, Value};
use sqlite_tasks::queries::pipeline::fail_pipeline_job::{fail_pipeline_job, FailPipelineJobArgs};
use sqlite_tasks::queries::pipeline::list_pending_pipeline_jobs::{
  list_pending_pipeline_jobs, ListPendingPipelineJobsArgs,
};
use sqlite_tasks::queries::pipeline::pipeline_job::PipelineJob;
use sqlite_tasks::queries::pipeline::update_pipeline_job_stage::{
  update_pipeline_job_stage, UpdatePipelineJobStageArgs,
};
use sqlite_tasks::queries::pipeline::update_pipeline_job_status::{
  update_pipeline_job_status, UpdatePipelineJobStatusArgs,
};
use std::collections::HashSet;
use tauri::AppHandle;
use tokens::tokens::sqlite::pipeline_jobs::PipelineJobId;

/// Statuses that mean "the worker should still act on this job".
static PIPELINE_PENDING_STATUSES: Lazy<HashSet<TaskStatus>> = Lazy::new(|| {
  let mut set = HashSet::new();
  set.insert(TaskStatus::Pending);
  set.insert(TaskStatus::Started);
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
      error!("Pipeline worker loop error: {:?}", err);
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
      let stage = job.current_stage;

      let result = process_stage(app_handle, task_database, dispatcher, &job).await;

      if let Err(err) = result {
        let error_message = format!("{err:?}");
        error!("Pipeline job {} failed at {}: {}", job_id.as_str(), stage.to_str(), error_message);
        fail_pipeline_job(FailPipelineJobArgs {
          db: task_database.get_connection(),
          pipeline_job_id: &job_id,
          failure_message: &error_message,
        })
        .await?;
        emit_job_failed(
          app_handle,
          JobFailedPayload {
            job_id: job_id.as_str().to_string(),
            failed_stage: stage.to_str().to_string(),
            error_message,
          },
        );
      }
    }
  }
}

/// Run whichever stage the job is currently on. Advancing the stage / marking
/// completion (and emitting the matching event) happens here on success.
async fn process_stage(
  app_handle: &AppHandle,
  task_database: &TaskDatabase,
  dispatcher: &CommandDispatcher,
  job: &PipelineJob,
) -> AnyhowResult<()> {
  match job.current_stage {
    PipelineStage::ScriptGeneration => {
      run_script_generation(app_handle, task_database, dispatcher, job).await
    }
    PipelineStage::VideoAssembly => {
      run_video_assembly(app_handle, task_database, dispatcher, job).await
    }
    PipelineStage::Done => {
      // Terminal: nothing to run. Mark success in case it wasn't already.
      update_pipeline_job_status(UpdatePipelineJobStatusArgs {
        db: task_database.get_connection(),
        pipeline_job_id: &job.id,
        status: TaskStatus::CompleteSuccess,
      })
      .await?;
      Ok(())
    }
  }
}

/// ScriptGeneration: call OmniRoute, store the script, advance to VideoAssembly.
async fn run_script_generation(
  app_handle: &AppHandle,
  task_database: &TaskDatabase,
  dispatcher: &CommandDispatcher,
  job: &PipelineJob,
) -> AnyhowResult<()> {
  let prompt = extract_prompt(job)?;

  let _permit = dispatcher.acquire_cpu().await;
  info!("Pipeline job {}: generating script", job.id.as_str());
  let script = generate_script(&prompt).await?;

  let mut outputs = parse_stage_outputs(job);
  outputs["script"] = json!(script);
  let outputs_string = serde_json::to_string(&outputs)?;

  advance_stage(
    app_handle,
    task_database,
    &job.id,
    PipelineStage::ScriptGeneration,
    PipelineStage::VideoAssembly,
    &outputs_string,
  )
  .await
}

/// VideoAssembly: read the script, render via CapCut Mate, mark the job complete.
async fn run_video_assembly(
  app_handle: &AppHandle,
  task_database: &TaskDatabase,
  dispatcher: &CommandDispatcher,
  job: &PipelineJob,
) -> AnyhowResult<()> {
  let outputs = parse_stage_outputs(job);
  let script = outputs
    .get("script")
    .and_then(|v| v.as_str())
    .ok_or_else(|| anyhow::anyhow!("VideoAssembly stage missing script from prior stage"))?;

  let _permit = dispatcher.acquire_gpu().await;
  info!("Pipeline job {}: assembling & rendering video", job.id.as_str());
  let video_url = assemble_and_render(script).await?;

  let mut outputs = outputs;
  outputs["video_url"] = json!(video_url);
  let outputs_string = serde_json::to_string(&outputs)?;

  // Advance stage to Done + persist outputs.
  update_pipeline_job_stage(UpdatePipelineJobStageArgs {
    db: task_database.get_connection(),
    pipeline_job_id: &job.id,
    current_stage: PipelineStage::Done,
    maybe_stage_outputs: Some(&outputs_string),
  })
  .await?;

  // Mark terminal success.
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
      video_url,
    },
  );

  Ok(())
}

/// Persist the new stage + outputs, mark the job `started`, and emit stage_complete.
async fn advance_stage(
  app_handle: &AppHandle,
  task_database: &TaskDatabase,
  job_id: &PipelineJobId,
  completed_stage: PipelineStage,
  next_stage: PipelineStage,
  stage_outputs: &str,
) -> AnyhowResult<()> {
  update_pipeline_job_stage(UpdatePipelineJobStageArgs {
    db: task_database.get_connection(),
    pipeline_job_id: job_id,
    current_stage: next_stage,
    maybe_stage_outputs: Some(stage_outputs),
  })
  .await?;

  // Keep the job in the active set as it moves between stages.
  update_pipeline_job_status(UpdatePipelineJobStatusArgs {
    db: task_database.get_connection(),
    pipeline_job_id: job_id,
    status: TaskStatus::Started,
  })
  .await?;

  emit_stage_complete(
    app_handle,
    StageCompletePayload {
      job_id: job_id.as_str().to_string(),
      completed_stage: completed_stage.to_str().to_string(),
      next_stage: next_stage.to_str().to_string(),
    },
  );

  Ok(())
}

/// Pull the prompt string out of the job's input payload. The payload is opaque
/// JSON set at enqueue time; we accept either `{"prompt": "..."}` or a bare
/// JSON string.
fn extract_prompt(job: &PipelineJob) -> AnyhowResult<String> {
  let raw = job
    .maybe_input_payload
    .as_deref()
    .ok_or_else(|| anyhow::anyhow!("Pipeline job {} has no input payload", job.id.as_str()))?;

  // Try structured `{ "prompt": "..." }` first.
  if let Ok(value) = serde_json::from_str::<Value>(raw) {
    if let Some(prompt) = value.get("prompt").and_then(|v| v.as_str()) {
      return Ok(prompt.to_string());
    }
    if let Some(prompt) = value.as_str() {
      return Ok(prompt.to_string());
    }
  }

  // Fall back to the raw string as the prompt.
  Ok(raw.to_string())
}

/// Parse the accumulated stage outputs JSON, defaulting to an empty object.
fn parse_stage_outputs(job: &PipelineJob) -> Value {
  job
    .maybe_stage_outputs
    .as_deref()
    .and_then(|s| serde_json::from_str::<Value>(s).ok())
    .unwrap_or_else(|| json!({}))
}
