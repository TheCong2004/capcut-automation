import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export type PipelineStage = 'script_generation' | 'video_assembly' | 'done';

export type TaskStatus =
  | 'pending'
  | 'started'
  | 'complete_success'
  | 'complete_failure'
  | 'cancelled_by_user';

export interface PipelineJobItem {
  id: string;
  status: TaskStatus;
  current_stage: PipelineStage;
  maybe_stage_outputs?: string | null;
  maybe_on_failure_message?: string | null;
}

export interface EnqueuePipelineJobResponse {
  job_id: string;
}

export interface ListPipelineJobsResponse {
  jobs: PipelineJobItem[];
}

export interface CancelPipelineJobResponse {
  cancelled: boolean;
}

export interface StageCompletePayload {
  job_id: string;
  completed_stage: string;
  next_stage: string;
}

export interface JobCompletePayload {
  job_id: string;
  video_url: string;
}

export interface JobFailedPayload {
  job_id: string;
  failed_stage: string;
  error_message: string;
}

/** Check if running inside Tauri runtime desktop app vs standard web browser */
export function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

/**
 * Enqueue a new automated video generation job into the pipeline queue.
 */
export async function enqueuePipelineJob(prompt: string): Promise<string> {
  if (!isTauriAvailable()) {
    throw new Error('Rust Pipeline chỉ hoạt động trên app Desktop Tauri (ArtCraft.exe / windows_capcut_dev.ps1), không khả dụng trên Web Browser');
  }
  const res = await invoke<EnqueuePipelineJobResponse>('enqueue_pipeline_job_command', {
    request: { prompt },
  });
  return res.job_id;
}

/**
 * Fetch all pipeline jobs (pending, in-progress, completed, failed).
 */
export async function listPipelineJobs(): Promise<PipelineJobItem[]> {
  if (!isTauriAvailable()) {
    return [];
  }
  const res = await invoke<ListPipelineJobsResponse>('list_pipeline_jobs_command');
  return res.jobs;
}

/**
 * Cancel an active pipeline job.
 */
export async function cancelPipelineJob(jobId: string): Promise<boolean> {
  if (!isTauriAvailable()) {
    return false;
  }
  const res = await invoke<CancelPipelineJobResponse>('cancel_pipeline_job_command', {
    request: { job_id: jobId },
  });
  return res.cancelled;
}

/** Event names emitted by the Rust pipeline_worker_thread */
export const PIPELINE_EVENTS = {
  STAGE_COMPLETE: 'pipeline://stage_complete',
  JOB_COMPLETE: 'pipeline://job_complete',
  JOB_FAILED: 'pipeline://job_failed',
} as const;

const NOOP_UNLISTEN: UnlistenFn = () => {};

/** Listen for stage progress updates */
export async function listenStageComplete(
  cb: (payload: StageCompletePayload) => void
): Promise<UnlistenFn> {
  if (!isTauriAvailable()) return NOOP_UNLISTEN;
  return listen<StageCompletePayload>(PIPELINE_EVENTS.STAGE_COMPLETE, (event) => cb(event.payload));
}

/** Listen for successful job completion */
export async function listenJobComplete(
  cb: (payload: JobCompletePayload) => void
): Promise<UnlistenFn> {
  if (!isTauriAvailable()) return NOOP_UNLISTEN;
  return listen<JobCompletePayload>(PIPELINE_EVENTS.JOB_COMPLETE, (event) => cb(event.payload));
}

/** Listen for job execution failures */
export async function listenJobFailed(
  cb: (payload: JobFailedPayload) => void
): Promise<UnlistenFn> {
  if (!isTauriAvailable()) return NOOP_UNLISTEN;
  return listen<JobFailedPayload>(PIPELINE_EVENTS.JOB_FAILED, (event) => cb(event.payload));
}
