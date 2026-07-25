"""
Structure / timeline / projects — pure Python (WAVE2 Grok C).

CLI parity (no capcut-cli / Node):
  cut, concat, diff, detect-scenes (ffmpeg OK), timeline, projects,
  shift-all, version, init, quickstart
"""

from __future__ import annotations

import copy
import json
import os
import re
import shutil
import subprocess
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

from .draft_io import (
    load_raw_draft,
    resolve_draft_json_path,
    save_raw_draft,
)

US = 1_000_000
QUICKSTART_FALLBACK_DURATION_US = 5_000_000

# Mate template used by init / quickstart
_TEMPLATE_DEFAULT2 = (
    Path(__file__).resolve().parents[2] / "template" / "default2"
)


class FfmpegNotFoundError(RuntimeError):
    """ffmpeg binary missing — router maps to HTTP 503."""


class StructureError(ValueError):
    """Invalid structure op arguments (HTTP 422)."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _new_id() -> str:
    return uuid.uuid4().hex


def _ensure_materials(draft: Dict[str, Any]) -> Dict[str, Any]:
    mats = draft.get("materials")
    if not isinstance(mats, dict):
        mats = {}
        draft["materials"] = mats
    return mats


def _ensure_tracks(draft: Dict[str, Any]) -> List[Dict[str, Any]]:
    tracks = draft.get("tracks")
    if not isinstance(tracks, list):
        tracks = []
        draft["tracks"] = tracks
    return tracks


def _seg_timerange(seg: Dict[str, Any]) -> Dict[str, Any]:
    tr = seg.get("target_timerange")
    if not isinstance(tr, dict):
        tr = {"start": 0, "duration": 0}
        seg["target_timerange"] = tr
    tr.setdefault("start", 0)
    tr.setdefault("duration", 0)
    return tr


def _draft_span_us(draft: Dict[str, Any]) -> int:
    span = int(draft.get("duration") or 0)
    for t in _ensure_tracks(draft):
        if not isinstance(t, dict):
            continue
        for s in t.get("segments") or []:
            if not isinstance(s, dict):
                continue
            tr = s.get("target_timerange") or {}
            end = int(tr.get("start") or 0) + int(tr.get("duration") or 0)
            if end > span:
                span = end
    return max(span, 0)


def _index_segments(draft: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    for t in _ensure_tracks(draft):
        if not isinstance(t, dict):
            continue
        for s in t.get("segments") or []:
            if isinstance(s, dict) and s.get("id"):
                out[str(s["id"])] = s
    return out


def _all_material_ids(draft: Dict[str, Any]) -> set:
    ids: set = set()
    mats = draft.get("materials") or {}
    if not isinstance(mats, dict):
        return ids
    for arr in mats.values():
        if not isinstance(arr, list):
            continue
        for m in arr:
            if isinstance(m, dict) and m.get("id"):
                ids.add(str(m["id"]))
    return ids


def _write_draft_out(draft: Dict[str, Any], out: str | Path) -> Path:
    """Write draft JSON to a file path or into a directory as draft_content.json."""
    out_p = Path(out).expanduser().resolve()
    if out_p.suffix.lower() == ".json" or (out_p.exists() and out_p.is_file()):
        out_p.parent.mkdir(parents=True, exist_ok=True)
        save_raw_draft(out_p, draft, backup=False)
        return out_p
    # Directory target
    out_p.mkdir(parents=True, exist_ok=True)
    dest = out_p / "draft_content.json"
    save_raw_draft(dest, draft, backup=False)
    return dest


# ---------------------------------------------------------------------------
# cut
# ---------------------------------------------------------------------------


def cut_project_in_memory(
    draft: Dict[str, Any],
    start_us: int,
    end_us: int,
) -> Dict[str, int]:
    """
    Extract [start_us, end_us) — mutate draft in place (use deepcopy first).
    Returns {kept, removed, duration_us}.
    """
    start_us = int(start_us)
    end_us = int(end_us)
    if end_us <= start_us:
        raise StructureError("end_us must be > start_us / end phải sau start")

    kept = 0
    removed = 0
    removed_mat: set = set()
    removed_extra: set = set()

    tracks = _ensure_tracks(draft)
    for track in tracks:
        if not isinstance(track, dict):
            continue
        surviving: List[Dict[str, Any]] = []
        for seg in track.get("segments") or []:
            if not isinstance(seg, dict):
                continue
            tr = _seg_timerange(seg)
            seg_start = int(tr.get("start") or 0)
            seg_dur = int(tr.get("duration") or 0)
            seg_end = seg_start + seg_dur

            if seg_end <= start_us or seg_start >= end_us:
                mid = seg.get("material_id")
                if mid:
                    removed_mat.add(str(mid))
                for ref in seg.get("extra_material_refs") or []:
                    if isinstance(ref, str):
                        removed_extra.add(ref)
                removed += 1
                continue

            clipped_start = max(seg_start, start_us)
            clipped_end = min(seg_end, end_us)
            trim_from_start = clipped_start - seg_start
            new_duration = clipped_end - clipped_start

            speed = float(seg.get("speed") or 1.0) or 1.0
            src = seg.get("source_timerange")
            if isinstance(src, dict):
                src["start"] = int(src.get("start") or 0) + int(round(trim_from_start * speed))
                src["duration"] = int(round(new_duration * speed))

            tr["start"] = clipped_start - start_us
            tr["duration"] = new_duration
            surviving.append(seg)
            kept += 1

        track["segments"] = surviving

    draft["tracks"] = [t for t in tracks if isinstance(t, dict) and (t.get("segments") or [])]

    surviving_mat: set = set()
    surviving_extra: set = set()
    for t in draft["tracks"]:
        for s in t.get("segments") or []:
            if not isinstance(s, dict):
                continue
            if s.get("material_id"):
                surviving_mat.add(str(s["material_id"]))
            for ref in s.get("extra_material_refs") or []:
                if isinstance(ref, str):
                    surviving_extra.add(ref)

    mats = _ensure_materials(draft)
    for key, arr in list(mats.items()):
        if not isinstance(arr, list):
            continue
        mats[key] = [
            m
            for m in arr
            if not isinstance(m, dict)
            or not m.get("id")
            or str(m["id"]) in surviving_mat
            or str(m["id"]) in surviving_extra
            or (
                str(m["id"]) not in removed_mat
                and str(m["id"]) not in removed_extra
            )
        ]

    duration = end_us - start_us
    draft["duration"] = duration
    return {"kept": kept, "removed": removed, "duration_us": duration}


def cut_to_out(
    project: str,
    start_us: int,
    end_us: int,
    out: str,
) -> Dict[str, Any]:
    """Load project, cut time range, write standalone draft to ``out``."""
    draft, _src = load_raw_draft(project)
    draft = copy.deepcopy(draft)
    stats = cut_project_in_memory(draft, start_us, end_us)
    out_path = _write_draft_out(draft, out)
    return {
        "ok": True,
        "out": str(out_path),
        "kept": stats["kept"],
        "removed": stats["removed"],
        "duration_us": stats["duration_us"],
    }


# ---------------------------------------------------------------------------
# concat
# ---------------------------------------------------------------------------


def concat_drafts(
    project_a: str,
    project_b: str,
    *,
    out: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Append B onto A's timeline (id-safe). Writes to ``out`` or in-place on A.
    """
    a, a_path = load_raw_draft(project_a)
    b, _ = load_raw_draft(project_b)
    b = copy.deepcopy(b)

    offset = int(a.get("duration") or 0)
    if offset <= 0:
        offset = _draft_span_us(a)

    a_seg_ids = set(_index_segments(a).keys())
    a_mat_ids = _all_material_ids(a)

    mat_remap: Dict[str, str] = {}
    b_mats = _ensure_materials(b)
    for arr in b_mats.values():
        if not isinstance(arr, list):
            continue
        for mat in arr:
            if not isinstance(mat, dict):
                continue
            mid = mat.get("id")
            if isinstance(mid, str) and mid in a_mat_ids:
                fresh = _new_id()
                mat_remap[mid] = fresh
                mat["id"] = fresh

    for t in _ensure_tracks(b):
        if not isinstance(t, dict):
            continue
        for s in t.get("segments") or []:
            if not isinstance(s, dict):
                continue
            mid = s.get("material_id")
            if isinstance(mid, str) and mid in mat_remap:
                s["material_id"] = mat_remap[mid]
            refs = s.get("extra_material_refs")
            if isinstance(refs, list):
                s["extra_material_refs"] = [
                    mat_remap.get(r, r) if isinstance(r, str) else r for r in refs
                ]
            sid = s.get("id")
            if isinstance(sid, str) and sid in a_seg_ids:
                s["id"] = _new_id()
            tr = _seg_timerange(s)
            tr["start"] = int(tr.get("start") or 0) + offset

    a_mats = _ensure_materials(a)
    for key, arr in b_mats.items():
        if not isinstance(arr, list):
            continue
        dest = a_mats.get(key)
        if isinstance(dest, list):
            dest.extend(arr)
        else:
            a_mats[key] = list(arr)

    a_tracks = _ensure_tracks(a)
    for bt in _ensure_tracks(b):
        if not isinstance(bt, dict):
            continue
        match = next(
            (
                at
                for at in a_tracks
                if isinstance(at, dict)
                and at.get("type") == bt.get("type")
                and at.get("name") == bt.get("name")
            ),
            None,
        )
        if match is not None:
            segs = match.setdefault("segments", [])
            if not isinstance(segs, list):
                match["segments"] = []
                segs = match["segments"]
            segs.extend(bt.get("segments") or [])
        else:
            a_tracks.append(bt)

    b_dur = int(b.get("duration") or 0) or _draft_span_us(b)
    a["duration"] = offset + b_dur

    if out:
        out_path = _write_draft_out(a, out)
    else:
        out_path = save_raw_draft(a_path, a)

    return {
        "ok": True,
        "path": str(out_path),
        "duration_us": int(a["duration"]),
        "remapped_ids": len(mat_remap),
        "offset_us": offset,
    }


