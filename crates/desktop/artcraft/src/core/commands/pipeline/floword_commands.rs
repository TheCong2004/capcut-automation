use crate::core::commands::response::shorthand::ResponseOrErrorMessage;
use crate::core::commands::response::success_response_wrapper::SerializeMarker;
use crate::core::state::task_database::TaskDatabase;
use enums::tauri::pipeline::pipeline_stage::PipelineStage;
use enums::tauri::tasks::task_status::TaskStatus;
use errors::AnyhowResult;
use log::{error, info};
use serde_derive::{Deserialize, Serialize};
use sqlite_tasks::queries::pipeline::create_pipeline_job::{create_pipeline_job, CreatePipelineJobArgs};
use sqlite_tasks::queries::pipeline::list_pending_pipeline_jobs::{list_pending_pipeline_jobs, ListPendingPipelineJobsArgs};
use sqlite_tasks::queries::pipeline::update_pipeline_job_stage::{update_pipeline_job_stage, UpdatePipelineJobStageArgs};
use sqlite_tasks::queries::pipeline::update_pipeline_job_status::{update_pipeline_job_status, UpdatePipelineJobStatusArgs};
use std::collections::HashSet;
use tauri::State;
use tokens::tokens::sqlite::pipeline_jobs::PipelineJobId;

#[derive(Deserialize, Serialize)]
pub struct EnqueueFlowordWorkflowRequest {
  pub workflow_name: String,
  pub prompt: String,
  pub topic: Option<String>,
  pub source_urls: Option<Vec<String>>,
  pub target_platform: Option<String>,
  pub target_duration_seconds: Option<u32>,
  pub output_mode: Option<String>,
  pub model_id: Option<String>,
}

#[derive(Serialize)]
pub struct EnqueueFlowordWorkflowResponse {
  pub workflow_id: String,
  pub status: String,
}
impl SerializeMarker for EnqueueFlowordWorkflowResponse {}

#[derive(Deserialize)]
pub struct GetFlowordWorkflowRequest {
  pub workflow_id: String,
}

#[derive(Serialize)]
pub struct GetFlowordWorkflowResponse {
  pub workflow_id: String,
  pub status: String,
  pub current_stage: String,
  pub failure_message: Option<String>,
  pub stage_outputs: Option<String>,
}
impl SerializeMarker for GetFlowordWorkflowResponse {}

#[derive(Deserialize)]
pub struct CancelFlowordWorkflowRequest {
  pub workflow_id: String,
}

#[derive(Serialize)]
pub struct CancelFlowordWorkflowResponse {
  pub cancelled: bool,
}
impl SerializeMarker for CancelFlowordWorkflowResponse {}

#[derive(Deserialize)]
pub struct RetryFlowordStepRequest {
  pub workflow_id: String,
  pub step_id: String,
}

#[derive(Serialize)]
pub struct RetryFlowordStepResponse {
  pub retried: bool,
}
impl SerializeMarker for RetryFlowordStepResponse {}

#[tauri::command]
pub async fn enqueue_floword_workflow(
  task_database: State<'_, TaskDatabase>,
  request: EnqueueFlowordWorkflowRequest,
) -> ResponseOrErrorMessage<EnqueueFlowordWorkflowResponse> {
  info!("enqueue_floword_workflow called for prompt: {}", request.prompt);

  let input_payload = serde_json::to_string(&request).unwrap_or_default();
  let job_id = create_pipeline_job(CreatePipelineJobArgs {
    db: task_database.get_connection(),
    status: TaskStatus::Pending,
    current_stage: PipelineStage::Queued,
    maybe_input_payload: Some(&input_payload),
  })
  .await
  .map_err(|err| {
    error!("enqueue_floword_workflow failed: {:?}", err);
    "enqueue_floword_workflow failed"
  })?;

  Ok(EnqueueFlowordWorkflowResponse {
    workflow_id: job_id.as_str().to_string(),
    status: "queued".to_string(),
  }
  .into())
}

