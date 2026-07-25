"""
Mutate segments on raw draft JSON (pure Python — CLI parity subset).

Porting target from capcut-cli: speed, volume, opacity, shift, trim.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from .inspect import find_segment


def set_speed(draft: Dict[str, Any], segment_id: str, speed: float) -> Dict[str, Any]:
    seg = find_segment(draft, segment_id)
    if seg is None:
        raise KeyError(f"segment_id không tồn tại: {segment_id}")
    if speed <= 0:
        raise ValueError("speed must be > 0")
    seg["speed"] = float(speed)
    return seg


def set_volume(draft: Dict[str, Any], segment_id: str, volume: float) -> Dict[str, Any]:
    seg = find_segment(draft, segment_id)
    if seg is None:
        raise KeyError(f"segment_id không tồn tại: {segment_id}")
    if volume < 0:
        raise ValueError("volume must be >= 0")
    seg["volume"] = float(volume)
    return seg


def set_opacity(draft: Dict[str, Any], segment_id: str, alpha: float) -> Dict[str, Any]:
    seg = find_segment(draft, segment_id)
    if seg is None:
        raise KeyError(f"segment_id không tồn tại: {segment_id}")
    if not 0.0 <= alpha <= 1.0:
        raise ValueError("alpha must be in [0, 1]")
    clip = seg.get("clip")
    if not isinstance(clip, dict):
        clip = {}
        seg["clip"] = clip
    clip["alpha"] = float(alpha)
    return seg


def shift_segment(
    draft: Dict[str, Any],
    segment_id: str,
    offset_us: int,
) -> Dict[str, Any]:
    """Shift target_timerange.start by offset microseconds."""
    seg = find_segment(draft, segment_id)
    if seg is None:
        raise KeyError(f"segment_id không tồn tại: {segment_id}")
    tr = seg.get("target_timerange")
    if not isinstance(tr, dict):
        raise ValueError("segment thiếu target_timerange")
    start = int(tr.get("start") or 0) + int(offset_us)
    if start < 0:
        start = 0
    tr["start"] = start
    return seg


def trim_segment(
    draft: Dict[str, Any],
    segment_id: str,
    start_us: int,
    duration_us: int,
) -> Dict[str, Any]:
    """Set target_timerange start + duration (microseconds)."""
    seg = find_segment(draft, segment_id)
    if seg is None:
        raise KeyError(f"segment_id không tồn tại: {segment_id}")
    if duration_us <= 0:
        raise ValueError("duration_us must be > 0")
    tr = seg.get("target_timerange")
    if not isinstance(tr, dict):
        tr = {}
        seg["target_timerange"] = tr
    tr["start"] = int(start_us)
    tr["duration"] = int(duration_us)
    return seg
