use crate::connection::TaskDbConnection;
use crate::error::SqliteTasksError;
use crate::queries::pipeline::pipeline_job::{raw_into_pipeline_job, PipelineJob, RawPipelineJob};
use sqlx::{QueryBuilder, Sqlite};
use tokens::tokens::sqlite::pipeline_jobs::PipelineJobId;

pub struct GetPipelineJobByIdArgs<'a> {
  pub db: &'a TaskDbConnection,
  pub pipeline_job_id: &'a PipelineJobId,
}

/// Fetch a single pipeline job directly by its primary key.
/// Returns `None` when no row matches (the caller decides how to signal NOT_FOUND).
pub async fn get_pipeline_job_by_id(args: GetPipelineJobByIdArgs<'_>) -> Result<Option<PipelineJob>, SqliteTasksError> {
  let id = args.pipeline_job_id.as_str().to_string();

  let mut query_builder: QueryBuilder<Sqlite> = QueryBuilder::new(
    r#"
    SELECT
      id,
      status,
      current_stage,
      input_payload,
      stage_outputs,
      on_failure_message
    FROM pipeline_jobs
    WHERE id =
  "#,
  );
  query_builder.push_bind(id);
  query_builder.push(" LIMIT 1");

  let query = query_builder.build_query_as::<RawPipelineJob>();
  let maybe_raw = query.fetch_optional(args.db.get_pool()).await?;

  match maybe_raw {
    Some(raw) => Ok(Some(raw_into_pipeline_job(raw)?)),
    None => Ok(None),
  }
}
