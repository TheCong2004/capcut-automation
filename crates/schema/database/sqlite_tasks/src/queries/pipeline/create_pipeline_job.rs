use crate::connection::TaskDbConnection;
use crate::error::SqliteTasksError;
use enums::tauri::pipeline::pipeline_stage::PipelineStage;
use enums::tauri::tasks::task_status::TaskStatus;
use sqlx::{QueryBuilder, Sqlite};
use tokens::tokens::sqlite::pipeline_jobs::PipelineJobId;

pub struct CreatePipelineJobArgs<'a> {
  pub db: &'a TaskDbConnection,
  pub status: TaskStatus,
  pub current_stage: PipelineStage,
  pub maybe_input_payload: Option<&'a str>,
}

pub async fn create_pipeline_job(
  args: CreatePipelineJobArgs<'_>,
) -> Result<PipelineJobId, SqliteTasksError> {
  let pipeline_job_id = PipelineJobId::generate();

  let id = pipeline_job_id.as_str().to_string();
  let status = args.status.to_str().to_string();
  let current_stage = args.current_stage.to_str().to_string();
  let input_payload = args.maybe_input_payload.map(|s| s.to_string());

  let mut query_builder: QueryBuilder<Sqlite> = QueryBuilder::new(r#"
    INSERT INTO pipeline_jobs (
      id,
      status,
      current_stage,
      input_payload
    )
    VALUES (
  "#);

  let mut separated = query_builder.separated(", ");
  separated.push_bind(id);
  separated.push_bind(status);
  separated.push_bind(current_stage);
  separated.push_bind(input_payload);
  separated.push_unseparated(")");

  let query = query_builder.build();
  query.execute(args.db.get_pool()).await?;

  Ok(pipeline_job_id)
}
