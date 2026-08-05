use crate::core::commands::response::shorthand::ResponseOrErrorMessage;
use crate::core::commands::response::success_response_wrapper::SerializeMarker;
use crate::core::state::task_database::TaskDatabase;
use enums::tauri::tasks::task_status::TaskStatus;
use errors::AnyhowResult;
use log::{error, info};
use serde_derive::{Deserialize, Serialize};
use sqlite_tasks::queries::pipeline::update_pipeline_job_status::{update_pipeline_job_status, UpdatePipelineJobStatusArgs};
use tauri::State;
use tokens::tokens::sqlite::pipeline_jobs::PipelineJobId;

#[derive(Deserialize)]
pub struct CancelPipelineJobRequest {
  pub job_id: String,
}

#[derive(Serialize)]
pub struct CancelPipelineJobResponse {
  pub cancelled: bool,
}

impl SerializeMarker for CancelPipelineJobResponse {}

#[tauri::command]
pub async fn cancel_pipeline_job_command(request: CancelPipelineJobRequest, task_database: State<'_, TaskDatabase>) -> ResponseOrErrorMessage<CancelPipelineJobResponse> {
  info!("cancel_pipeline_job_command called for {}", request.job_id);

  let cancelled = cancel(&task_database, &request.job_id).await.map_err(|err| {
    error!("cancel_pipeline_job_command failed: {:?}", err);
    "cancel_pipeline_job_command failed"
  })?;

  Ok(CancelPipelineJobResponse { cancelled }.into())
}

async fn cancel(task_database: &TaskDatabase, job_id: &str) -> AnyhowResult<bool> {
  let pipeline_job_id = PipelineJobId::new_from_str(job_id);

  // Flip to a terminal cancelled status. The worker skips jobs not in its
  // pending set, so this stops further stage processing.
  let updated = update_pipeline_job_status(UpdatePipelineJobStatusArgs { db: task_database.get_connection(), pipeline_job_id: &pipeline_job_id, status: TaskStatus::CancelledByUser }).await?;

  Ok(updated)
}
