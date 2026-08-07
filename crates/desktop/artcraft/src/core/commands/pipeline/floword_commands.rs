//! Tauri commands backing the Floword Studio workflow UI.
//!
//! Contract note: every command returns the standard command envelope
//! (`{status, payload}` on success, `{status, error_message, error_type, error_details}`
//! on error). The frontend MUST unwrap `payload` and branch on `error_type`/status —
//! it must never synthesize its own job id.

use crate::core::commands::response::failure_response_wrapper::{CommandErrorResponseWrapper, CommandErrorStatus};
use crate::core::commands::response::shorthand::{ResponseOrError, ResponseOrErrorMessage};
use crate::core::commands::response::success_response_wrapper::SerializeMarker;
use crate::core::state::task_database::TaskDatabase;
use crate::services::pipeline::clients::capcut_mate_client::health_check as capcut_mate_health_check;
use crate::services::pipeline::clients::omniroute_client::{health_check as llm_health_check, list_models as omniroute_list_models};
use crate::services::pipeline::state::cancellation_registry::request_cancellation;
use enums::tauri::pipeline::pipeline_stage::PipelineStage;
use enums::tauri::tasks::task_status::TaskStatus;
use log::{error, info};
use serde_derive::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlite_tasks::queries::pipeline::create_pipeline_job::{create_pipeline_job, CreatePipelineJobArgs};
use sqlite_tasks::queries::pipeline::get_pipeline_job_by_id::{get_pipeline_job_by_id, GetPipelineJobByIdArgs};
use sqlite_tasks::queries::pipeline::list_pending_pipeline_jobs::{list_pending_pipeline_jobs, ListPendingPipelineJobsArgs};
use sqlite_tasks::queries::pipeline::pipeline_job::PipelineJob;
use sqlite_tasks::queries::pipeline::update_pipeline_job_stage::{update_pipeline_job_stage, UpdatePipelineJobStageArgs};
use sqlite_tasks::queries::pipeline::update_pipeline_job_status::{update_pipeline_job_status, UpdatePipelineJobStatusArgs};
use std::collections::HashSet;
use std::time::Instant;
use tauri::State;
use tokens::tokens::sqlite::pipeline_jobs::PipelineJobId;

const WORKFLOW_NOT_FOUND: &str = "WORKFLOW_NOT_FOUND";
const INTERNAL_ERROR: &str = "INTERNAL_ERROR";
const OMNIROUTE_UNAVAILABLE: &str = "OMNIROUTE_UNAVAILABLE";

// ---------------------------------------------------------------------------
// Enqueue
// ---------------------------------------------------------------------------

#[derive(Deserialize, Serialize)]
pub struct EnqueueFlowordWorkflowRequest {
  pub workflow_name: String,
  pub prompt: String,
  pub topic: Option<String>,
  pub source_urls: Option<Vec<String>>,
  pub target_platform: Option<String>,
  pub target_duration_seconds: Option<u32>,
  pub output_mode: Option<String>,
  pub model_id: Option<String>,
}

#[derive(Serialize)]
pub struct EnqueueFlowordWorkflowResponse {
  /// The real PipelineJob primary key. The frontend polls and cancels using this.
  pub job_id: String,
  /// Reserved for a future distinct workflow identifier. `None` today because the
  /// backend stores no separate workflow id — do not query pipeline_jobs with it.
  pub workflow_id: Option<String>,
  pub status: String,
}
impl SerializeMarker for EnqueueFlowordWorkflowResponse {}

/// Structured error payload returned to the frontend (e.g. WORKFLOW_NOT_FOUND).
#[derive(Serialize)]
pub struct FlowordErrorDetails {
  pub error_code: String,
  pub job_id: Option<String>,
}

