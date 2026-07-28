use enums::tauri::pipeline::pipeline_stage::PipelineStage;
use enums::tauri::tasks::task_status::TaskStatus;
use tokens::tokens::sqlite::pipeline_jobs::PipelineJobId;

#[derive(Debug, Clone)]
pub struct PipelineJob {
  pub id: PipelineJobId,
  pub status: TaskStatus,
  pub current_stage: PipelineStage,
  pub maybe_input_payload: Option<String>,
  pub maybe_stage_outputs: Option<String>,
  pub maybe_on_failure_message: Option<String>,
}

#[derive(Debug)]
#[derive(sqlx::FromRow)]
pub (crate) struct RawPipelineJob {
  pub (crate) id: String,
  pub (crate) status: String,
  pub (crate) current_stage: String,
  pub (crate) input_payload: Option<String>,
  pub (crate) stage_outputs: Option<String>,
  pub (crate) on_failure_message: Option<String>,
}
