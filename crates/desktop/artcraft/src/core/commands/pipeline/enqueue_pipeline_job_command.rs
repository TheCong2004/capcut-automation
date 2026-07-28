use crate::core::commands::response::shorthand::ResponseOrErrorMessage;
use crate::core::commands::response::success_response_wrapper::SerializeMarker;
use crate::core::state::task_database::TaskDatabase;
use errors::AnyhowResult;
use enums::tauri::pipeline::pipeline_stage::PipelineStage;
use enums::tauri::tasks::task_status::TaskStatus;
use log::{error, info};
use serde_derive::{Deserialize, Serialize};
use sqlite_tasks::queries::pipeline::create_pipeline_job::{create_pipeline_job, CreatePipelineJobArgs};
use tauri::State;

#[derive(Deserialize)]
pub struct EnqueuePipelineJobRequest {
  /// The idea/prompt that drives script generation. Sent to OmniRoute verbatim.
  pub prompt: String,
}

#[derive(Serialize)]
pub struct EnqueuePipelineJobResponse {
  pub job_id: String,
}

impl SerializeMarker for EnqueuePipelineJobResponse {}

#[tauri::command]
pub async fn enqueue_pipeline_job_command(
  task_database: State<'_, TaskDatabase>,
  request: EnqueuePipelineJobRequest,
) -> ResponseOrErrorMessage<EnqueuePipelineJobResponse> {
  info!("enqueue_pipeline_job_command called");

  let job_id = enqueue(&task_database, &request.prompt).await
      .map_err(|err| {
        error!("enqueue_pipeline_job_command failed: {:?}", err);
        "enqueue_pipeline_job_command failed"
      })?;

  Ok(EnqueuePipelineJobResponse { job_id }.into())
}

async fn enqueue(
  task_database: &TaskDatabase,
  prompt: &str,
) -> AnyhowResult<String> {
  // Store the prompt as a structured payload so the worker can parse it.
  let input_payload = serde_json::to_string(&serde_json::json!({ "prompt": prompt }))?;

  let job_id = create_pipeline_job(CreatePipelineJobArgs {
    db: task_database.get_connection(),
    status: TaskStatus::Pending,
    current_stage: PipelineStage::ScriptGeneration,
    maybe_input_payload: Some(&input_payload),
  })
  .await?;

  Ok(job_id.as_str().to_string())
}