# ---------------------------------------------------------------------------
# diff
# ---------------------------------------------------------------------------


def diff_projects(project_a: str, project_b: str) -> Dict[str, Any]:
    a, _ = load_raw_draft(project_a)
    b, _ = load_raw_draft(project_b)

    a_seg = _index_segments(a)
    b_seg = _index_segments(b)
    seg_added: List[str] = []
    seg_removed: List[str] = []
    seg_changed: List[Dict[str, Any]] = []

    for sid, seg in b_seg.items():
        if sid not in a_seg:
            seg_added.append(sid)
            continue
        prev = a_seg[sid]
        fields: List[str] = []
        atr = prev.get("target_timerange") or {}
        btr = seg.get("target_timerange") or {}
        if int(atr.get("start") or 0) != int(btr.get("start") or 0):
            fields.append("start")
        if int(atr.get("duration") or 0) != int(btr.get("duration") or 0):
            fields.append("duration")
        if prev.get("material_id") != seg.get("material_id"):
            fields.append("material_id")
        if prev.get("speed") != seg.get("speed"):
            fields.append("speed")
        if prev.get("volume") != seg.get("volume"):
            fields.append("volume")
        if fields:
            seg_changed.append({"id": sid, "fields": fields})

    for sid in a_seg:
        if sid not in b_seg:
            seg_removed.append(sid)

    a_mat = _all_material_ids(a)
    b_mat = _all_material_ids(b)
    mat_added = sorted(b_mat - a_mat)
    mat_removed = sorted(a_mat - b_mat)

    changed = bool(
        seg_added
        or seg_removed
        or seg_changed
        or mat_added
        or mat_removed
    )
    return {
        "ok": True,
        "changed": changed,
        "tracks": {
            "a": len(_ensure_tracks(a)),
            "b": len(_ensure_tracks(b)),
        },
        "segments": {
            "added": seg_added,
            "removed": seg_removed,
            "changed": seg_changed,
        },
        "materials": {
            "added": mat_added,
            "removed": mat_removed,
        },
    }


