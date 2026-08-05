//! The pipeline worker: a background loop that drives multi-stage pipeline jobs
//! from `pending` to `complete_success` (or `complete_failure`).

use crate::core::state::data_dir::app_data_root::AppDataRoot;
use crate::core::state::task_database::TaskDatabase;
use crate::services::pipeline::clients::capcut_mate_client::{
  assemble_and_process_draft, health_check as capcut_mate_health_check, DraftAssemblyResult,
};
use crate::services::pipeline::clients::omniroute_client::{
  generate_script, health_check as llm_health_check,
};
use crate::services::pipeline::events::{
  emit_job_complete, emit_job_failed, emit_stage_complete, JobCompletePayload, JobFailedPayload,
  StageCompletePayload,
};
use crate::services::pipeline::state::command_dispatcher::CommandDispatcher;
use enums::tauri::pipeline::pipeline_stage::PipelineStage;
use enums::tauri::tasks::task_status::TaskStatus;
use errors::AnyhowResult;
use log::{error, info, warn};
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
      let stage = job.current_stage;

      let result = process_stage(app_handle, task_database, dispatcher, &job).await;

      if let Err(err) = result {
        let error_message = format!("{err:?}");
        error!("[JOB][FAILED] Job {} failed at stage {}: {}", job_id.as_str(), stage.to_str(), error_message);
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

/// Run whichever stage the job is currently on.
async fn process_stage(
  app_handle: &AppHandle,
  task_database: &TaskDatabase,
  dispatcher: &CommandDispatcher,
  job: &PipelineJob,
) -> AnyhowResult<()> {
  match job.current_stage {
    PipelineStage::ScriptGeneration => {
      run_preflight_and_script_generation(app_handle, task_database, dispatcher, job).await
    }
    PipelineStage::VideoAssembly => {
      run_video_assembly(app_handle, task_database, dispatcher, job).await
    }
    PipelineStage::Done => {
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

/// Preflight Connectivity Check & Script Generation stage
async fn run_preflight_and_script_generation(
  app_handle: &AppHandle,
  task_database: &TaskDatabase,
  dispatcher: &CommandDispatcher,
  job: &PipelineJob,
) -> AnyhowResult<()> {
  let prompt = extract_prompt(job)?;
  if prompt.trim().is_empty() {
    return Err(anyhow::anyhow!("PREFLIGHT_FAILED: Job prompt is empty"));
  }

  info!("[JOB][PREFLIGHT] Checking LLM and CapCut Mate service readiness...");
  if let Err(err) = llm_health_check().await {
    return Err(anyhow::anyhow!("PREFLIGHT_FAILED: LLM service unreachable: {err}"));
  }

  if let Err(err) = capcut_mate_health_check().await {
    return Err(anyhow::anyhow!("PREFLIGHT_FAILED: CapCut Mate service unreachable: {err}"));
  }
  info!("[JOB][PREFLIGHT] All dependency services are reachable.");

  let _permit = dispatcher.acquire_cpu().await;
  info!("[JOB][LLM] Generating script for prompt (len={})", prompt.len());
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

/// Video Assembly, Draft Creation, Captioning, and Export/Draft Output stage
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
    .ok_or_else(|| anyhow::anyhow!("VideoAssembly stage missing script output"))?;

  let _permit = dispatcher.acquire_gpu().await;
  info!("[JOB][CAPCUT_CREATE_DRAFT] Assembling draft project from script...");
  let result: DraftAssemblyResult = assemble_and_process_draft(script).await?;

  let final_output_url = result.video_url.unwrap_or_else(|| result.draft_url.clone());
  info!("[JOB][DONE] Draft assembly complete. Final output: {}", final_output_url);

  let mut outputs = outputs;
  outputs["draft_url"] = json!(result.draft_url);
  outputs["draft_id"] = json!(result.draft_id);
  outputs["video_url"] = json!(final_output_url);
  outputs["rendering_supported"] = json!(result.rendering_supported);
  let outputs_string = serde_json::to_string(&outputs)?;

  update_pipeline_job_stage(UpdatePipelineJobStageArgs {
    db: task_database.get_connection(),
    pipeline_job_id: &job.id,
    current_stage: PipelineStage::Done,
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
      video_url: final_output_url,
    },
  );

  Ok(())
}

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

fn extract_prompt(job: &PipelineJob) -> AnyhowResult<String> {
  let raw = job
    .maybe_input_payload
    .as_deref()
    .ok_or_else(|| anyhow::anyhow!("Pipeline job {} missing input payload", job.id.as_str()))?;

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
  job
    .maybe_stage_outputs
    .as_deref()
    .and_then(|s| serde_json::from_str::<Value>(s).ok())
    .unwrap_or_else(|| json!({}))
}
