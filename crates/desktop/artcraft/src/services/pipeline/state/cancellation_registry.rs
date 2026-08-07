//! Per-job cancellation registry for Floword pipeline jobs.
//!
//! `cancel_floword_workflow` flips a job's flag here; the worker polls the same
//! flag before each stage and inside long-running render polling so an in-flight
//! job actually stops instead of only having its DB row rewritten.

use log::info;
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

static CANCELLATION_REGISTRY: Lazy<Mutex<HashMap<String, Arc<AtomicBool>>>> = Lazy::new(|| Mutex::new(HashMap::new()));

/// Register (or reuse) a cancellation flag for a job the worker is about to run.
/// The returned flag starts as `false` (not cancelled).
pub fn register_job(job_id: &str) -> Arc<AtomicBool> {
  let mut registry = CANCELLATION_REGISTRY.lock().expect("cancellation registry mutex poisoned");
  let flag = registry.entry(job_id.to_string()).or_insert_with(|| Arc::new(AtomicBool::new(false)));
  Arc::clone(flag)
}

/// Request cancellation for a job. Returns `true` if a live token existed (the
/// worker is actively running this job), `false` otherwise.
pub fn request_cancellation(job_id: &str) -> bool {
  let registry = CANCELLATION_REGISTRY.lock().expect("cancellation registry mutex poisoned");
  match registry.get(job_id) {
    Some(flag) => {
      flag.store(true, Ordering::SeqCst);
      info!("[CANCEL][SIGNAL] Cancellation flag set for job {job_id}");
      true
    },
    None => false,
  }
}

/// Whether cancellation has been requested for a job (used by the worker between stages).
pub fn is_cancelled(job_id: &str) -> bool {
  let registry = CANCELLATION_REGISTRY.lock().expect("cancellation registry mutex poisoned");
  registry.get(job_id).map(|flag| flag.load(Ordering::SeqCst)).unwrap_or(false)
}

/// Remove a job's cancellation flag once it reaches a terminal state.
pub fn clear_job(job_id: &str) {
  let mut registry = CANCELLATION_REGISTRY.lock().expect("cancellation registry mutex poisoned");
  registry.remove(job_id);
}