# ---------------------------------------------------------------------------
# detect-scenes (ffmpeg OK — not capcut-cli)
# ---------------------------------------------------------------------------


def parse_scene_cuts(stderr: str) -> List[Dict[str, float]]:
    cuts: List[Dict[str, float]] = []
    pending: Optional[float] = None
    for line in stderr.splitlines():
        mt = re.search(r"\bpts_time:(-?\d+(?:\.\d+)?)", line)
        if mt:
            pending = float(mt.group(1))
            continue
        ms = re.search(r"lavfi\.scene_score=(\d+(?:\.\d+)?)", line)
        if ms and pending is not None:
            if pending > 0:
                cuts.append({"time": pending, "score": float(ms.group(1))})
            pending = None
    cuts.sort(key=lambda c: c["time"])
    return cuts


def parse_ffmpeg_duration(stderr: str) -> Optional[float]:
    m = re.search(r"Duration:\s*(\d+):(\d{2}):(\d+(?:\.\d+)?)", stderr)
    if not m:
        return None
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))


def merge_close_cuts(
    cuts: Sequence[Dict[str, float]],
    min_gap: float,
) -> List[Dict[str, float]]:
    if min_gap <= 0 or len(cuts) < 2:
        return sorted(cuts, key=lambda c: c["time"])
    sorted_c = sorted(cuts, key=lambda c: c["time"])
    merged: List[Dict[str, float]] = []
    best = sorted_c[0]
    prev_time = sorted_c[0]["time"]
    for cut in sorted_c[1:]:
        if cut["time"] - prev_time < min_gap:
            if cut["score"] > best["score"]:
                best = cut
        else:
            merged.append(best)
            best = cut
        prev_time = cut["time"]
    merged.append(best)
    return merged


def limit_cuts(
    cuts: Sequence[Dict[str, float]],
    limit: Optional[int],
) -> List[Dict[str, float]]:
    if limit is None or len(cuts) <= limit:
        return list(cuts)
    top = sorted(cuts, key=lambda c: (-c["score"], c["time"]))[:limit]
    return sorted(top, key=lambda c: c["time"])


def build_scene_segments(
    cuts: Sequence[Dict[str, float]],
    duration: Optional[float],
) -> List[Dict[str, Any]]:
    bounded = [c for c in cuts if duration is None or c["time"] < duration]
    starts = [0.0] + [c["time"] for c in bounded]
    segs: List[Dict[str, Any]] = []
    for i, start in enumerate(starts):
        end = starts[i + 1] if i + 1 < len(starts) else duration
        segs.append(
            {
                "start": start,
                "end": end,
                "duration": None if end is None else round(end - start, 6),
                "start_us": int(round(start * US)),
                "end_us": None if end is None else int(round(end * US)),
                "duration_us": (
                    None
                    if end is None
                    else int(round(end * US)) - int(round(start * US))
                ),
            }
        )
    return segs


