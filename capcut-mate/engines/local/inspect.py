"""Inspect raw CapCut draft (pure Python)."""

from __future__ import annotations

from typing import Any, Dict, List, Optional


def summarize(draft: Dict[str, Any]) -> Dict[str, Any]:
    tracks = draft.get("tracks") or []
    materials = draft.get("materials") or {}
    canvas = draft.get("canvas_config") or {}
    return {
        "id": draft.get("id"),
        "name": draft.get("name"),
        "duration": draft.get("duration"),
        "fps": draft.get("fps"),
        "canvas": canvas,
        "track_count": len(tracks),
        "tracks": [
            {
                "id": t.get("id"),
                "type": t.get("type"),
                "name": t.get("name"),
                "segment_count": len(t.get("segments") or []),
            }
            for t in tracks
            if isinstance(t, dict)
        ],
        "materials": {
            k: len(v) if isinstance(v, list) else 0
            for k, v in materials.items()
            if isinstance(v, list)
        },
    }


def list_tracks(draft: Dict[str, Any]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for t in draft.get("tracks") or []:
        if not isinstance(t, dict):
            continue
        segs = t.get("segments") or []
        out.append(
            {
                "id": t.get("id"),
                "type": t.get("type"),
                "name": t.get("name"),
                "attribute": t.get("attribute"),
                "segment_count": len(segs),
            }
        )
    return out


def list_segments(
    draft: Dict[str, Any],
    track_type: Optional[str] = None,
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for t in draft.get("tracks") or []:
        if not isinstance(t, dict):
            continue
        if track_type and t.get("type") != track_type:
            continue
        for s in t.get("segments") or []:
            if not isinstance(s, dict):
                continue
            tr = s.get("target_timerange") or {}
            out.append(
                {
                    "id": s.get("id"),
                    "track_id": t.get("id"),
                    "track_type": t.get("type"),
                    "material_id": s.get("material_id"),
                    "speed": s.get("speed"),
                    "volume": s.get("volume"),
                    "visible": s.get("visible"),
                    "target_timerange": tr,
                }
            )
    return out


def find_segment(draft: Dict[str, Any], segment_id: str) -> Optional[Dict[str, Any]]:
    for t in draft.get("tracks") or []:
        if not isinstance(t, dict):
            continue
        for s in t.get("segments") or []:
            if isinstance(s, dict) and s.get("id") == segment_id:
                return s
    return None
