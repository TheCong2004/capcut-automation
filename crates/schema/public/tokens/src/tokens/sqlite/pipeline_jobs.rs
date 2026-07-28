use std::fmt::Debug;

use serde::Deserialize;
use serde::Serialize;

use crate::prefixes::TauriTokenPrefix;

/// The primary key for pipeline jobs (Tauri / Sqlite)
#[derive(Clone, PartialEq, Eq, Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "database", derive(sqlx::Type))]
#[cfg_attr(feature = "database", sqlx(transparent))]
pub struct PipelineJobId(pub String);

impl_string_token!(PipelineJobId);
impl_crockford_generator!(PipelineJobId, 32usize, TauriTokenPrefix::PipelineJob, CrockfordMixed);