def _timecode(seconds: float) -> str:
    total_ms = int(round(seconds * 1000))
    h = total_ms // 3_600_000
    m = (total_ms % 3_600_000) // 60_000
    s = (total_ms % 60_000) / 1000.0
    return f"{h:02d}:{m:02d}:{s:06.3f}"


def detect_scenes(
    video: str,
    *,
    threshold: float = 0.4,
    min_gap: float = 2.0,
    limit: Optional[int] = None,
    ffmpeg_cmd: str = "ffmpeg",
    timeout_s: float = 600.0,
) -> Dict[str, Any]:
    """
    Run ffmpeg scene filter. Raises FfmpegNotFoundError if binary missing.
    """
    video_p = Path(video).expanduser()
    if not video_p.is_file():
        raise FileNotFoundError(f"Không tìm thấy video: {video_p}")

    args = [
        ffmpeg_cmd,
        "-hide_banner",
        "-i",
        str(video_p),
        "-vf",
        f"select='gt(scene,{threshold})',metadata=print",
        "-an",
        "-f",
        "null",
        "-",
    ]
    try:
        proc = subprocess.run(
            args,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout_s,
            shell=False,
        )
    except FileNotFoundError as exc:
        raise FfmpegNotFoundError(
            f"ffmpeg không có trên PATH ('{ffmpeg_cmd}'). "
            f"Cài ffmpeg hoặc truyền ffmpeg_cmd. / "
            f"ffmpeg not found ('{ffmpeg_cmd}'). Install ffmpeg or pass ffmpeg_cmd."
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(
            f"detect-scenes timeout sau {timeout_s}s: {video_p}"
        ) from exc

    stderr = proc.stderr or ""
    if proc.returncode != 0 and not stderr:
        raise RuntimeError(f"ffmpeg failed on {video_p} (exit {proc.returncode})")

    # Even non-zero can still have partial metadata; require 0 for clean report
    if proc.returncode not in (0, None):
        # ffmpeg often returns 0 for -f null; if failed, surface tail
        if "Error" in stderr or proc.returncode not in (0,):
            # Some builds still print useful data — only hard-fail if no cuts parse
            raw = parse_scene_cuts(stderr)
            if not raw and proc.returncode != 0:
                raise RuntimeError(
                    f"ffmpeg failed on {video_p}.\n{stderr[-600:]}"
                )

    cuts = parse_scene_cuts(stderr)
    cuts = merge_close_cuts(cuts, min_gap)
    cuts = limit_cuts(cuts, limit)
    duration = parse_ffmpeg_duration(stderr)

    report_cuts = [
        {
            "time": c["time"],
            "time_us": int(round(c["time"] * US)),
            "timecode": _timecode(c["time"]),
            "score": c["score"],
        }
        for c in cuts
    ]
    segments = build_scene_segments(cuts, duration)

    return {
        "ok": True,
        "video": str(video_p.resolve()),
        "threshold": threshold,
        "min_gap": min_gap,
        "limit": limit,
        "duration": duration,
        "duration_us": None if duration is None else int(round(duration * US)),
        "duration_source": "container" if duration is not None else None,
        "cuts": report_cuts,
        "segments": segments,
    }


# ---------------------------------------------------------------------------
# timeline
# ---------------------------------------------------------------------------


def timeline_layout(
    project: str,
    *,
    cols: int = 60,
) -> Dict[str, Any]:
    draft, path = load_raw_draft(project)
    cols = max(int(cols), 1)
    span = max(_draft_span_us(draft), 1)

    def scale(us: int) -> int:
        return int(round((us / span) * cols))

    tracks_out: List[Dict[str, Any]] = []
    for t in _ensure_tracks(draft):
        if not isinstance(t, dict):
            continue
        segs_out = []
        for s in t.get("segments") or []:
            if not isinstance(s, dict):
                continue
            tr = s.get("target_timerange") or {}
            start = int(tr.get("start") or 0)
            dur = int(tr.get("duration") or 0)
            col_start = scale(start)
            col_end = max(col_start + 1, scale(start + dur))
            segs_out.append(
                {
                    "id": s.get("id"),
                    "start_us": start,
                    "duration_us": dur,
                    "col_start": col_start,
                    "col_end": col_end,
                }
            )
        tracks_out.append(
            {
                "id": t.get("id"),
                "type": t.get("type"),
                "name": t.get("name"),
                "segments": segs_out,
            }
        )

    return {
        "ok": True,
        "path": str(path),
        "span_us": span,
        "cols": cols,
        "tracks": tracks_out,
    }


# ---------------------------------------------------------------------------
# projects
# ---------------------------------------------------------------------------


def default_draft_roots() -> List[Dict[str, str]]:
    """Common CapCut / JianYing draft store roots (Windows + macOS + Linux)."""
    roots: List[Dict[str, str]] = []
    home = Path.home()
    local = os.environ.get("LOCALAPPDATA") or str(home / "AppData" / "Local")
    candidates = [
        ("capcut-win", Path(local) / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft"),
        ("bytedance-capcut-win", Path(local) / "Bytedance" / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft"),
        ("jianying-win", Path(local) / "JianyingPro" / "User Data" / "Projects" / "com.lveditor.draft"),
        ("capcut-mac", home / "Movies" / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft"),
        ("jianying-mac", home / "Movies" / "JianyingPro" / "User Data" / "Projects" / "com.lveditor.draft"),
        ("mate-output", Path(__file__).resolve().parents[2] / "output" / "draft"),
    ]
    for label, p in candidates:
        roots.append({"label": label, "path": str(p)})
    return roots


def _resolve_project_cover(entry: Path) -> Optional[str]:
    """
    CapCut/JianYing cover image path (absolute) if file exists.
    Prefer draft_meta_info.json draft_cover, then common filenames.
    """
    meta_path = entry / "draft_meta_info.json"
    candidates: List[str] = []
    if meta_path.is_file():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8-sig"))
            if isinstance(meta, dict):
                dc = meta.get("draft_cover") or meta.get("cover")
                if isinstance(dc, str) and dc.strip():
                    candidates.append(dc.strip())
        except (OSError, json.JSONDecodeError):
            pass
    candidates.extend(
        [
            "draft_cover.jpg",
            "draft_cover.png",
            "draft_cover.jpeg",
            "draft_cover.webp",
            "cover.jpg",
            "cover.png",
            "cover.jpeg",
        ]
    )
    seen: set[str] = set()
    for rel in candidates:
        if not rel or rel in seen:
            continue
        seen.add(rel)
        p = Path(rel)
        if p.is_absolute() and p.is_file():
            return str(p)
        cand = entry / rel
        if cand.is_file():
            return str(cand)
    return None


def _timeline_span_us(draft: Dict[str, Any]) -> int:
    """Max end time across segments (µs). Falls back to draft.duration."""
    max_end = 0
    for t in draft.get("tracks") or []:
        if not isinstance(t, dict):
            continue
        for s in t.get("segments") or []:
            if not isinstance(s, dict):
                continue
            tr = s.get("target_timerange") or s.get("source_timerange") or {}
            if not isinstance(tr, dict):
                continue
            try:
                st = int(tr.get("start") or 0)
                du = int(tr.get("duration") or 0)
            except (TypeError, ValueError):
                continue
            max_end = max(max_end, st + du)
    if max_end > 0:
        return max_end
    try:
        return max(0, int(draft.get("duration") or 0))
    except (TypeError, ValueError):
        return 0


def _count_media(draft: Dict[str, Any]) -> Dict[str, int]:
    mats = draft.get("materials") if isinstance(draft.get("materials"), dict) else {}
    def _n(key: str) -> int:
        v = mats.get(key)
        return len(v) if isinstance(v, list) else 0

    seg_n = 0
    for t in draft.get("tracks") or []:
        if isinstance(t, dict):
            segs = t.get("segments") or []
            if isinstance(segs, list):
                seg_n += len(segs)
    return {
        "videos": _n("videos"),
        "audios": _n("audios"),
        "images": _n("images"),
        "texts": _n("texts"),
        "segments": seg_n,
    }


def _looks_like_uuid(s: str) -> bool:
    s = s.strip()
    if len(s) < 32:
        return False
    # 8-4-4-4-12 or compact hex folder id
    hexish = s.replace("-", "")
    return len(hexish) >= 32 and all(c in "0123456789abcdefABCDEF" for c in hexish)


def _read_project_meta(entry: Path, draft_file: Path) -> Dict[str, Any]:
    """name / duration_us / empty / media counts from meta + draft content."""
    out: Dict[str, Any] = {}
    meta_path = entry / "draft_meta_info.json"
    if meta_path.is_file():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8-sig"))
            if isinstance(meta, dict):
                name = meta.get("draft_name") or meta.get("name")
                if name and str(name).strip():
                    out["name"] = str(name).strip()
                dur = meta.get("tm_duration")
                if dur is not None:
                    try:
                        d = int(dur)
                        if d > 0:
                            out["duration_us"] = d
                    except (TypeError, ValueError):
                        pass
        except (OSError, json.JSONDecodeError):
            pass

    data: Dict[str, Any] = {}
    try:
        raw = json.loads(draft_file.read_text(encoding="utf-8-sig"))
        if isinstance(raw, dict):
            data = raw
    except (OSError, json.JSONDecodeError):
        data = {}

    if data:
        content_name = str(data.get("name") or "").strip()
        if content_name and (
            "name" not in out
            or _looks_like_uuid(str(out.get("name") or ""))
        ):
            if not _looks_like_uuid(content_name):
                out["name"] = content_name
        span = _timeline_span_us(data)
        if span > 0:
            out["duration_us"] = span
        elif "duration_us" not in out:
            out["duration_us"] = 0
        counts = _count_media(data)
        out["media"] = counts
        out["empty"] = (
            counts["segments"] == 0
            and counts["videos"] == 0
            and counts["audios"] == 0
            and counts["images"] == 0
            and int(out.get("duration_us") or 0) == 0
        )
        # create time for display
        ct = data.get("create_time")
        if ct is not None:
            try:
                out["create_time"] = int(ct)
            except (TypeError, ValueError):
                pass

    # Prefer readable name: folder if meta name is UUID / empty
    folder = entry.name
    nm = str(out.get("name") or "").strip()
    if not nm or _looks_like_uuid(nm):
        # short folder id (mate drafts often timestamp-hex)
        if len(folder) > 18:
            out["name"] = f"Draft {folder[:8]}…{folder[-4:]}"
            out["name_raw"] = nm or folder
        else:
            out["name"] = folder
            out["name_raw"] = nm or folder
    if "empty" not in out:
        out["empty"] = int(out.get("duration_us") or 0) == 0
    if "duration_us" not in out:
        out["duration_us"] = 0
    return out


def list_projects(
    drafts_dir: Optional[str] = None,
    *,
    query: Optional[str] = None,
    names: bool = False,
) -> Dict[str, Any]:
    """Scan draft folders containing draft_content.json / draft_info.json."""
    if drafts_dir:
        expanded = os.path.expandvars(os.path.expanduser(str(drafts_dir).strip()))
        roots = [{"label": "custom", "path": expanded}]
    else:
        roots = default_draft_roots()

    q = query.lower() if query else None
    projects: List[Dict[str, Any]] = []

    for root in roots:
        root_p = Path(root["path"])
        if not root_p.is_dir():
            continue
        try:
            if (root_p / "draft_content.json").is_file() or (root_p / "draft_info.json").is_file():
                entries = [root_p]
            else:
                entries = list(root_p.iterdir())
        except OSError:
            continue
        for entry in entries:
            if not entry.is_dir():
                continue
            draft_file = None
            for name in ("draft_content.json", "draft_info.json"):
                cand = entry / name
                if cand.is_file():
                    draft_file = cand
                    break
            if draft_file is None:
                continue
            folder = entry.name
            meta_extra = _read_project_meta(entry, draft_file)
            display = str(meta_extra.get("name") or folder)
            if q and q not in folder.lower() and q not in display.lower():
                continue
            try:
                mtime = draft_file.stat().st_mtime
                mtime_iso = __import__("datetime").datetime.fromtimestamp(
                    mtime
                ).isoformat()
            except OSError:
                mtime_iso = ""
            cover = _resolve_project_cover(entry)
            rec: Dict[str, Any] = {
                "folder": folder,
                "path": str(draft_file),
                "project": str(entry),
                "mtime": mtime_iso,
                "root": root["label"],
                "has_cover": cover is not None,
                "empty": bool(meta_extra.get("empty")),
                "duration_us": int(meta_extra.get("duration_us") or 0),
            }
            if cover:
                rec["cover_path"] = cover
            if meta_extra.get("name"):
                rec["name"] = meta_extra["name"]
            if meta_extra.get("name_raw"):
                rec["name_raw"] = meta_extra["name_raw"]
            if meta_extra.get("media"):
                rec["media"] = meta_extra["media"]
            projects.append(rec)

    projects.sort(key=lambda p: p.get("mtime") or "", reverse=True)
    return {"ok": True, "count": len(projects), "projects": projects}


def delete_project(project: str, *, confirm: bool = False) -> Dict[str, Any]:
    """
    Xóa hẳn folder draft CapCut/mate trên đĩa (không hoàn tác).

    Safety:
    - Bắt buộc confirm=True
    - Path phải là folder chứa draft_content.json hoặc draft_info.json
    - Không cho xóa root com.lveditor.draft / output/draft (parent list)
    """
    if not confirm:
        raise ValueError("Thiếu confirm=true — từ chối xóa để tránh lỡ tay")

    p = Path(project).expanduser()
    if p.is_file() and p.name in ("draft_content.json", "draft_info.json"):
        entry = p.parent
    else:
        entry = p

    if not entry.is_dir():
        raise FileNotFoundError(f"Không thấy folder project: {entry}")

    entry = entry.resolve()
    has_draft = any(
        (entry / n).is_file() for n in ("draft_content.json", "draft_info.json")
    )
    if not has_draft:
        raise ValueError(
            "Không phải folder draft (thiếu draft_content.json / draft_info.json)"
        )

    # Refuse deleting known roots (parent of many projects)
    name_l = entry.name.lower()
    if name_l in ("com.lveditor.draft", "draft", "projects"):
        # still allow if it looks like a single project (has draft json) —
        # but refuse if parent is User Data style and name is root
        if name_l == "com.lveditor.draft":
            raise ValueError("Không được xóa cả thư mục gốc com.lveditor.draft")

    # Must not be a drive root
    if entry.parent == entry:
        raise ValueError("Path không hợp lệ (root ổ đĩa)")

    shutil.rmtree(entry)
    return {
        "ok": True,
        "deleted": str(entry),
        "message": "Đã xóa folder draft trên đĩa",
    }


# ---------------------------------------------------------------------------
# shift-all
# ---------------------------------------------------------------------------


def shift_all(
    project: str,
    offset_us: int,
    *,
    track_type: Optional[str] = None,
    save: bool = True,
) -> Dict[str, Any]:
    draft, path = load_raw_draft(project)
    offset_us = int(offset_us)
    count = 0
    for t in _ensure_tracks(draft):
        if not isinstance(t, dict):
            continue
        if track_type and t.get("type") != track_type:
            continue
        for s in t.get("segments") or []:
            if not isinstance(s, dict):
                continue
            tr = _seg_timerange(s)
            tr["start"] = max(0, int(tr.get("start") or 0) + offset_us)
            count += 1
    # Recompute duration span
    draft["duration"] = _draft_span_us(draft)
    if save:
        save_raw_draft(path, draft)
    return {
        "ok": True,
        "path": str(path),
        "shifted": count,
        "offset_us": offset_us,
        "duration_us": int(draft["duration"]),
    }


# ---------------------------------------------------------------------------
# version
# ---------------------------------------------------------------------------


def detect_version(project: str) -> Dict[str, Any]:
    draft, path = load_raw_draft(project)
    platform = draft.get("platform") if isinstance(draft.get("platform"), dict) else {}
    app_source = platform.get("app_source") or "unknown"
    if app_source == "cc":
        app = "CapCut"
    elif app_source == "lv":
        app = "JianYing"
    else:
        app = "unknown"

    mats = draft.get("materials") if isinstance(draft.get("materials"), dict) else {}
    has_mask = isinstance(mats.get("masks"), list) and len(mats.get("masks") or []) > 0
    has_common = (
        isinstance(mats.get("common_masks"), list)
        and len(mats.get("common_masks") or []) > 0
    )
    if has_mask and has_common:
        mask_field = "both"
    elif has_common:
        mask_field = "common_masks"
    elif has_mask or isinstance(mats.get("masks"), list):
        mask_field = "mask"
    else:
        mask_field = "none"

    return {
        "ok": True,
        "path": str(path),
        "app": app,
        "app_source": app_source,
        "app_version": platform.get("app_version"),
        "os": platform.get("os"),
        "schema": {
            "mask_field": mask_field,
            "has_audio_fades": isinstance(mats.get("audio_fades"), list),
            "new_version_field": draft.get("new_version"),
            "last_modified_platform": draft.get("last_modified_platform"),
        },
        "id": draft.get("id"),
        "name": draft.get("name"),
        "duration": draft.get("duration"),
        "fps": draft.get("fps"),
    }


# ---------------------------------------------------------------------------
# init
# ---------------------------------------------------------------------------


def init_draft(
    name: str,
    *,
    drafts_dir: Optional[str] = None,
    template_dir: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a new empty draft folder from Mate ``template/default2``.
    """
    if not name or not str(name).strip():
        raise StructureError("name rỗng / empty draft name")
    # Sanitize path segments
    safe = str(name).strip().replace("..", "_").replace("/", "_").replace("\\", "_")
    base = Path(drafts_dir).expanduser() if drafts_dir else (
        Path(__file__).resolve().parents[2] / "output" / "draft"
    )
    base.mkdir(parents=True, exist_ok=True)
    draft_path = (base / safe).resolve()
    if draft_path.exists():
        raise StructureError(
            f"Draft đã tồn tại: {draft_path}. Xóa trước hoặc đổi tên. / "
            f"Draft already exists: {draft_path}"
        )

    tmpl = Path(template_dir).expanduser() if template_dir else _TEMPLATE_DEFAULT2
    if not tmpl.is_dir():
        raise FileNotFoundError(f"Không tìm thấy template: {tmpl}")

    shutil.copytree(tmpl, draft_path)

    # Update draft JSON identity
    json_path = None
    for cand in ("draft_content.json", "draft_info.json"):
        p = draft_path / cand
        if p.is_file():
            json_path = p
            break
    if json_path is None:
        raise FileNotFoundError(
            f"Template thiếu draft_content.json / draft_info.json: {tmpl}"
        )

    draft, _ = load_raw_draft(str(json_path))
    draft["name"] = safe
    draft["id"] = str(uuid.uuid4())
    save_raw_draft(json_path, draft, backup=False)

    # Also mirror id into draft_info if both exist
    sibling = "draft_info.json" if json_path.name == "draft_content.json" else "draft_content.json"
    sib = draft_path / sibling
    if sib.is_file() and sib != json_path:
        try:
            other, _ = load_raw_draft(str(sib))
            other["name"] = safe
            other["id"] = draft["id"]
            save_raw_draft(sib, other, backup=False)
        except (OSError, ValueError, json.JSONDecodeError):
            pass

    return {
        "ok": True,
        "name": safe,
        "draft_path": str(draft_path),
        "file_path": str(json_path),
        "id": draft["id"],
    }


# ---------------------------------------------------------------------------
# quickstart (init + add local video)
# ---------------------------------------------------------------------------


def _probe_duration_us(media: str, ffprobe_cmd: str = "ffprobe") -> Optional[int]:
    try:
        proc = subprocess.run(
            [
                ffprobe_cmd,
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(media),
            ],
            capture_output=True,
            text=True,
            timeout=30,
            shell=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
    if proc.returncode != 0:
        return None
    try:
        sec = float((proc.stdout or "").strip())
        if sec > 0:
            return int(round(sec * US))
    except ValueError:
        return None
    return None


def _add_local_video(
    draft: Dict[str, Any],
    draft_dir: Path,
    video_path: str,
    *,
    start_us: int = 0,
    duration_us: Optional[int] = None,
    width: int = 1920,
    height: int = 1080,
) -> Dict[str, str]:
    """Minimal local-path video add (quickstart only — pure Python)."""
    src = Path(video_path).expanduser().resolve()
    if not src.is_file():
        raise FileNotFoundError(f"Không tìm thấy video: {src}")

    if duration_us is None or duration_us <= 0:
        duration_us = _probe_duration_us(str(src)) or QUICKSTART_FALLBACK_DURATION_US

    assets = draft_dir / "assets" / "video"
    assets.mkdir(parents=True, exist_ok=True)
    dest = assets / src.name
    if not dest.exists():
        shutil.copy2(src, dest)

    mat_id = _new_id()
    seg_id = _new_id()
    track_id = _new_id()
    speed_id = _new_id()
    canvas_id = _new_id()

    mats = _ensure_materials(draft)
    for key in (
        "videos",
        "speeds",
        "canvases",
        "placeholder_infos",
        "sound_channel_mappings",
        "vocal_separations",
        "material_colors",
    ):
        mats.setdefault(key, [])
        if not isinstance(mats[key], list):
            mats[key] = []

    mats["videos"].append(
        {
            "id": mat_id,
            "path": str(dest),
            "material_name": src.name,
            "type": "video",
            "duration": int(duration_us),
            "width": int(width),
            "height": int(height),
            "category_name": "local",
            "has_audio": True,
        }
    )
    mats["speeds"].append(
        {"id": speed_id, "type": "speed", "speed": 1.0, "mode": 0, "curve_speed": None}
    )
    mats["canvases"].append(
        {
            "id": canvas_id,
            "type": "canvas_color",
            "blur": 0,
            "color": "",
            "image": "",
            "image_id": "",
        }
    )

    tracks = _ensure_tracks(draft)
    track = next(
        (t for t in tracks if isinstance(t, dict) and t.get("type") == "video"),
        None,
    )
    if track is None:
        track = {
            "id": track_id,
            "type": "video",
            "name": "video",
            "attribute": 0,
            "flag": 0,
            "is_default_name": True,
            "segments": [],
        }
        tracks.append(track)

    segment = {
        "id": seg_id,
        "material_id": mat_id,
        "target_timerange": {"start": int(start_us), "duration": int(duration_us)},
        "source_timerange": {"start": 0, "duration": int(duration_us)},
        "speed": 1.0,
        "volume": 1.0,
        "visible": True,
        "reverse": False,
        "clip": {
            "alpha": 1.0,
            "rotation": 0.0,
            "scale": {"x": 1.0, "y": 1.0},
            "transform": {"x": 0.0, "y": 0.0},
            "flip": {"horizontal": False, "vertical": False},
        },
        "extra_material_refs": [speed_id, canvas_id],
        "common_keyframes": [],
        "keyframe_refs": [],
        "render_index": 14000,
        "track_render_index": 0,
        "track_attribute": 0,
    }
    segs = track.setdefault("segments", [])
    if not isinstance(segs, list):
        track["segments"] = []
        segs = track["segments"]
    segs.append(segment)

    end = int(start_us) + int(duration_us)
    if end > int(draft.get("duration") or 0):
        draft["duration"] = end

    return {
        "segment_id": seg_id,
        "material_id": mat_id,
        "track_id": str(track.get("id")),
    }


def quickstart(
    name: str,
    *,
    video: Optional[str] = None,
    drafts_dir: Optional[str] = None,
    template_dir: Optional[str] = None,
    duration_us: Optional[int] = None,
) -> Dict[str, Any]:
    """init + optional add-video (local path)."""
    if not video:
        raise StructureError(
            "quickstart cần --video / quickstart requires video path"
        )
    created = init_draft(name, drafts_dir=drafts_dir, template_dir=template_dir)
    draft_path = Path(created["draft_path"])
    draft, json_path = load_raw_draft(str(draft_path))
    added = _add_local_video(
        draft,
        draft_path,
        video,
        duration_us=duration_us,
    )
    save_raw_draft(json_path, draft, backup=False)
    return {
        "ok": True,
        **created,
        "file_path": str(json_path),
        "added": {"video": True, **added},
        "duration_us": int(draft.get("duration") or 0),
    }
