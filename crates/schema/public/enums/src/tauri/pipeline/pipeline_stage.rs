use std::collections::BTreeSet;

use crate::error::enum_error::EnumError;
#[cfg(test)]
use strum::EnumCount;
#[cfg(test)]
use strum::EnumIter;
use utoipa::ToSchema;

#[cfg_attr(test, derive(EnumIter, EnumCount))]
#[derive(Clone, Copy, PartialEq, Eq, Hash, Ord, PartialOrd, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum PipelineStage {
  Queued,
  PreflightCheck,
  ScriptGenerating,
  ScriptReady,
  DraftCreating,
  DraftCreated,
  CaptionAdding,
  DraftSaving,
  DraftReady,
  RenderRequesting,
  Rendering,
  Completed,
  Failed,
  Cancelled,
}

impl_enum_display_and_debug_using_to_str!(PipelineStage);

impl Default for PipelineStage {
  fn default() -> Self {
    Self::Queued
  }
}

impl PipelineStage {
  pub const fn to_str(&self) -> &'static str {
    match self {
      Self::Queued => "queued",
      Self::PreflightCheck => "preflight_check",
      Self::ScriptGenerating => "script_generating",
      Self::ScriptReady => "script_ready",
      Self::DraftCreating => "draft_creating",
      Self::DraftCreated => "draft_created",
      Self::CaptionAdding => "caption_adding",
      Self::DraftSaving => "draft_saving",
      Self::DraftReady => "draft_ready",
      Self::RenderRequesting => "render_requesting",
      Self::Rendering => "rendering",
      Self::Completed => "completed",
      Self::Failed => "failed",
      Self::Cancelled => "cancelled",
    }
  }

  pub fn from_str(value: &str) -> Result<Self, EnumError> {
    match value {
      "queued" => Ok(Self::Queued),
      "preflight_check" => Ok(Self::PreflightCheck),
      "script_generating" | "script_generation" => Ok(Self::ScriptGenerating),
      "script_ready" => Ok(Self::ScriptReady),
      "draft_creating" => Ok(Self::DraftCreating),
      "draft_created" => Ok(Self::DraftCreated),
      "caption_adding" => Ok(Self::CaptionAdding),
      "draft_saving" => Ok(Self::DraftSaving),
      "draft_ready" => Ok(Self::DraftReady),
      "render_requesting" => Ok(Self::RenderRequesting),
      "rendering" | "video_assembly" => Ok(Self::Rendering),
      "completed" | "done" => Ok(Self::Completed),
      "failed" => Ok(Self::Failed),
      "cancelled" => Ok(Self::Cancelled),
      _ => Err(EnumError::CouldNotConvertFromString(value.to_string())),
    }
  }

  pub fn all_variants() -> BTreeSet<Self> {
    BTreeSet::from([Self::Queued, Self::PreflightCheck, Self::ScriptGenerating, Self::ScriptReady, Self::DraftCreating, Self::DraftCreated, Self::CaptionAdding, Self::DraftSaving, Self::DraftReady, Self::RenderRequesting, Self::Rendering, Self::Completed, Self::Failed, Self::Cancelled])
  }
}

#[cfg(test)]
mod tests {
  use crate::tauri::pipeline::pipeline_stage::PipelineStage;
  use crate::test_helpers::assert_serialization;

  mod explicit_checks {
    use super::*;
    use crate::error::enum_error::EnumError;

    #[test]
    fn test_default() {
      assert_eq!(PipelineStage::default(), PipelineStage::Queued);
    }

    #[test]
    fn test_serialization() {
      assert_serialization(PipelineStage::Queued, "queued");
      assert_serialization(PipelineStage::PreflightCheck, "preflight_check");
      assert_serialization(PipelineStage::ScriptGenerating, "script_generating");
      assert_serialization(PipelineStage::DraftReady, "draft_ready");
      assert_serialization(PipelineStage::Completed, "completed");
    }

    #[test]
    fn to_str() {
      assert_eq!(PipelineStage::Queued.to_str(), "queued");
      assert_eq!(PipelineStage::PreflightCheck.to_str(), "preflight_check");
      assert_eq!(PipelineStage::ScriptGenerating.to_str(), "script_generating");
      assert_eq!(PipelineStage::Completed.to_str(), "completed");
    }

    #[test]
    fn from_str() {
      assert_eq!(PipelineStage::from_str("queued").unwrap(), PipelineStage::Queued);
      assert_eq!(PipelineStage::from_str("preflight_check").unwrap(), PipelineStage::PreflightCheck);
      assert_eq!(PipelineStage::from_str("script_generating").unwrap(), PipelineStage::ScriptGenerating);
      assert_eq!(PipelineStage::from_str("script_generation").unwrap(), PipelineStage::ScriptGenerating);
      assert_eq!(PipelineStage::from_str("draft_ready").unwrap(), PipelineStage::DraftReady);
      assert_eq!(PipelineStage::from_str("completed").unwrap(), PipelineStage::Completed);
      assert_eq!(PipelineStage::from_str("done").unwrap(), PipelineStage::Completed);
    }

    #[test]
    fn from_str_err() {
      let result = PipelineStage::from_str("asdf");
      assert!(result.is_err());
      if let Err(EnumError::CouldNotConvertFromString(value)) = result {
        assert_eq!(value, "asdf");
      } else {
        panic!("Expected EnumError::CouldNotConvertFromString");
      }
    }

    #[test]
    fn all_variants() {
      let mut variants = PipelineStage::all_variants();
      assert_eq!(variants.len(), 14);
      assert_eq!(variants.pop_first(), Some(PipelineStage::Queued));
    }
  }

  mod mechanical_checks {
    use super::*;

    #[test]
    fn variant_length() {
      use strum::IntoEnumIterator;
      assert_eq!(PipelineStage::all_variants().len(), PipelineStage::iter().len());
    }

    #[test]
    fn round_trip() {
      for variant in PipelineStage::all_variants() {
        assert_eq!(variant, PipelineStage::from_str(variant.to_str()).unwrap());
        assert_eq!(variant, PipelineStage::from_str(&format!("{}", variant)).unwrap());
        assert_eq!(variant, PipelineStage::from_str(&format!("{:?}", variant)).unwrap());
      }
    }
  }
}
