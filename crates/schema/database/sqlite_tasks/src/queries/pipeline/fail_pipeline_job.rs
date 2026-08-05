use crate::connection::TaskDbConnection;
use crate::error::SqliteTasksError;
use enums::tauri::tasks::task_status::TaskStatus;
use sqlx::{QueryBuilder, Sqlite};
use tokens::tokens::sqlite::pipeline_jobs::PipelineJobId;

pub struct FailPipelineJobArgs<'a> {
  pub db: &'a TaskDbConnection,
  pub pipeline_job_id: &'a PipelineJobId,
  pub failure_message: &'a str,
}

/// Mark a job as failed: status = complete_failure, record the message,
/// stamp `completed_at`. Returns true if a row was updated.
pub async fn fail_pipeline_job(args: FailPipelineJobArgs<'_>) -> Result<bool, SqliteTasksError> {
  let status = TaskStatus::CompleteFailure.to_str().to_string();
  let failure_message = args.failure_message.to_string();
  let id = args.pipeline_job_id.as_str().to_string();

  let mut query_builder: QueryBuilder<Sqlite> = QueryBuilder::new(
    r#"
    UPDATE pipeline_jobs
    SET status =
  "#,
  );
  query_builder.push_bind(status);
  query_builder.push(", on_failure_message = ");
  query_builder.push_bind(failure_message);
  query_builder.push(", updated_at = unixepoch('now'), completed_at = unixepoch('now')");
  query_builder.push(" WHERE id = ");
  query_builder.push_bind(id);

  let query = query_builder.build();
  let res = query.execute(args.db.get_pool()).await?;

  Ok(res.rows_affected() > 0)
}
