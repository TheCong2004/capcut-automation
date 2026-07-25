"""
Local draft engine — pure Python (no capcut-cli / Node).

Đọc-ghi draft CapCut trên đĩa + inspect/edit segment.
Port dần logic từ capcut-cli vào đây.
"""

from .draft_io import load_raw_draft, resolve_draft_json_path, save_raw_draft
from .edit_segment import set_opacity, set_speed, set_volume, shift_segment, trim_segment
from .inspect import find_segment, list_segments, list_tracks, summarize

# Submodules for ported features (Grok A–E)
from . import content, fx_ops, motion, srt, tool_ops, visual  # noqa: F401

__all__ = [
    "load_raw_draft",
    "resolve_draft_json_path",
    "save_raw_draft",
    "summarize",
    "list_tracks",
    "list_segments",
    "find_segment",
    "set_speed",
    "set_volume",
    "set_opacity",
    "shift_segment",
    "trim_segment",
    "content",
    "fx_ops",
    "motion",
    "srt",
    "visual",
    "tool_ops",
]
