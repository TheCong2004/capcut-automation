use crate::connection::TaskDbConnection;
use crate::error::SqliteTasksError;
use enums::tauri::pipeline::pipeline_stage::PipelineStage;
use sqlx::{QueryBuilder, Sqlite};
use tokens::tokens::sqlite::pipeline_jobs::PipelineJobId;

pub struct UpdatePipelineJobStageArgs<'a> {
  pub db: &'a TaskDbConnection,
  pub pipeline_job_id: &'a PipelineJobId,
  pub current_stage: PipelineStage,
  pub maybe_stage_outputs: Option<&'a str>,
}

/// Advance a job to its next stage, storing the accumulated stage outputs.
/// Returns true if a row was updated.
pub async fn update_pipeline_job_stage(
  args: UpdatePipelineJobStageArgs<'_>,
) -> Result<bool, SqliteTasksError> {
  let current_stage = args.current_stage.to_str().to_string();
  let stage_outputs = args.maybe_stage_outputs.map(|s| s.to_string());
  let id = args.pipeline_job_id.as_str().to_string();

  let mut query_builder: QueryBuilder<Sqlite> = QueryBuilder::new(r#"
    UPDATE pipeline_jobs
    SET current_stage =
  "#);
  query_builder.push_bind(current_stage);
  query_builder.push(", stage_outputs = ");
  query_builder.push_bind(stage_outputs);
  query_builder.push(", updated_at = unixepoch('now') WHERE id = ");
  query_builder.push_bind(id);

  let query = query_builder.build();
  let res = query.execute(args.db.get_pool()).await?;

  Ok(res.rows_affected() > 0)
}
