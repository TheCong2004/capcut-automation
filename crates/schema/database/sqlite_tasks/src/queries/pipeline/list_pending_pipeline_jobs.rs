use crate::connection::TaskDbConnection;
use crate::error::SqliteTasksError;
use crate::queries::pipeline::pipeline_job::{PipelineJob, RawPipelineJob};
use enums::tauri::pipeline::pipeline_stage::PipelineStage;
use enums::tauri::tasks::task_status::TaskStatus;
use sqlx::{QueryBuilder, Sqlite};
use std::collections::HashSet;
use tokens::tokens::sqlite::pipeline_jobs::PipelineJobId;

pub struct ListPendingPipelineJobsArgs<'a> {
  pub db: &'a TaskDbConnection,
  pub statuses: &'a HashSet<TaskStatus>,
}

pub struct PipelineJobList {
  pub jobs: Vec<PipelineJob>,
}

pub async fn list_pending_pipeline_jobs(
  args: ListPendingPipelineJobsArgs<'_>,
) -> Result<PipelineJobList, SqliteTasksError> {
  let mut query_builder: QueryBuilder<Sqlite> = QueryBuilder::new(r#"
    SELECT
      id,
      status,
      current_stage,
      input_payload,
      stage_outputs,
      on_failure_message
    FROM pipeline_jobs
  "#);

  if !args.statuses.is_empty() {
    query_builder.push(" WHERE status IN (");
    let mut separated = query_builder.separated(", ");
    for status in args.statuses.into_iter() {
      separated.push_bind(status.to_str());
    }
    separated.push_unseparated(") ");
  }

  query_builder.push(" ORDER BY created_at ASC");

  let query = query_builder.build_query_as::<RawPipelineJob>();
  let results = query.fetch_all(args.db.get_pool()).await?;

  let mut jobs: Vec<PipelineJob> = Vec::new();
  for raw in results {
    jobs.push(raw_into_pipeline_job(raw)?);
  }

  Ok(PipelineJobList { jobs })
}

pub(crate) fn raw_into_pipeline_job(raw: RawPipelineJob) -> Result<PipelineJob, SqliteTasksError> {
  Ok(PipelineJob {
    id: PipelineJobId::new_from_str(&raw.id),
    status: TaskStatus::from_str(&raw.status)?,
    current_stage: PipelineStage::from_str(&raw.current_stage)?,
    maybe_input_payload: raw.input_payload,
    maybe_stage_outputs: raw.stage_outputs,
    maybe_on_failure_message: raw.on_failure_message,
  })
}
