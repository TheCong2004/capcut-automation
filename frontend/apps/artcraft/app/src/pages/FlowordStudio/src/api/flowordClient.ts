// Floword Studio backend client.
//
// Contract: React → Tauri command → Rust → SQLite / OmniRoute / CapCut Mate.
// The frontend NEVER calls OmniRoute (:20128) directly and NEVER fabricates
// models, scripts, readiness, or job ids. Every call unwraps the standard
// command envelope exactly once and throws a typed error on failure.

// ---------------------------------------------------------------------------
// Command envelope + typed error
// ---------------------------------------------------------------------------

interface CommandSuccess<T> {
  status: 'success';
  payload: T;
}

interface CommandFailure {
  status: 'bad_request' | 'not_found' | 'server_error' | 'unauthorized' | 'too_many_requests';
  error_message?: string;
  error_details?: { error_code?: string; job_id?: string } | null;
}

/// Typed error carrying the backend's structured `error_code`
/// (e.g. WORKFLOW_NOT_FOUND, OMNIROUTE_UNAVAILABLE, INTERNAL_ERROR).
export class FlowordCommandError extends Error {
  readonly errorCode?: string;
  readonly jobId?: string;

  constructor(errorCode: string | undefined, message: string, jobId?: string) {
    super(message);
    this.name = 'FlowordCommandError';
    this.errorCode = errorCode;
    this.jobId = jobId;
  }
}

function toFlowordError(raw: unknown): FlowordCommandError {
  if (raw instanceof FlowordCommandError) return raw;
  if (raw && typeof raw === 'object') {
    const obj = raw as CommandFailure & { error_code?: string; job_id?: string; message?: string };
    const code = obj.error_details?.error_code ?? obj.error_code;
    const jobId = obj.error_details?.job_id ?? obj.job_id;
    const msg = obj.error_message ?? obj.message ?? 'Command failed';
    return new FlowordCommandError(code, msg, jobId);
  }
  return new FlowordCommandError(undefined, typeof raw === 'string' ? raw : String(raw));
}

function getTauriInvoke(): ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null {
  const internals = (window as unknown as { __TAURI_INTERNALS__?: { invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> } }).__TAURI_INTERNALS__;
  return internals?.invoke ?? null;
}

/// Invoke a Tauri command and unwrap the `{status:"success", payload}` envelope.
/// Rejections (Rust `Err`) and non-success envelopes throw a `FlowordCommandError`.
async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const invoke = getTauriInvoke();
  if (!invoke) {
    throw new FlowordCommandError('TAURI_UNAVAILABLE', 'Tauri runtime not available (desktop app only)');
  }

  let raw: unknown;
  try {
    raw = await invoke(cmd, args);
  } catch (err) {
    throw toFlowordError(err);
  }

  if (raw && typeof raw === 'object' && 'status' in raw) {
    const env = raw as CommandSuccess<T> | CommandFailure;
    if (env.status === 'success') {
      return (env as CommandSuccess<T>).payload;
    }
    throw toFlowordError(env);
  }
  // Defensive: our commands always wrap, but tolerate a bare payload.
  return raw as T;
}

// ---------------------------------------------------------------------------
// Workflow commands (job_id is the ONLY identifier the frontend polls with)
// ---------------------------------------------------------------------------

export interface EnqueueFlowordWorkflowRequest {
  workflow_name: string;
  prompt: string;
  topic?: string;
  source_urls?: string[];
  target_platform?: string;
  target_duration_seconds?: number;
  output_mode?: string;
  model_id?: string;
}

export interface EnqueueFlowordWorkflowResponse {
  job_id: string;
  workflow_id?: string | null;
  status: string;
}

export interface GetFlowordWorkflowResponse {
  job_id: string;
  status: string;
  current_stage: string;
  failure_message?: string | null;
  stage_outputs?: string | null;
}

export interface CancelFlowordWorkflowResponse {
  cancelled: boolean;
  had_live_token: boolean;
}

export interface RetryFlowordStepResponse {
  retried: boolean;
  job_id: string;
  resumed_stage: string;
  step_retry_count: number;
}

export function enqueueFlowordWorkflow(request: EnqueueFlowordWorkflowRequest): Promise<EnqueueFlowordWorkflowResponse> {
  return invokeCommand<EnqueueFlowordWorkflowResponse>('enqueue_floword_workflow', { request });
}

export function getFlowordWorkflow(jobId: string): Promise<GetFlowordWorkflowResponse> {
  return invokeCommand<GetFlowordWorkflowResponse>('get_floword_workflow', { request: { job_id: jobId } });
}

export function cancelFlowordWorkflow(jobId: string): Promise<CancelFlowordWorkflowResponse> {
  return invokeCommand<CancelFlowordWorkflowResponse>('cancel_floword_workflow', { request: { job_id: jobId } });
}

