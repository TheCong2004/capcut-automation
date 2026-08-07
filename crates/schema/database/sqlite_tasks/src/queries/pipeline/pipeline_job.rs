use crate::error::SqliteTasksError;
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
pub struct RawPipelineJob {
  pub id: String,
  pub status: String,
  pub current_stage: String,
  pub input_payload: Option<String>,
  pub stage_outputs: Option<String>,
  pub on_failure_message: Option<String>,
}

pub(crate) fn raw_into_pipeline_job(raw: RawPipelineJob) -> Result<PipelineJob, SqliteTasksError> {
  Ok(PipelineJob { id: PipelineJobId::new_from_str(&raw.id), status: TaskStatus::from_str(&raw.status)?, current_stage: PipelineStage::from_str(&raw.current_stage)?, maybe_input_payload: raw.input_payload, maybe_stage_outputs: raw.stage_outputs, maybe_on_failure_message: raw.on_failure_message })
}
