use crate::core::commands::response::shorthand::ResponseOrErrorMessage;
use crate::core::commands::response::success_response_wrapper::SerializeMarker;
use crate::core::state::task_database::TaskDatabase;
use enums::tauri::pipeline::pipeline_stage::PipelineStage;
use enums::tauri::tasks::task_status::TaskStatus;
use errors::AnyhowResult;
use log::{debug, error};
use serde_derive::Serialize;
use sqlite_tasks::queries::pipeline::list_pending_pipeline_jobs::{list_pending_pipeline_jobs, ListPendingPipelineJobsArgs};
use std::collections::HashSet;
use tauri::State;

#[derive(Serialize)]
pub struct ListPipelineJobsResponse {
  pub jobs: Vec<PipelineJobItem>,
}

#[derive(Serialize)]
pub struct PipelineJobItem {
  pub id: String,
  pub status: TaskStatus,
  pub current_stage: PipelineStage,
  pub maybe_stage_outputs: Option<String>,
  pub maybe_on_failure_message: Option<String>,
}

impl SerializeMarker for ListPipelineJobsResponse {}

#[tauri::command]
pub async fn list_pipeline_jobs_command(task_database: State<'_, TaskDatabase>) -> ResponseOrErrorMessage<ListPipelineJobsResponse> {
  debug!("list_pipeline_jobs_command called");

  let jobs = list_all(&task_database).await.map_err(|err| {
    error!("list_pipeline_jobs_command failed: {:?}", err);
    "list_pipeline_jobs_command failed"
  })?;

  Ok(ListPipelineJobsResponse { jobs }.into())
}

async fn list_all(task_database: &TaskDatabase) -> AnyhowResult<Vec<PipelineJobItem>> {
  // Empty status set = no WHERE filter = all jobs (see list_pending_pipeline_jobs).
  let empty: HashSet<TaskStatus> = HashSet::new();

  let list = list_pending_pipeline_jobs(ListPendingPipelineJobsArgs { db: task_database.get_connection(), statuses: &empty }).await?;

  let items = list.jobs.into_iter().map(|job| PipelineJobItem { id: job.id.as_str().to_string(), status: job.status, current_stage: job.current_stage, maybe_stage_outputs: job.maybe_stage_outputs, maybe_on_failure_message: job.maybe_on_failure_message }).collect();

  Ok(items)
}