export function retryFlowordStep(jobId: string, stepId: string): Promise<RetryFlowordStepResponse> {
  return invokeCommand<RetryFlowordStepResponse>('retry_floword_step', { request: { job_id: jobId, step_id: stepId } });
}

// ---------------------------------------------------------------------------
// OmniRoute models (via Tauri only — no direct :20128 call, no fake models)
// ---------------------------------------------------------------------------

export interface OmniRouteModel {
  id: string;
  provider?: string;
}

interface ListOmniRouteModelsResponse {
  models: OmniRouteModel[];
}

/// Fetch models from the backend OmniRoute client. On failure returns an empty
/// list — the caller must render an "unavailable" state, never a hard-coded model.
export async function fetchOmniRouteModels(): Promise<OmniRouteModel[]> {
  try {
    const res = await invokeCommand<ListOmniRouteModelsResponse>('list_omniroute_models');
    return res.models ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Readiness (backend-probed; no hard-coded READY)
// ---------------------------------------------------------------------------

export type ServiceStatusState = 'READY' | 'DEGRADED' | 'UNAVAILABLE' | 'AUTH_REQUIRED' | 'WAITING_INPUT';

export interface ServiceHealth {
  name: string;
  status: ServiceStatusState;
  endpoint: string;
  lastChecked: string;
  latencyMs: number;
  message: string;
  errorCode?: string;
}

export interface DetailedReadinessStatus {
  mateAgent: ServiceHealth;
  omniRoute: ServiceHealth;
  mediaCrawler: ServiceHealth;
  openMontage: ServiceHealth;
  playwrightCdp: ServiceHealth;
  storage: ServiceHealth;
  capCutRender: ServiceHealth;
  isReadyForExecution: boolean;
}

interface BackendServiceReadiness {
  id: string;
  status: string; // ready | degraded | unavailable | auth_required | waiting_input
  latency_ms?: number;
  error_code?: string | null;
  message?: string | null;
}

interface BackendReadinessResponse {
  services: BackendServiceReadiness[];
  is_ready_for_execution: boolean;
}

function blankHealth(name: string): ServiceHealth {
  return { name, status: 'UNAVAILABLE', endpoint: '', lastChecked: '', latencyMs: 0, message: 'No data' };
}

/// The default readiness before the first backend probe returns: everything
/// unavailable, execution blocked. No optimistic READY.
export const DEFAULT_READINESS: DetailedReadinessStatus = {
  mateAgent: blankHealth('CapCut Mate'),
  omniRoute: blankHealth('OmniRoute LLM Gateway'),
  mediaCrawler: blankHealth('MediaCrawler'),
  openMontage: blankHealth('OpenMontage'),
  playwrightCdp: blankHealth('Playwright / CDP'),
  storage: blankHealth('ArtifactStore'),
  capCutRender: blankHealth('CapCut Render'),
  isReadyForExecution: false,
};

function mapStatus(raw: string): ServiceStatusState {
  switch (raw) {
    case 'ready':
      return 'READY';
    case 'degraded':
      return 'DEGRADED';
    case 'auth_required':
      return 'AUTH_REQUIRED';
    case 'waiting_input':
      return 'WAITING_INPUT';
    default:
      return 'UNAVAILABLE';
  }
}

function toHealth(name: string, svc: BackendServiceReadiness | undefined): ServiceHealth {
  if (!svc) return blankHealth(name);
  return {
    name,
    status: mapStatus(svc.status),
    endpoint: svc.id,
    lastChecked: new Date().toLocaleTimeString(),
    latencyMs: svc.latency_ms ?? 0,
    message: svc.message ?? '',
    errorCode: svc.error_code ?? undefined,
  };
}

/// Probe backend readiness via Tauri. On failure returns DEFAULT_READINESS
/// (all unavailable) so the UI blocks execution rather than showing a false READY.
export async function fetchDetailedReadiness(): Promise<DetailedReadinessStatus> {
  let res: BackendReadinessResponse;
  try {
    res = await invokeCommand<BackendReadinessResponse>('get_floword_readiness');
  } catch {
    return DEFAULT_READINESS;
  }

  const byId = new Map(res.services.map((s) => [s.id, s]));
  return {
    mateAgent: toHealth('CapCut Mate', byId.get('capcut')),
    omniRoute: toHealth('OmniRoute LLM Gateway', byId.get('omniroute')),
    mediaCrawler: toHealth('MediaCrawler', byId.get('mediacrawler')),
    openMontage: toHealth('OpenMontage', byId.get('openmontage')),
    playwrightCdp: toHealth('Playwright / CDP', byId.get('playwright_sidecar') ?? byId.get('chrome_cdp')),
    storage: toHealth('ArtifactStore', byId.get('storage')),
    capCutRender: toHealth('CapCut Render', byId.get('capcut')),
    isReadyForExecution: res.is_ready_for_execution,
  };
}
