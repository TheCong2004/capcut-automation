use serde::Serialize;

#[derive(Serialize)]
pub(super) struct UploadFileRequest {
  #[serde(rename = "fileName")]
  pub file_name: String,

  #[serde(rename = "fileMimeType")]
  pub file_mime_type: String,

  /// Base64-encoded content
  pub content: String,

  /// eg. 'IMAGINE_SELF_UPLOAD_FILE_SOURCE'
  #[serde(rename = "fileSource")]
  pub file_source: String,
}
