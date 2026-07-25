"""SRT import/export on raw CapCut draft — pure Python (no capcut-cli).

Material/segment schema aligned with pyJianYingDraft TextSegment so CapCut
can open imported subtitles (content.styles.range = UTF-16-LE units).
"""

from __future__ import annotations

import json
import re
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

_US = 1_000_000

# Optional hours: 00:00:01,000 or 00:01,000 / dots as ms separator
_TS = re.compile(
    r"(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})\s*-->\s*"
    r"(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})"
)


def _ts_to_us(h: Optional[str], m: str, s: str, frac: str) -> int:
    hh = int(h or 0)
    mm = int(m)
    ss = int(s)
    ms = int(frac.ljust(3, "0")[:3])
    return ((hh * 3600 + mm * 60 + ss) * 1000 + ms) * 1000


def _utf16_len(text: str) -> int:
    """CapCut style.range uses UTF-16 code units (not Python len / UTF-8)."""
    return len(text.encode("utf-16-le")) // 2


def parse_srt(content: str) -> List[Tuple[int, int, str]]:
    """Parse SRT → list of (start_us, end_us, text). Strips UTF-8 BOM."""
    content = content.lstrip("\ufeff").replace("\r\n", "\n").replace("\r", "\n")
    # Drop WebVTT header if pasted by mistake
    if content.lstrip().upper().startswith("WEBVTT"):
        content = re.sub(r"(?i)^WEBVTT[^\n]*\n+", "", content.lstrip(), count=1)

    blocks = re.split(r"\n\s*\n", content.strip())
    cues: List[Tuple[int, int, str]] = []
    for block in blocks:
        lines = [ln for ln in block.split("\n") if ln.strip() != ""]
        if len(lines) < 2:
            continue
        time_line = next((ln for ln in lines if "-->" in ln), None)
        if not time_line:
            continue
        m = _TS.search(time_line)
        if not m:
            continue
        start = _ts_to_us(m.group(1), m.group(2), m.group(3), m.group(4))
        end = _ts_to_us(m.group(5), m.group(6), m.group(7), m.group(8))
        idx = lines.index(time_line)
        text = "\n".join(lines[idx + 1 :]).strip()
        # HTML-ish tags sometimes present in SRT
        text = re.sub(r"</?[^>]+>", "", text).strip()
        if text and end > start:
            cues.append((start, end, text))
    return cues


def _us_to_srt_ts(us: int) -> str:
    us = max(0, int(us))
    ms_total = us // 1000
    h = ms_total // 3_600_000
    ms_total %= 3_600_000
    m = ms_total // 60_000
    ms_total %= 60_000
    s = ms_total // 1000
    ms = ms_total % 1000
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _ensure_text_track(draft: Dict[str, Any], *, name: str = "subtitle") -> Dict[str, Any]:
    tracks = draft.setdefault("tracks", [])
    if not isinstance(tracks, list):
        raise ValueError("draft.tracks phải là list")
    for t in tracks:
        if isinstance(t, dict) and t.get("type") == "text":
            t.setdefault("segments", [])
            return t
    track = {
        "id": uuid.uuid4().hex,
        "type": "text",
        "name": name,
        "attribute": 0,
        "flag": 0,
        "segments": [],
    }
    tracks.append(track)
    return track


def _minimal_text_material(
    text: str,
    *,
    font_size: float = 5.0,
    color: Tuple[float, float, float] = (1.0, 1.0, 1.0),
    alpha: float = 1.0,
) -> Dict[str, Any]:
    """
    Subtitle material close to TextSegment.export_material()
    (type=subtitle, auto-wrap, white fill).
    """
    mid = uuid.uuid4().hex
    n = _utf16_len(text)
    content_obj = {
        "styles": [
            {
                "fill": {
                    "alpha": float(alpha),
                    "content": {
                        "render_type": "solid",
                        "solid": {
                            "alpha": float(alpha),
                            "color": list(color),
                        },
                    },
                },
                "range": [0, n],
                "size": float(font_size),
                "bold": False,
                "italic": False,
                "underline": False,
                "strokes": [],
            }
        ],
        "text": text,
    }
    return {
        "id": mid,
        "content": json.dumps(content_obj, ensure_ascii=False),
        "typesetting": 0,
        "alignment": 1,
        "letter_spacing": 0.0,
        "line_spacing": 0.02,
        "line_feed": 1,
        "line_max_width": 0.82,
        "force_apply_line_max_width": False,
        "check_flag": 7,
        "type": "subtitle",
        "global_alpha": float(alpha),
        # Compat fields some tools still read
        "font_size": float(font_size),
        "text_color": "#FFFFFF",
    }


def _text_segment_json(
    *,
    material_id: str,
    start_us: int,
    duration_us: int,
    transform_y: float = -0.8,
) -> Dict[str, Any]:
    """Segment fields aligned with VisualSegment.export_json() for text."""
    return {
        "id": uuid.uuid4().hex,
        "material_id": material_id,
        "target_timerange": {"start": int(start_us), "duration": int(duration_us)},
        "source_timerange": None,
        "speed": 1.0,
        "volume": 1.0,
        "visible": True,
        "reverse": False,
        "enable_adjust": True,
        "enable_color_correct_adjust": False,
        "enable_color_curves": True,
        "enable_color_match_adjust": False,
        "enable_color_wheels": True,
        "enable_lut": True,
        "enable_smart_color_adjust": False,
        "last_nonzero_volume": 1.0,
        "track_attribute": 0,
        "track_render_index": 0,
        "render_index": 0,
        "extra_material_refs": [],
        "common_keyframes": [],
        "keyframe_refs": [],
        "is_tone_modify": False,
        "clip": {
            "alpha": 1.0,
            "flip": {"horizontal": False, "vertical": False},
            "rotation": 0.0,
            "scale": {"x": 1.0, "y": 1.0},
            "transform": {"x": 0.0, "y": float(transform_y)},
        },
        "uniform_scale": {"on": True, "value": 1.0},
    }