#[tauri::command]
pub async fn enqueue_floword_workflow(task_database: State<'_, TaskDatabase>, request: EnqueueFlowordWorkflowRequest) -> ResponseOrError<EnqueueFlowordWorkflowResponse, FlowordErrorDetails> {
  info!("[FlowordDB] command=enqueue db_path={}", task_database.db_path_display());

  if request.prompt.trim().is_empty() && request.source_urls.as_ref().map(|u| u.is_empty()).unwrap_or(true) {
    return Err(internal_error("Prompt and source_urls are both empty", None));
  }

  let input_payload = serde_json::to_string(&request).map_err(|e| internal_error(&format!("Failed to serialize input payload: {e}"), None))?;

  let job_id = create_pipeline_job(CreatePipelineJobArgs { db: task_database.get_connection(), status: TaskStatus::Pending, current_stage: PipelineStage::Queued, maybe_input_payload: Some(&input_payload) }).await.map_err(|err| {
    error!("[Floword] enqueue create_pipeline_job failed: {:?}", err);
    internal_error("Failed to insert pipeline job", None)
  })?;

  // Read the row back by its primary key to prove the insert committed and is
  // reachable by the same id we hand the frontend.
  let readback = get_pipeline_job_by_id(GetPipelineJobByIdArgs { db: task_database.get_connection(), pipeline_job_id: &job_id }).await.map_err(|err| {
    error!("[Floword] enqueue readback query failed: {:?}", err);
    internal_error("Failed to read back pipeline job", Some(job_id.as_str()))
  })?;

  if readback.is_none() {
    error!("[Floword] enqueue readback found no row for id {}", job_id.as_str());
    return Err(internal_error("Pipeline job vanished immediately after insert", Some(job_id.as_str())));
  }

  info!("[Floword] enqueued job_id={} (readback OK)", job_id.as_str());

  Ok(EnqueueFlowordWorkflowResponse { job_id: job_id.as_str().to_string(), workflow_id: None, status: TaskStatus::Pending.to_str().to_string() }.into())
}

// ---------------------------------------------------------------------------
// Get
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct GetFlowordWorkflowRequest {
  pub job_id: String,
}

#[derive(Serialize)]
pub struct GetFlowordWorkflowResponse {
  pub job_id: String,
  pub status: String,
  pub current_stage: String,
  pub failure_message: Option<String>,
  pub stage_outputs: Option<String>,
}
impl SerializeMarker for GetFlowordWorkflowResponse {}

