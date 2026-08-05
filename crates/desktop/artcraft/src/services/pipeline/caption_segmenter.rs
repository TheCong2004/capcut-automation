//! Caption segmentation engine for CapCut Mate.
//! Splits plain text script into structured caption segments with calculated timing.

use serde::{Deserialize, Serialize};

/// Microseconds per second.
pub const US_PER_SEC: u64 = 1_000_000;
/// Microseconds per word (~250ms per word).
pub const US_PER_WORD: u64 = 250_000;
/// Minimum caption duration (1.5 seconds).
pub const MIN_CAPTION_DURATION_US: u64 = 1_500_000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CaptionSegment {
  pub text: String,
  pub start: u64,
  pub end: u64,
}

/// Segment raw script text into a sequence of contiguous non-overlapping caption items.
pub fn segment_script_to_captions(script: &str) -> Vec<CaptionSegment> {
  let trimmed = script.trim();
  if trimmed.is_empty() {
    return vec![];
  }

  // 1. Break script into sentences / clauses
  let mut raw_chunks = Vec::new();
  for line in trimmed.lines() {
    let line_str = line.trim();
    if line_str.is_empty() {
      continue;
    }

    // Split on sentence punctuation
    let mut current = String::new();
    for ch in line_str.chars() {
      current.push(ch);
      if ch == '.' || ch == '!' || ch == '?' || ch == ';' || ch == '\n' {
        let chunk = current.trim().to_string();
        if !chunk.is_empty() {
          raw_chunks.push(chunk);
        }
        current.clear();
      }
    }
    let remainder = current.trim().to_string();
    if !remainder.is_empty() {
      raw_chunks.push(remainder);
    }
  }

  if raw_chunks.is_empty() {
    raw_chunks.push(trimmed.to_string());
  }

  // 2. Refine chunks so each is between 4 and 12 words
  let mut final_text_chunks = Vec::new();
  for raw_chunk in raw_chunks {
    let words: Vec<&str> = raw_chunk.split_whitespace().collect();
    if words.is_empty() {
      continue;
    }

    if words.len() <= 12 {
      final_text_chunks.push(words.join(" "));
    } else {
      // Split large chunk into smaller 8-10 word sub-chunks
      let mut window = Vec::new();
      for word in words {
        window.push(word);
        if window.len() >= 8 {
          final_text_chunks.push(window.join(" "));
          window.clear();
        }
      }
      if !window.is_empty() {
        final_text_chunks.push(window.join(" "));
      }
    }
  }

  if final_text_chunks.is_empty() {
    final_text_chunks.push(trimmed.to_string());
  }

  // 3. Compute contiguous timelines
  let mut segments = Vec::new();
  let mut current_time: u64 = 0;

  for chunk_text in final_text_chunks {
    let word_count = chunk_text.split_whitespace().count() as u64;
    let estimated_duration = (word_count * US_PER_WORD).max(MIN_CAPTION_DURATION_US);
    let start = current_time;
    let end = start + estimated_duration;

    // Sanitize string for JSON / API escaping
    let escaped_text = sanitize_caption_text(&chunk_text);

    segments.push(CaptionSegment { text: escaped_text, start, end });

    current_time = end;
  }

  segments
}

/// Sanitize text for CapCut API payload stringification.
pub fn sanitize_caption_text(input: &str) -> String {
  input.replace('\\', "\\\\").replace('"', "\\\"").replace('\r', "").replace('\n', " ").trim().to_string()
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_empty_script_segmentation() {
    assert_eq!(segment_script_to_captions("   "), vec![]);
  }

  #[test]
  fn test_single_sentence_segmentation() {
    let script = "Welcome to ArtCraft CapCut automation system!";
    let captions = segment_script_to_captions(script);
    assert_eq!(captions.len(), 1);
    assert_eq!(captions[0].start, 0);
    assert!(captions[0].end >= MIN_CAPTION_DURATION_US);
  }

  #[test]
  fn test_multi_sentence_contiguity() {
    let script = "First sentence goes here. Second sentence follows immediately! Third sentence finishes.";
    let captions = segment_script_to_captions(script);
    assert_eq!(captions.len(), 3);

    assert_eq!(captions[0].start, 0);
    assert_eq!(captions[0].end, captions[1].start);
    assert_eq!(captions[1].end, captions[2].start);
    assert!(captions[2].end > captions[1].end);
  }

  #[test]
  fn test_long_chunk_splitting() {
    let script = "One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty.";
    let captions = segment_script_to_captions(script);
    assert!(captions.len() >= 2);
    assert_eq!(captions[0].start, 0);
    assert_eq!(captions[0].end, captions[1].start);
  }
}