#[tauri::command]
pub async fn get_floword_workflow(
  task_database: State<'_, TaskDatabase>,
  request: GetFlowordWorkflowRequest,
) -> ResponseOrErrorMessage<GetFlowordWorkflowResponse> {
  let mut statuses = HashSet::new();
  statuses.insert(TaskStatus::Pending);
  statuses.insert(TaskStatus::Started);
  statuses.insert(TaskStatus::CompleteSuccess);
  statuses.insert(TaskStatus::CompleteFailure);
  statuses.insert(TaskStatus::CancelledByUser);

  let list = list_pending_pipeline_jobs(ListPendingPipelineJobsArgs {
    db: task_database.get_connection(),
    statuses: &statuses,
  })
  .await
  .map_err(|err| {
    error!("get_floword_workflow failed: {:?}", err);
    "get_floword_workflow failed"
  })?;

  let match_job = list.jobs.into_iter().find(|j| j.id.as_str() == request.workflow_id);

  if let Some(job) = match_job {
    Ok(GetFlowordWorkflowResponse {
      workflow_id: job.id.as_str().to_string(),
      status: job.status.to_str().to_string(),
      current_stage: job.current_stage.to_str().to_string(),
      failure_message: job.maybe_on_failure_message,
      stage_outputs: job.maybe_stage_outputs,
    }
    .into())
  } else {
    Err("Workflow job not found".into())
  }
}

#[derive(Serialize)]
pub struct ListFlowordWorkflowsResponse {
  pub workflows: Vec<GetFlowordWorkflowResponse>,
}
impl SerializeMarker for ListFlowordWorkflowsResponse {}

#[tauri::command]
pub async fn list_floword_workflows(
  task_database: State<'_, TaskDatabase>,
) -> ResponseOrErrorMessage<ListFlowordWorkflowsResponse> {
  let mut statuses = HashSet::new();
  statuses.insert(TaskStatus::Pending);
  statuses.insert(TaskStatus::Started);
  statuses.insert(TaskStatus::CompleteSuccess);
  statuses.insert(TaskStatus::CompleteFailure);
  statuses.insert(TaskStatus::CancelledByUser);

  let list = list_pending_pipeline_jobs(ListPendingPipelineJobsArgs {
    db: task_database.get_connection(),
    statuses: &statuses,
  })
  .await
  .map_err(|err| {
    error!("list_floword_workflows failed: {:?}", err);
    "list_floword_workflows failed"
  })?;

  let workflows = list
    .jobs
    .into_iter()
    .map(|job| GetFlowordWorkflowResponse {
      workflow_id: job.id.as_str().to_string(),
      status: job.status.to_str().to_string(),
      current_stage: job.current_stage.to_str().to_string(),
      failure_message: job.maybe_on_failure_message,
      stage_outputs: job.maybe_stage_outputs,
    })
    .collect();

  Ok(ListFlowordWorkflowsResponse { workflows }.into())
}

#[tauri::command]
pub async fn cancel_floword_workflow(
  task_database: State<'_, TaskDatabase>,
  request: CancelFlowordWorkflowRequest,
) -> ResponseOrErrorMessage<CancelFlowordWorkflowResponse> {
  info!("cancel_floword_workflow called for {}", request.workflow_id);
  let pipeline_job_id = PipelineJobId::new_from_str(&request.workflow_id);

  let updated = update_pipeline_job_status(UpdatePipelineJobStatusArgs {
    db: task_database.get_connection(),
    pipeline_job_id: &pipeline_job_id,
    status: TaskStatus::CancelledByUser,
  })
  .await
  .map_err(|err| {
    error!("cancel_floword_workflow failed: {:?}", err);
    "cancel_floword_workflow failed"
  })?;

  Ok(CancelFlowordWorkflowResponse { cancelled: updated }.into())
}

#[tauri::command]
pub async fn retry_floword_step(
  task_database: State<'_, TaskDatabase>,
  request: RetryFlowordStepRequest,
) -> ResponseOrErrorMessage<RetryFlowordStepResponse> {
  info!("retry_floword_step called for {} step {}", request.workflow_id, request.step_id);
  let pipeline_job_id = PipelineJobId::new_from_str(&request.workflow_id);

  let _ = update_pipeline_job_status(UpdatePipelineJobStatusArgs {
    db: task_database.get_connection(),
    pipeline_job_id: &pipeline_job_id,
    status: TaskStatus::Pending,
  })
  .await;

  let retried = update_pipeline_job_stage(UpdatePipelineJobStageArgs {
    db: task_database.get_connection(),
    pipeline_job_id: &pipeline_job_id,
    current_stage: PipelineStage::ScriptGenerating,
    maybe_stage_outputs: None,
  })
  .await
  .map_err(|err| {
    error!("retry_floword_step failed: {:?}", err);
    "retry_floword_step failed"
  })?;

  Ok(RetryFlowordStepResponse { retried }.into())
}