#[tauri::command]
pub async fn get_floword_workflow(task_database: State<'_, TaskDatabase>, request: GetFlowordWorkflowRequest) -> ResponseOrError<GetFlowordWorkflowResponse, FlowordErrorDetails> {
  info!("[FlowordDB] command=get db_path={} job_id={}", task_database.db_path_display(), request.job_id);

  let pipeline_job_id = PipelineJobId::new_from_str(&request.job_id);
  let maybe_job = get_pipeline_job_by_id(GetPipelineJobByIdArgs { db: task_database.get_connection(), pipeline_job_id: &pipeline_job_id }).await.map_err(|err| {
    error!("[Floword] get_floword_workflow query failed: {:?}", err);
    internal_error("Failed to query pipeline job", Some(&request.job_id))
  })?;

  match maybe_job {
    Some(job) => Ok(get_response_from_job(&job).into()),
    None => Err(not_found(&request.job_id)),
  }
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct ListFlowordWorkflowsResponse {
  pub workflows: Vec<GetFlowordWorkflowResponse>,
}
impl SerializeMarker for ListFlowordWorkflowsResponse {}

#[tauri::command]
pub async fn list_floword_workflows(task_database: State<'_, TaskDatabase>) -> ResponseOrErrorMessage<ListFlowordWorkflowsResponse> {
  let mut statuses = HashSet::new();
  statuses.insert(TaskStatus::Pending);
  statuses.insert(TaskStatus::Started);
  statuses.insert(TaskStatus::CompleteSuccess);
  statuses.insert(TaskStatus::CompleteFailure);
  statuses.insert(TaskStatus::CancelledByUser);

  let list = list_pending_pipeline_jobs(ListPendingPipelineJobsArgs { db: task_database.get_connection(), statuses: &statuses }).await.map_err(|err| {
    error!("[Floword] list_floword_workflows failed: {:?}", err);
    "list_floword_workflows failed"
  })?;

  let workflows = list.jobs.iter().map(get_response_from_job).collect();

  Ok(ListFlowordWorkflowsResponse { workflows }.into())
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct CancelFlowordWorkflowRequest {
  pub job_id: String,
}

#[derive(Serialize)]
pub struct CancelFlowordWorkflowResponse {
  pub cancelled: bool,
  /// Whether a live worker token existed to abort in-flight adapter work. When
  /// false, only the DB status was updated (job was not actively running).
  pub had_live_token: bool,
}
impl SerializeMarker for CancelFlowordWorkflowResponse {}

#[tauri::command]
pub async fn cancel_floword_workflow(task_database: State<'_, TaskDatabase>, request: CancelFlowordWorkflowRequest) -> ResponseOrError<CancelFlowordWorkflowResponse, FlowordErrorDetails> {
  info!("[FlowordDB] command=cancel db_path={} job_id={}", task_database.db_path_display(), request.job_id);
  let pipeline_job_id = PipelineJobId::new_from_str(&request.job_id);

  // Reject cancel on a job that does not exist so the frontend gets NOT_FOUND
  // instead of a silent success.
  let maybe_job = get_pipeline_job_by_id(GetPipelineJobByIdArgs { db: task_database.get_connection(), pipeline_job_id: &pipeline_job_id }).await.map_err(|err| {
    error!("[Floword] cancel readback failed: {:?}", err);
    internal_error("Failed to query pipeline job", Some(&request.job_id))
  })?;

  if maybe_job.is_none() {
    return Err(not_found(&request.job_id));
  }

  // Signal the in-flight worker to abort (render polling + between-stage checks).
  let had_live_token = request_cancellation(&request.job_id);

  let updated = update_pipeline_job_status(UpdatePipelineJobStatusArgs { db: task_database.get_connection(), pipeline_job_id: &pipeline_job_id, status: TaskStatus::CancelledByUser }).await.map_err(|err| {
    error!("[Floword] cancel update_status failed: {:?}", err);
    internal_error("Failed to update job status", Some(&request.job_id))
  })?;

  Ok(CancelFlowordWorkflowResponse { cancelled: updated, had_live_token }.into())
}

// ---------------------------------------------------------------------------
// Retry
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct RetryFlowordStepRequest {
  pub job_id: String,
  pub step_id: String,
}

#[derive(Serialize)]
pub struct RetryFlowordStepResponse {
  pub retried: bool,
  pub job_id: String,
  pub resumed_stage: String,
  pub step_retry_count: u64,
}
impl SerializeMarker for RetryFlowordStepResponse {}

#[tauri::command]
pub async fn retry_floword_step(task_database: State<'_, TaskDatabase>, request: RetryFlowordStepRequest) -> ResponseOrError<RetryFlowordStepResponse, FlowordErrorDetails> {
  info!("[FlowordDB] command=retry db_path={} job_id={} step_id={}", task_database.db_path_display(), request.job_id, request.step_id);
  let pipeline_job_id = PipelineJobId::new_from_str(&request.job_id);

  let job = get_pipeline_job_by_id(GetPipelineJobByIdArgs { db: task_database.get_connection(), pipeline_job_id: &pipeline_job_id }).await.map_err(|err| {
    error!("[Floword] retry readback failed: {:?}", err);
    internal_error("Failed to query pipeline job", Some(&request.job_id))
  })?;

  let job = match job {
    Some(j) => j,
    None => return Err(not_found(&request.job_id)),
  };

  let resume_stage = match resume_stage_for_step(&request.step_id) {
    Some(stage) => stage,
    None => return Err(bad_request(&format!("Unknown step_id '{}'", request.step_id), &request.job_id)),
  };

  // Invalidate the retried step's output + everything downstream, keeping upstream
  // succeeded outputs intact, and bump this step's retry_count.
  let mut outputs = job.maybe_stage_outputs.as_deref().and_then(|s| serde_json::from_str::<Value>(s).ok()).unwrap_or_else(|| json!({}));
  invalidate_outputs_from_stage(&mut outputs, resume_stage);
  let step_retry_count = bump_retry_count(&mut outputs, &request.step_id);
  let outputs_string = serde_json::to_string(&outputs).map_err(|e| internal_error(&format!("Failed to serialize outputs: {e}"), Some(&request.job_id)))?;

  update_pipeline_job_stage(UpdatePipelineJobStageArgs { db: task_database.get_connection(), pipeline_job_id: &pipeline_job_id, current_stage: resume_stage, maybe_stage_outputs: Some(&outputs_string) }).await.map_err(|err| {
    error!("[Floword] retry update_stage failed: {:?}", err);
    internal_error("Failed to update job stage", Some(&request.job_id))
  })?;

  // Back to Pending so the worker re-claims the SAME job id and resumes at
  // `resume_stage` — never a new job.
  let retried = update_pipeline_job_status(UpdatePipelineJobStatusArgs { db: task_database.get_connection(), pipeline_job_id: &pipeline_job_id, status: TaskStatus::Pending }).await.map_err(|err| {
    error!("[Floword] retry update_status failed: {:?}", err);
    internal_error("Failed to reset job status", Some(&request.job_id))
  })?;

  Ok(RetryFlowordStepResponse { retried, job_id: request.job_id.clone(), resumed_stage: resume_stage.to_str().to_string(), step_retry_count }.into())
}

// ---------------------------------------------------------------------------
// OmniRoute models
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct FlowordModel {
  pub id: String,
  pub provider: Option<String>,
}

#[derive(Serialize)]
pub struct ListOmniRouteModelsResponse {
  pub models: Vec<FlowordModel>,
}
impl SerializeMarker for ListOmniRouteModelsResponse {}

#[tauri::command]
pub async fn list_omniroute_models() -> ResponseOrError<ListOmniRouteModelsResponse, FlowordErrorDetails> {
  match omniroute_list_models().await {
    Ok(models) => {
      let models = models.into_iter().map(|m| FlowordModel { id: m.id, provider: if m.provider.is_empty() { None } else { Some(m.provider) } }).collect();
      Ok(ListOmniRouteModelsResponse { models }.into())
    },
    Err(err) => {
      error!("[Floword] list_omniroute_models failed: {err:?}");
      Err(CommandErrorResponseWrapper { status: CommandErrorStatus::ServerError, error_message: Some(format!("{err:?}")), error_type: Some(()), error_details: Some(FlowordErrorDetails { error_code: OMNIROUTE_UNAVAILABLE.to_string(), job_id: None }) })
    },
  }
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct FlowordServiceHealth {
  pub id: String,
  pub status: String, // ready | degraded | unavailable | auth_required
  pub latency_ms: u64,
  pub error_code: Option<String>,
  pub message: Option<String>,
}

#[derive(Serialize)]
pub struct FlowordReadinessResponse {
  pub services: Vec<FlowordServiceHealth>,
  pub is_ready_for_execution: bool,
}
impl SerializeMarker for FlowordReadinessResponse {}

#[tauri::command]
pub async fn get_floword_readiness(task_database: State<'_, TaskDatabase>) -> ResponseOrErrorMessage<FlowordReadinessResponse> {
  let mut services = Vec::new();

  // Storage: is the task DB directory writable?
  services.push(check_storage(&task_database));

  // OmniRoute LLM gateway.
  services.push(check_omniroute().await);

  // CapCut Mate.
  services.push(check_capcut().await);

  // Modules without a wired runtime contract in the worker yet. Reported honestly
  // as unavailable rather than a hard-coded READY.
  for id in ["mediacrawler", "youwee", "artcraft", "openmontage", "playwright_sidecar", "chrome_cdp"] {
    services.push(FlowordServiceHealth { id: id.to_string(), status: "unavailable".to_string(), latency_ms: 0, error_code: Some("NO_RUNTIME_CONTRACT".to_string()), message: Some("No backend readiness probe wired for this module yet".to_string()) });
  }

  // Minimum bar for the draft_only pipeline the worker actually implements:
  // storage + OmniRoute + CapCut Mate all ready.
  let ready_ids: HashSet<&str> = services.iter().filter(|s| s.status == "ready").map(|s| s.id.as_str()).collect();
  let is_ready_for_execution = ready_ids.contains("storage") && ready_ids.contains("omniroute") && ready_ids.contains("capcut");

  Ok(FlowordReadinessResponse { services, is_ready_for_execution }.into())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn get_response_from_job(job: &PipelineJob) -> GetFlowordWorkflowResponse {
  GetFlowordWorkflowResponse { job_id: job.id.as_str().to_string(), status: job.status.to_str().to_string(), current_stage: job.current_stage.to_str().to_string(), failure_message: job.maybe_on_failure_message.clone(), stage_outputs: job.maybe_stage_outputs.clone() }
}

/// Map a frontend step identifier (either `step-N` or a module name) to the
/// pipeline stage the worker should resume at.
fn resume_stage_for_step(step_id: &str) -> Option<PipelineStage> {
  let module = normalize_step_to_module(step_id)?;
  let stage = match module {
    "media_crawler" => PipelineStage::PreflightCheck,
    "omniroute" => PipelineStage::ScriptGenerating,
    "youwee" => PipelineStage::ScriptReady,
    "artcraft" => PipelineStage::DraftCreating,
    "open_montage" => PipelineStage::CaptionAdding,
    "capcut" => PipelineStage::DraftCreating,
    _ => return None,
  };
  Some(stage)
}

fn normalize_step_to_module(step_id: &str) -> Option<&'static str> {
  match step_id {
    "step-1" | "media_crawler" => Some("media_crawler"),
    "step-2" | "omniroute" => Some("omniroute"),
    "step-3" | "youwee" => Some("youwee"),
    "step-4" | "artcraft" => Some("artcraft"),
    "step-5" | "open_montage" => Some("open_montage"),
    "step-6" | "capcut" => Some("capcut"),
    _ => None,
  }
}

/// Ordinal used to decide which output keys are "downstream" of a resume point.
fn stage_ordinal(stage: PipelineStage) -> u8 {
  match stage {
    PipelineStage::Queued => 0,
    PipelineStage::PreflightCheck => 1,
    PipelineStage::ScriptGenerating => 2,
    PipelineStage::ScriptReady => 3,
    PipelineStage::DraftCreating => 4,
    PipelineStage::DraftCreated => 5,
    PipelineStage::CaptionAdding => 6,
    PipelineStage::DraftSaving => 7,
    PipelineStage::DraftReady => 8,
    PipelineStage::RenderRequesting => 9,
    PipelineStage::Rendering => 10,
    PipelineStage::Completed => 11,
    PipelineStage::Failed => 12,
    PipelineStage::Cancelled => 13,
  }
}

/// Stage at which each output key is first produced. Any key whose producing
/// stage is at or after `resume_stage` is invalidated on retry.
fn output_key_producing_stage(key: &str) -> Option<PipelineStage> {
  let stage = match key {
    "script" | "script_artifact" => PipelineStage::ScriptGenerating,
    "draft_url" | "draft_id" => PipelineStage::DraftCreating,
    "capcut_artifact" => PipelineStage::DraftSaving,
    "video_url" | "rendering_supported" => PipelineStage::Rendering,
    _ => return None,
  };
  Some(stage)
}

fn invalidate_outputs_from_stage(outputs: &mut Value, resume_stage: PipelineStage) {
  let resume_ord = stage_ordinal(resume_stage);
  if let Some(obj) = outputs.as_object_mut() {
    let keys_to_remove: Vec<String> = obj.keys().filter(|k| output_key_producing_stage(k).map(|s| stage_ordinal(s) >= resume_ord).unwrap_or(false)).cloned().collect();
    for k in keys_to_remove {
      obj.remove(&k);
    }
  }
}

fn bump_retry_count(outputs: &mut Value, step_id: &str) -> u64 {
  let module = normalize_step_to_module(step_id).unwrap_or(step_id);
  let obj = outputs.as_object_mut().expect("outputs is a JSON object");
  let counts = obj.entry("retry_counts").or_insert_with(|| json!({}));
  let counts_obj = counts.as_object_mut().expect("retry_counts is a JSON object");
  let next = counts_obj.get(module).and_then(|v| v.as_u64()).unwrap_or(0) + 1;
  counts_obj.insert(module.to_string(), json!(next));
  next
}

fn check_storage(task_database: &TaskDatabase) -> FlowordServiceHealth {
  let start = Instant::now();
  let db_path = task_database.db_path();
  let dir = db_path.parent().unwrap_or_else(|| std::path::Path::new("."));
  let probe = dir.join(".floword_write_probe");
  let (status, error_code, message) = match std::fs::write(&probe, b"ok") {
    Ok(()) => {
      let _ = std::fs::remove_file(&probe);
      ("ready".to_string(), None, Some(format!("Writable: {}", dir.display())))
    },
    Err(e) => ("unavailable".to_string(), Some("STORAGE_NOT_WRITABLE".to_string()), Some(format!("{e}"))),
  };
  FlowordServiceHealth { id: "storage".to_string(), status, latency_ms: start.elapsed().as_millis() as u64, error_code, message }
}

async fn check_omniroute() -> FlowordServiceHealth {
  let start = Instant::now();
  match llm_health_check().await {
    Ok(()) => FlowordServiceHealth { id: "omniroute".to_string(), status: "ready".to_string(), latency_ms: start.elapsed().as_millis() as u64, error_code: None, message: None },
    Err(e) => {
      let status = if e.contains("UNAUTHORIZED") || e.contains("FORBIDDEN") { "auth_required" } else { "unavailable" };
      FlowordServiceHealth { id: "omniroute".to_string(), status: status.to_string(), latency_ms: start.elapsed().as_millis() as u64, error_code: Some(OMNIROUTE_UNAVAILABLE.to_string()), message: Some(e) }
    },
  }
}

async fn check_capcut() -> FlowordServiceHealth {
  let start = Instant::now();
  match capcut_mate_health_check().await {
    Ok(()) => FlowordServiceHealth { id: "capcut".to_string(), status: "ready".to_string(), latency_ms: start.elapsed().as_millis() as u64, error_code: None, message: None },
    Err(e) => FlowordServiceHealth { id: "capcut".to_string(), status: "unavailable".to_string(), latency_ms: start.elapsed().as_millis() as u64, error_code: Some("CAPCUT_UNAVAILABLE".to_string()), message: Some(e) },
  }
}

fn not_found(job_id: &str) -> CommandErrorResponseWrapper<(), FlowordErrorDetails> {
  CommandErrorResponseWrapper { status: CommandErrorStatus::NotFound, error_message: Some("Workflow job not found".to_string()), error_type: Some(()), error_details: Some(FlowordErrorDetails { error_code: WORKFLOW_NOT_FOUND.to_string(), job_id: Some(job_id.to_string()) }) }
}

fn internal_error(message: &str, job_id: Option<&str>) -> CommandErrorResponseWrapper<(), FlowordErrorDetails> {
  CommandErrorResponseWrapper { status: CommandErrorStatus::ServerError, error_message: Some(message.to_string()), error_type: Some(()), error_details: Some(FlowordErrorDetails { error_code: INTERNAL_ERROR.to_string(), job_id: job_id.map(|s| s.to_string()) }) }
}

fn bad_request(message: &str, job_id: &str) -> CommandErrorResponseWrapper<(), FlowordErrorDetails> {
  CommandErrorResponseWrapper { status: CommandErrorStatus::BadRequest, error_message: Some(message.to_string()), error_type: Some(()), error_details: Some(FlowordErrorDetails { error_code: "BAD_REQUEST".to_string(), job_id: Some(job_id.to_string()) }) }
}

#[cfg(test)]
mod tests {
  use super::*;
  use enums::tauri::pipeline::pipeline_stage::PipelineStage;

  mod step_mapping {
    use super::*;

    #[test]
    fn maps_step_ids_and_module_names() {
      assert_eq!(resume_stage_for_step("step-2"), Some(PipelineStage::ScriptGenerating));
      assert_eq!(resume_stage_for_step("omniroute"), Some(PipelineStage::ScriptGenerating));
      assert_eq!(resume_stage_for_step("step-3"), Some(PipelineStage::ScriptReady));
      assert_eq!(resume_stage_for_step("capcut"), Some(PipelineStage::DraftCreating));
    }

    #[test]
    fn rejects_unknown_step() {
      assert_eq!(resume_stage_for_step("step-99"), None);
      assert_eq!(resume_stage_for_step("bogus"), None);
    }
  }

  mod output_invalidation {
    use super::*;

    #[test]
    fn keeps_upstream_and_removes_downstream() {
      // Retry at youwee (ScriptReady) must keep the script output but drop the
      // draft + render outputs produced downstream.
      let mut outputs = json!({
        "script": "hello",
        "script_artifact": { "id": "a" },
        "draft_url": "u",
        "draft_id": "d",
        "capcut_artifact": { "id": "c" },
        "video_url": "v",
        "rendering_supported": true
      });
      invalidate_outputs_from_stage(&mut outputs, PipelineStage::ScriptReady);
      let obj = outputs.as_object().unwrap();
      assert!(obj.contains_key("script"), "upstream script must survive");
      assert!(obj.contains_key("script_artifact"), "upstream artifact must survive");
      assert!(!obj.contains_key("draft_url"), "downstream draft must be purged");
      assert!(!obj.contains_key("draft_id"));
      assert!(!obj.contains_key("capcut_artifact"));
      assert!(!obj.contains_key("video_url"));
      assert!(!obj.contains_key("rendering_supported"));
    }

    #[test]
    fn retry_at_script_purges_everything_produced() {
      let mut outputs = json!({
        "script": "hello",
        "draft_url": "u",
        "video_url": "v"
      });
      invalidate_outputs_from_stage(&mut outputs, PipelineStage::ScriptGenerating);
      let obj = outputs.as_object().unwrap();
      assert!(!obj.contains_key("script"));
      assert!(!obj.contains_key("draft_url"));
      assert!(!obj.contains_key("video_url"));
    }
  }

  mod retry_counts {
    use super::*;

    #[test]
    fn increments_per_module() {
      let mut outputs = json!({});
      assert_eq!(bump_retry_count(&mut outputs, "step-3"), 1);
      assert_eq!(bump_retry_count(&mut outputs, "youwee"), 2); // same module, different id form
      assert_eq!(bump_retry_count(&mut outputs, "step-2"), 1); // different module
    }
  }
}