def _clear_text_track_segments(draft: Dict[str, Any], track: Dict[str, Any]) -> None:
    """Remove text-track segments and unreferenced text materials (in-place)."""
    materials = draft.setdefault("materials", {})
    texts = materials.get("texts")
    if not isinstance(texts, list):
        materials["texts"] = []
        texts = materials["texts"]

    removed_ids = set()
    for s in track.get("segments") or []:
        if isinstance(s, dict) and s.get("material_id"):
            removed_ids.add(s["material_id"])
    track["segments"] = []

    # Mutate list in place so callers holding a reference stay consistent
    if removed_ids:
        kept = [
            t
            for t in texts
            if not (isinstance(t, dict) and t.get("id") in removed_ids)
        ]
        texts[:] = kept


def import_srt_into_draft(
    draft: Dict[str, Any],
    srt_content: str,
    *,
    font_size: float = 5.0,
    time_offset_us: int = 0,
    transform_y: float = -0.8,
    replace: bool = False,
) -> int:
    """
    Parse SRT and append text/subtitle segments onto a text track.

    Returns number of cues added.
    """
    cues = parse_srt(srt_content)
    if not cues:
        raise ValueError("SRT rỗng hoặc không parse được cue nào")

    materials = draft.setdefault("materials", {})
    if not isinstance(materials, dict):
        raise ValueError("draft.materials phải là object")
    texts: List[Dict[str, Any]] = materials.setdefault("texts", [])
    if not isinstance(texts, list):
        materials["texts"] = []
        texts = materials["texts"]

    track = _ensure_text_track(draft)
    if replace:
        _clear_text_track_segments(draft, track)

    segs: List[Dict[str, Any]] = track.setdefault("segments", [])
    if not isinstance(segs, list):
        track["segments"] = []
        segs = track["segments"]

    added = 0
    max_end = int(draft.get("duration") or 0)
    for start, end, text in cues:
        start = int(start) + int(time_offset_us)
        end = int(end) + int(time_offset_us)
        if end <= start:
            continue
        mat = _minimal_text_material(text, font_size=float(font_size))
        texts.append(mat)
        duration = end - start
        segs.append(
            _text_segment_json(
                material_id=mat["id"],
                start_us=start,
                duration_us=duration,
                transform_y=transform_y,
            )
        )
        added += 1
        if end > max_end:
            max_end = end

    if added == 0:
        raise ValueError("SRT không có cue hợp lệ sau khi lọc")

    draft["duration"] = max(int(draft.get("duration") or 0), max_end)
    return added


def export_srt_from_draft(draft: Dict[str, Any]) -> str:
    """Read all text tracks → SRT string (sorted by start)."""
    materials = draft.get("materials") or {}
    texts = {
        t.get("id"): t
        for t in (materials.get("texts") or [])
        if isinstance(t, dict) and t.get("id")
    }
    cues: List[Tuple[int, int, str]] = []
    for t in draft.get("tracks") or []:
        if not isinstance(t, dict) or t.get("type") != "text":
            continue
        for s in t.get("segments") or []:
            if not isinstance(s, dict):
                continue
            tr = s.get("target_timerange") or {}
            start = int(tr.get("start") or 0)
            dur = int(tr.get("duration") or 0)
            mid = s.get("material_id")
            mat = texts.get(mid) or {}
            text = _extract_plain_text(mat)
            if text:
                cues.append((start, start + max(dur, 1), text))
    cues.sort(key=lambda x: (x[0], x[1]))
    lines: List[str] = []
    for i, (start, end, text) in enumerate(cues, 1):
        lines.append(str(i))
        lines.append(f"{_us_to_srt_ts(start)} --> {_us_to_srt_ts(end)}")
        lines.append(text)
        lines.append("")
    return "\n".join(lines).strip() + ("\n" if cues else "")


def _extract_plain_text(mat: Dict[str, Any]) -> str:
    if not isinstance(mat, dict):
        return ""
    content = mat.get("content")
    if isinstance(content, dict):
        if "text" in content:
            return str(content["text"])
    if isinstance(content, str):
        content = content.strip()
        if content.startswith("{"):
            try:
                obj = json.loads(content)
                if isinstance(obj, dict) and "text" in obj:
                    return str(obj["text"])
            except Exception:
                pass
        if content:
            return content
    for key in ("text", "name", "title"):
        if mat.get(key):
            return str(mat[key])
    return ""


def load_srt_source(*, srt: str | None = None, srt_path: str | None = None) -> str:
    if srt is not None and str(srt).strip():
        return str(srt)
    if srt_path:
        path = Path(srt_path).expanduser()
        if not path.is_file():
            raise FileNotFoundError(f"Không tìm thấy file SRT: {path}")
        return path.read_text(encoding="utf-8-sig")
    raise ValueError("Cần srt (string) hoặc srt_path")
