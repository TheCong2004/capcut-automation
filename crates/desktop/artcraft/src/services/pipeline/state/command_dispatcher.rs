use std::sync::Arc;

use log::info;
use tokio::sync::{OwnedSemaphorePermit, Semaphore};

/// Limits how many pipeline stages run concurrently, split by resource class.
///
/// CPU-bound stages (script generation, light HTTP orchestration) and GPU-bound
/// stages (video render / gen_video) draw from separate permit pools so a burst
/// of cheap script jobs can't starve the machine of render capacity, and a long
/// render can't block script generation.
///
/// Cloned freely (Tauri managed state) — the inner semaphores are shared via Arc.
#[derive(Clone)]
pub struct CommandDispatcher {
  cpu_permits: Arc<Semaphore>,
  gpu_permits: Arc<Semaphore>,
}

impl CommandDispatcher {
  pub fn new(cpu_limit: usize, gpu_limit: usize) -> Self {
    info!("CommandDispatcher init: cpu_limit={cpu_limit}, gpu_limit={gpu_limit}");
    Self { cpu_permits: Arc::new(Semaphore::new(cpu_limit)), gpu_permits: Arc::new(Semaphore::new(gpu_limit)) }
  }

  /// Acquire a CPU-class permit. Awaits when the pool is exhausted. The permit
  /// releases on drop, so hold it for the duration of the stage.
  pub async fn acquire_cpu(&self) -> OwnedSemaphorePermit {
    let available = self.cpu_permits.available_permits();
    info!("CommandDispatcher: acquiring cpu permit ({available} available)");
    self.cpu_permits.clone().acquire_owned().await.expect("cpu semaphore is never closed")
  }

  /// Acquire a GPU-class permit. Awaits when the pool is exhausted. The permit
  /// releases on drop, so hold it for the duration of the stage.
  pub async fn acquire_gpu(&self) -> OwnedSemaphorePermit {
    let available = self.gpu_permits.available_permits();
    info!("CommandDispatcher: acquiring gpu permit ({available} available)");
    self.gpu_permits.clone().acquire_owned().await.expect("gpu semaphore is never closed")
  }
}
