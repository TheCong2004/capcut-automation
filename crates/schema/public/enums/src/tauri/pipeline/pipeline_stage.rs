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
  ScriptGeneration,
  VideoAssembly,
  Done,
}

impl_enum_display_and_debug_using_to_str!(PipelineStage);

impl Default for PipelineStage {
  fn default() -> Self {
    Self::ScriptGeneration
  }
}

impl PipelineStage {
  pub const fn to_str(&self) -> &'static str {
    match self {
      Self::ScriptGeneration => "script_generation",
      Self::VideoAssembly => "video_assembly",
      Self::Done => "done",
    }
  }

  pub fn from_str(value: &str) -> Result<Self, EnumError> {
    match value {
      "script_generation" => Ok(Self::ScriptGeneration),
      "video_assembly" => Ok(Self::VideoAssembly),
      "done" => Ok(Self::Done),
      _ => Err(EnumError::CouldNotConvertFromString(value.to_string())),
    }
  }

  pub fn all_variants() -> BTreeSet<Self> {
    BTreeSet::from([
      Self::ScriptGeneration,
      Self::VideoAssembly,
      Self::Done,
    ])
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
      assert_eq!(PipelineStage::default(), PipelineStage::ScriptGeneration);
    }

    #[test]
    fn test_serialization() {
      assert_serialization(PipelineStage::ScriptGeneration, "script_generation");
      assert_serialization(PipelineStage::VideoAssembly, "video_assembly");
      assert_serialization(PipelineStage::Done, "done");
    }

    #[test]
    fn to_str() {
      assert_eq!(PipelineStage::ScriptGeneration.to_str(), "script_generation");
      assert_eq!(PipelineStage::VideoAssembly.to_str(), "video_assembly");
      assert_eq!(PipelineStage::Done.to_str(), "done");
    }

    #[test]
    fn from_str() {
      assert_eq!(PipelineStage::from_str("script_generation").unwrap(), PipelineStage::ScriptGeneration);
      assert_eq!(PipelineStage::from_str("video_assembly").unwrap(), PipelineStage::VideoAssembly);
      assert_eq!(PipelineStage::from_str("done").unwrap(), PipelineStage::Done);
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
      assert_eq!(variants.len(), 3);
      assert_eq!(variants.pop_first(), Some(PipelineStage::ScriptGeneration));
      assert_eq!(variants.pop_first(), Some(PipelineStage::VideoAssembly));
      assert_eq!(variants.pop_first(), Some(PipelineStage::Done));
      assert_eq!(variants.pop_first(), None);
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
