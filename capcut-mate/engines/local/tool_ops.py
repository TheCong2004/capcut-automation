"""
Tooling / batch / diagnose — pure Python (WAVE2 Grok E).

CẤM capcut-cli / Node. Dùng load_raw_draft / save_raw_draft.
"""

from __future__ import annotations

import json
import os
import platform
import re
import shutil
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from .draft_io import load_raw_draft, resolve_draft_json_path, save_raw_draft
from .edit_segment import set_opacity, set_speed, set_volume, shift_segment, trim_segment
from .inspect import list_segments, list_tracks, summarize
from . import content as content_eng
from . import motion as motion_eng
from . import srt as srt_eng
from . import visual as visual_eng

US = 1_000_000
MIN_CAPTION_DURATION_US = 100_000

DEFAULT_LINT_OPTS: Dict[str, Any] = {
    "max_chars_per_line": 42,
    "max_cue_duration_us": 7_000_000,
    "min_gap_between_captions_us": 0,
    "check_local_paths": True,
}

# ── helpers ────────────────────────────────────────────────────────────────


def _short(sid: Optional[str], n: int = 8) -> str:
    s = sid or ""
    return s[:n] if len(s) > n else s


def _materials_index(draft: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    idx: Dict[str, Dict[str, Any]] = {}
    mats = draft.get("materials") or {}
    if not isinstance(mats, dict):
        return idx
    for _kind, items in mats.items():
        if not isinstance(items, list):
            continue
        for m in items:
            if isinstance(m, dict) and m.get("id"):
                idx[str(m["id"])] = m
    return idx


def _text_tracks(draft: Dict[str, Any]) -> List[Dict[str, Any]]:
    out = []
    for t in draft.get("tracks") or []:
        if isinstance(t, dict) and t.get("type") == "text":
            out.append(t)
    return out


def _file_exists(path: str) -> bool:
    try:
        return Path(path).expanduser().is_file()
    except OSError:
        return False


def _which(cmd: str) -> Optional[str]:
    found = shutil.which(cmd)
    return found


def _project_dir(path: Path) -> Path:
    """Folder containing draft JSON (or parent of file)."""
    return path if path.is_dir() else path.parent


# ── lint ───────────────────────────────────────────────────────────────────


def lint_draft(
    draft: Dict[str, Any],
    opts: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Port subset of capcut-cli lint — pure Python."""
    o = {**DEFAULT_LINT_OPTS, **(opts or {})}
    issues: List[Dict[str, Any]] = []
    mat_idx = _materials_index(draft)

    for seg_info in list_segments(draft):
        mid = seg_info.get("material_id")
        if not mid:
            continue
        if str(mid) not in mat_idx:
            issues.append(
                {
                    "severity": "error",
                    "code": "missing-material",
                    "message": (
                        f"Segment {_short(str(seg_info.get('id')))} references "
                        f"material {_short(str(mid))} that does not exist"
                    ),
                    "fixable": False,
                    "location": {
                        "segment_id": seg_info.get("id"),
                        "material_id": mid,
                        "track": seg_info.get("track_type"),
                    },
                }
            )

    max_cue = int(o["max_cue_duration_us"])
    max_chars = int(o["max_chars_per_line"])
    min_gap = int(o["min_gap_between_captions_us"])

    for track in _text_tracks(draft):
        segs = list(track.get("segments") or [])
        segs = [s for s in segs if isinstance(s, dict)]
        segs.sort(
            key=lambda s: int((s.get("target_timerange") or {}).get("start") or 0)
        )
        for i, s in enumerate(segs):
            tr = s.get("target_timerange") or {}
            dur = int(tr.get("duration") or 0)
            sid = s.get("id")
            mid = s.get("material_id")
            mat = mat_idx.get(str(mid)) if mid else None
            text = content_eng.extract_plain_text(mat) if mat else ""

            if dur > max_cue:
                issues.append(
                    {
                        "severity": "warning",
                        "code": "cue-too-long",
                        "message": (
                            f"Caption {_short(str(sid))} runs "
                            f"{dur // 1000}ms (>{max_cue / 1_000_000}s)"
                        ),
                        "fixable": True,
                        "location": {
                            "track": track.get("name"),
                            "segment_id": sid,
                        },
                    }
                )

            for line in text.splitlines():
                if len(line) > max_chars:
                    issues.append(
                        {
                            "severity": "warning",
                            "code": "line-too-long",
                            "message": (
                                f"Caption {_short(str(sid))} has "
                                f"{len(line)}-char line (>{max_chars})"
                            ),
                            "fixable": " " in line,
                            "location": {
                                "track": track.get("name"),
                                "segment_id": sid,
                            },
                        }
                    )
                    break

            if i + 1 < len(segs):
                nxt = segs[i + 1]
                ntr = nxt.get("target_timerange") or {}
                end = int(tr.get("start") or 0) + dur
                nstart = int(ntr.get("start") or 0)
                gap = nstart - end
                if gap < 0:
                    issues.append(
                        {
                            "severity": "error",
                            "code": "caption-overlap",
                            "message": (
                                f"Captions {_short(str(sid))} and "
                                f"{_short(str(nxt.get('id')))} overlap by "
                                f"{(-gap) // 1000}ms"
                            ),
                            "fixable": True,
                            "location": {
                                "track": track.get("name"),
                                "segment_id": sid,
                            },
                        }
                    )
                elif min_gap > 0 and 0 < gap < min_gap:
                    shrunk = dur - (min_gap - gap)
                    issues.append(
                        {
                            "severity": "warning",
                            "code": "caption-gap-too-small",
                            "message": (
                                f"Captions {_short(str(sid))} and "
                                f"{_short(str(nxt.get('id')))} are "
                                f"{gap // 1000}ms apart (<{min_gap // 1000}ms)"
                            ),
                            "fixable": shrunk >= MIN_CAPTION_DURATION_US,
                            "location": {
                                "track": track.get("name"),
                                "segment_id": sid,
                            },
                        }
                    )

    if o.get("check_local_paths"):
        mats = draft.get("materials") or {}
        for kind in ("videos", "audios", "images"):
            for m in mats.get(kind) or []:
                if not isinstance(m, dict):
                    continue
                p = m.get("path")
                if not isinstance(p, str) or not p:
                    continue
                if p.startswith("http://") or p.startswith("https://"):
                    continue
                if not _file_exists(p):
                    issues.append(
                        {
                            "severity": "error",
                            "code": "missing-file",
                            "message": (
                                f"Material {_short(str(m.get('id')))} ({kind}) "
                                f"missing file: {p}"
                            ),
                            "fixable": False,
                            "location": {
                                "material_id": m.get("id"),
                                "path": p,
                            },
                        }
                    )

    return issues


def lint_summary(issues: List[Dict[str, Any]]) -> Dict[str, int]:
    errors = warnings = info = 0
    for i in issues:
        sev = i.get("severity")
        if sev == "error":
            errors += 1
        elif sev == "warning":
            warnings += 1
        else:
            info += 1
    return {
        "errors": errors,
        "warnings": warnings,
        "info": info,
        "total": len(issues),
    }


def _rewrap_line(line: str, max_chars: int) -> str:
    if len(line) <= max_chars or " " not in line:
        return line
    out_parts: List[str] = []
    rest = line
    while len(rest) > max_chars:
        brk = rest.rfind(" ", 0, max_chars + 1)
        if brk <= 0:
            break
        out_parts.append(rest[:brk])
        rest = rest[brk + 1 :]
    out_parts.append(rest)
    return "\n".join(out_parts)


def fix_draft(
    draft: Dict[str, Any],
    opts: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Best-effort lint --fix (caption duration / overlap / rewrap)."""
    o = {**DEFAULT_LINT_OPTS, **(opts or {})}
    before = lint_draft(draft, o)
    max_cue = int(o["max_cue_duration_us"])
    max_chars = int(o["max_chars_per_line"])
    min_gap = int(o["min_gap_between_captions_us"])

    for track in _text_tracks(draft):
        for s in track.get("segments") or []:
            if not isinstance(s, dict):
                continue
            tr = s.get("target_timerange") or {}
            if not isinstance(tr, dict):
                continue
            dur = int(tr.get("duration") or 0)
            if dur > max_cue:
                tr["duration"] = max_cue
                s["target_timerange"] = tr
                src = s.get("source_timerange")
                if isinstance(src, dict) and int(src.get("duration") or 0) == dur:
                    src["duration"] = max_cue

    for track in _text_tracks(draft):
        segs = [s for s in (track.get("segments") or []) if isinstance(s, dict)]
        segs.sort(
            key=lambda s: int((s.get("target_timerange") or {}).get("start") or 0)
        )
        for i in range(len(segs) - 1):
            s = segs[i]
            nxt = segs[i + 1]
            tr = s.get("target_timerange") or {}
            ntr = nxt.get("target_timerange") or {}
            if not isinstance(tr, dict) or not isinstance(ntr, dict):
                continue
            end = int(tr.get("start") or 0) + int(tr.get("duration") or 0)
            nstart = int(ntr.get("start") or 0)
            overlap = end - nstart
            if overlap > 0:
                old = int(tr.get("duration") or 0)
                new_d = max(0, old - overlap)
                tr["duration"] = new_d
                s["target_timerange"] = tr
                src = s.get("source_timerange")
                if isinstance(src, dict) and int(src.get("duration") or 0) == old:
                    src["duration"] = new_d

    if min_gap > 0:
        for track in _text_tracks(draft):
            segs = [s for s in (track.get("segments") or []) if isinstance(s, dict)]
            segs.sort(
                key=lambda s: int((s.get("target_timerange") or {}).get("start") or 0)
            )
            for i in range(len(segs) - 1):
                s = segs[i]
                nxt = segs[i + 1]
                tr = s.get("target_timerange") or {}
                ntr = nxt.get("target_timerange") or {}
                if not isinstance(tr, dict) or not isinstance(ntr, dict):
                    continue
                end = int(tr.get("start") or 0) + int(tr.get("duration") or 0)
                nstart = int(ntr.get("start") or 0)
                gap = nstart - end
                if 0 < gap < min_gap:
                    old = int(tr.get("duration") or 0)
                    new_d = old - (min_gap - gap)
                    if new_d < MIN_CAPTION_DURATION_US:
                        continue
                    tr["duration"] = new_d
                    s["target_timerange"] = tr
                    src = s.get("source_timerange")
                    if isinstance(src, dict) and int(src.get("duration") or 0) == old:
                        src["duration"] = new_d

    mat_idx = _materials_index(draft)
    for track in _text_tracks(draft):
        for s in track.get("segments") or []:
            if not isinstance(s, dict):
                continue
            mid = s.get("material_id")
            mat = mat_idx.get(str(mid)) if mid else None
            if not mat:
                continue
            obj = content_eng.parse_content_obj(mat.get("content"))
            if not obj or not isinstance(obj.get("text"), str):
                continue
            text = obj["text"]
            lines = text.split("\n")
            new_lines = [_rewrap_line(ln, max_chars) for ln in lines]
            new_text = "\n".join(new_lines)
            if new_text != text:
                content_eng.set_text(
                    draft,
                    new_text,
                    material_id=str(mid),
                    recalc_style=True,
                )

    after = lint_draft(draft, o)
    before_keys = {
        (i.get("code"), (i.get("location") or {}).get("segment_id"), i.get("message"))
        for i in before
    }
    after_keys = {
        (i.get("code"), (i.get("location") or {}).get("segment_id"), i.get("message"))
        for i in after
    }
    fixed = [i for i in before if (
        i.get("code"),
        (i.get("location") or {}).get("segment_id"),
        i.get("message"),
    ) not in after_keys]
    remaining = after
    return {
        "fixed": fixed,
        "remaining": remaining,
        "summary_before": lint_summary(before),
        "summary_after": lint_summary(after),
        "before_keys": len(before_keys),
    }


# ── doctor ─────────────────────────────────────────────────────────────────


def run_doctor() -> Dict[str, Any]:
    checks: List[Dict[str, Any]] = []

    py_ver = sys.version.split()[0]
    checks.append(
        {
            "name": "python",
            "status": "ok" if sys.version_info >= (3, 10) else "missing",
            "detail": f"Python {py_ver}",
            "affects": ["*"] if sys.version_info < (3, 10) else None,
            "fix": None if sys.version_info >= (3, 10) else "Cần Python >= 3.10",
        }
    )

    checks.append(
        {
            "name": "capcut-cli",
            "status": "ok",
            "detail": "không bắt buộc — pure Python trong capcut-mate",
            "affects": None,
            "fix": None,
        }
    )

    ffmpeg = _which("ffmpeg")
    checks.append(
        {
            "name": "ffmpeg",
            "status": "ok" if ffmpeg else "warn",
            "detail": f"found: {ffmpeg}" if ffmpeg else "ffmpeg không có trên PATH",
            "affects": ["render", "detect-scenes"],
            "fix": None if ffmpeg else "Cài ffmpeg để render/preview",
        }
    )

    ffprobe = _which("ffprobe")
    checks.append(
        {
            "name": "ffprobe",
            "status": "ok" if ffprobe else "warn",
            "detail": f"found: {ffprobe}" if ffprobe else "ffprobe không có trên PATH",
            "affects": ["add-video", "compile"],
            "fix": None if ffprobe else "Cài ffmpeg (kèm ffprobe)",
        }
    )

    whisper = _which("whisper") or _which("whisper-cli") or _which("faster-whisper")
    checks.append(
        {
            "name": "whisper",
            "status": "ok" if whisper else "warn",
            "detail": f"found: {whisper}" if whisper else "không có whisper binary",
            "affects": ["caption"],
            "fix": None if whisper else "pip install openai-whisper (optional)",
        }
    )

    has_key = bool(os.environ.get("ANTHROPIC_API_KEY"))
    checks.append(
        {
            "name": "anthropic-api-key",
            "status": "ok" if has_key else "warn",
            "detail": "ANTHROPIC_API_KEY set" if has_key else "ANTHROPIC_API_KEY chưa set",
            "affects": ["translate"],
            "fix": None if has_key else "export ANTHROPIC_API_KEY=… (optional)",
        }
    )

    for label, path in _default_draft_dirs():
        found = Path(path).is_dir()
        checks.append(
            {
                "name": "draft-dir",
                "status": "ok" if found else "warn",
                "detail": f"{label}: {'found' if found else 'not found'} ({path})",
                "fix": None
                if found
                else "Mở CapCut một lần hoặc truyền project path tường minh",
            }
        )

    ok = not any(c.get("status") == "missing" for c in checks)
    return {
        "ok": ok,
        "platform": f"{platform.system()} {platform.release()}",
        "python": py_ver,
        "capcut_cli_required": False,
        "checks": checks,
    }


def _default_draft_dirs() -> List[Tuple[str, str]]:
    home = Path.home()
    sysname = platform.system()
    if sysname == "Windows":
        local = os.environ.get("LOCALAPPDATA") or str(home / "AppData" / "Local")
        return [
            (
                "CapCut (Windows)",
                str(Path(local) / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft"),
            ),
            (
                "JianYing (Windows)",
                str(
                    Path(local)
                    / "JianyingPro"
                    / "User Data"
                    / "Projects"
                    / "com.lveditor.draft"
                ),
            ),
        ]
    if sysname == "Darwin":
        return [
            (
                "CapCut (macOS)",
                str(home / "Movies/CapCut/User Data/Projects/com.lveditor.draft"),
            ),
            (
                "JianYing (macOS)",
                str(
                    home
                    / "Movies/JianyingPro/User Data/Projects/com.lveditor.draft"
                ),
            ),
        ]
    return []


# ── restore ────────────────────────────────────────────────────────────────


def restore_from_bak(
    project: str,
    *,
    step: int = 1,
) -> Dict[str, Any]:
    """
    Restore draft JSON từ .bak (step=1) hoặc .capcut-cli-history snaps nếu có.
    """
    path = resolve_draft_json_path(project)
    if step < 1:
        raise ValueError("step phải >= 1")

    if step == 1:
        bak = path.with_suffix(path.suffix + ".bak")
        if not bak.is_file():
            # try history step 1
            snaps = _list_history_snaps(path)
            if not snaps:
                raise FileNotFoundError(f"Không có file .bak: {bak}")
            src = Path(snaps[0]["path"])
        else:
            src = bak
    else:
        snaps = _list_history_snaps(path)
        if step > len(snaps):
            raise ValueError(
                f"Chỉ có {len(snaps)} snapshot lịch sử; step={step} không hợp lệ"
            )
        src = Path(snaps[step - 1]["path"])

    # backup current before restore
    if path.is_file():
        pre = path.with_suffix(path.suffix + ".pre-restore")
        shutil.copy2(path, pre)
    shutil.copy2(src, path)
    draft, _ = load_raw_draft(str(path))
    return {
        "ok": True,
        "path": str(path),
        "restored_from": str(src),
        "step": step,
        "summary": summarize(draft),
    }


def _list_history_snaps(json_path: Path) -> List[Dict[str, Any]]:
    """Newest-first history snaps under .capcut-cli-history (if present)."""
    hist = json_path.parent / ".capcut-cli-history"
    if not hist.is_dir():
        return []
    prefix = f"{json_path.name}."
    files = [
        f
        for f in hist.iterdir()
        if f.is_file() and f.name.startswith(prefix) and f.name.endswith(".snap")
    ]
    files.sort(key=lambda p: p.name, reverse=True)
    out = []
    for i, f in enumerate(files):
        out.append({"step": i + 1, "path": str(f), "name": f.name})
    return out


# ── register ───────────────────────────────────────────────────────────────


def register_draft(project: str, *, apply: bool = True) -> Dict[str, Any]:
    """
    Ghi draft_meta_info.json sidecar từ draft_content (meta repair).
    Không đụng root_meta_info nếu parent không có index (an toàn).
    """
    path = resolve_draft_json_path(project)
    draft, _ = load_raw_draft(str(path))
    proj = _project_dir(path if path.is_dir() else path)
    # if project was file, proj is parent
    if path.is_file():
        proj = path.parent

    draft_id = str(draft.get("id") or "")
    if not draft_id:
        raise ValueError('draft_content.json không có "id" — không invent id')

    name = str(draft.get("name") or proj.name)
    duration = int(draft.get("duration") or 0)
    meta_path = proj / "draft_meta_info.json"
    entry = {
        "draft_id": draft_id,
        "draft_name": name,
        "draft_fold_path": str(proj),
        "tm_duration": duration,
        "draft_root_path": str(proj),
        "draft_removable_storage_device": "",
        "draft_is_invisible": False,
    }

    actions: List[Dict[str, Any]] = []
    if meta_path.is_file():
        try:
            old = json.loads(meta_path.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError:
            old = {}
        stale = []
        if old.get("draft_id") != draft_id:
            stale.append("draft_id")
        if int(old.get("tm_duration") or 0) != duration:
            stale.append("tm_duration")
        actions.append(
            {
                "file": "draft_meta_info.json",
                "path": str(meta_path),
                "state": "stale" if stale else "ok",
                "action": "update" if stale else "none",
                "stale_fields": stale,
            }
        )
        if apply and stale:
            merged = {**old, **entry}
            if meta_path.is_file():
                shutil.copy2(meta_path, str(meta_path) + ".bak")
            meta_path.write_text(
                json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8"
            )
    else:
        actions.append(
            {
                "file": "draft_meta_info.json",
                "path": str(meta_path),
                "state": "missing",
                "action": "create" if apply else "none",
                "stale_fields": [],
            }
        )
        if apply:
            meta_path.write_text(
                json.dumps(entry, ensure_ascii=False, indent=2), encoding="utf-8"
            )

    parent = proj.parent
    root_idx = parent / "root_meta_info.json"
    root_action = {
        "file": "root_meta_info.json",
        "path": str(root_idx) if root_idx.is_file() else None,
        "state": "ok" if root_idx.is_file() else "unknown-store-root",
        "action": "none",
        "detail": (
            "Index parent tồn tại — không auto-merge (an toàn); "
            "dùng CapCut app hoặc init nếu cần."
            if root_idx.is_file()
            else "Không có root_meta_info.json trong parent — skip"
        ),
        "stale_fields": [],
    }
    actions.append(root_action)

    return {
        "ok": True,
        "project_dir": str(proj),
        "content_path": str(path),
        "draft_id": draft_id,
        "draft_name": name,
        "duration_us": duration,
        "applied": apply,
        "targets": actions,
    }


# ── sync-timelines ─────────────────────────────────────────────────────────


def sync_timelines(project: str) -> Dict[str, Any]:
    """
    Đồng bộ duration/id từ draft_content.json → draft_info.json (nếu có).
    """
    path = resolve_draft_json_path(project)
    proj = path.parent if path.is_file() else path
    content_p = proj / "draft_content.json"
    info_p = proj / "draft_info.json"

    if not content_p.is_file():
        # maybe project path is the content file with different name
        content_p = path
        info_p = path.parent / "draft_info.json"

    draft, cpath = load_raw_draft(str(content_p if content_p.is_file() else path))
    updates: List[str] = []

    if info_p.is_file():
        try:
            info = json.loads(info_p.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError as e:
            raise ValueError(f"draft_info.json không parse được: {e}") from e
        if not isinstance(info, dict):
            raise ValueError("draft_info.json root phải là object")

        changed = False
        for key in ("id", "duration", "fps", "name"):
            if key in draft and info.get(key) != draft.get(key):
                info[key] = draft.get(key)
                updates.append(key)
                changed = True
        # canvas
        if "canvas_config" in draft:
            if info.get("canvas_config") != draft.get("canvas_config"):
                info["canvas_config"] = deepcopy(draft.get("canvas_config"))
                updates.append("canvas_config")
                changed = True
        if changed:
            bak = info_p.with_suffix(info_p.suffix + ".bak")
            shutil.copy2(info_p, bak)
            info_p.write_text(
                json.dumps(info, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        return {
            "ok": True,
            "content_path": str(cpath),
            "info_path": str(info_p),
            "updated_fields": updates,
            "synced": bool(updates),
        }

    return {
        "ok": True,
        "content_path": str(cpath),
        "info_path": None,
        "updated_fields": [],
        "synced": False,
        "note": "Không có draft_info.json — chỉ draft_content",
    }


# ── diagnose ───────────────────────────────────────────────────────────────


def diagnose_project(project: str) -> Dict[str, Any]:
    p = Path(project).expanduser().resolve()
    notes: List[str] = []
    files: Dict[str, Any] = {}

    if not p.exists():
        raise FileNotFoundError(f"Không tìm thấy: {p}")

    proj = p if p.is_dir() else p.parent
    for name in (
        "draft_content.json",
        "draft_info.json",
        "draft_meta_info.json",
        "draft_content.json.bak",
        "template-2.tmp",
        "template.tmp",
    ):
        fp = proj / name
        files[name] = {
            "exists": fp.is_file(),
            "size": fp.stat().st_size if fp.is_file() else 0,
        }

    encryption = detect_encryption(str(proj / "draft_content.json") if (proj / "draft_content.json").is_file() else str(p))
    parse_ok = False
    summary: Dict[str, Any] = {}
    try:
        draft, path = load_raw_draft(str(p if p.is_file() else proj))
        parse_ok = True
        summary = summarize(draft)
        path_s = str(path)
    except Exception as e:  # noqa: BLE001 — diagnose reports all
        path_s = str(p)
        notes.append(f"load_raw_draft failed: {e}")

    version = None
    meta = proj / "draft_meta_info.json"
    if meta.is_file():
        try:
            mj = json.loads(meta.read_text(encoding="utf-8-sig"))
            version = mj.get("draft_enterprise_info") or mj.get("app_version") or mj.get(
                "tm_draft_cloud_last_action_download"
            )
        except json.JSONDecodeError:
            notes.append("draft_meta_info.json unreadable")

    return {
        "ok": parse_ok and not encryption.get("encrypted"),
        "project_dir": str(proj),
        "canonical_path": path_s,
        "files": files,
        "parse_ok": parse_ok,
        "encryption": encryption,
        "summary": summary,
        "version_hint": version,
        "notes": notes,
        "capcut_cli_required": False,
    }


# ── fixture ────────────────────────────────────────────────────────────────

_REDACTORS = [
    ("windows_user", re.compile(r"([A-Za-z]:\\Users\\)[^\\/\"<>:|?*]+"), r"\1USER"),
    ("windows_user_fwd", re.compile(r"([A-Za-z]:/Users/)[^/\"<>:|?*]+"), r"\1USER"),
    ("macos_user", re.compile(r"(/Users/)[^/\"]+"), r"\1USER"),
    ("linux_user", re.compile(r"(/home/)[^/\"]+"), r"\1USER"),
    (
        "email",
        re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
        "redacted@example.com",
    ),
]

_TIMELINE_FILES = (
    "draft_content.json",
    "draft_info.json",
    "draft_meta_info.json",
    "template-2.tmp",
    "template.tmp",
)


def export_fixture(project: str, out_dir: str) -> Dict[str, Any]:
    p = Path(project).expanduser().resolve()
    if not p.exists():
        raise FileNotFoundError(f"Không tìm thấy: {p}")
    proj = p if p.is_dir() else p.parent
    out = Path(out_dir).expanduser().resolve()
    out.mkdir(parents=True, exist_ok=True)

    tally: Dict[str, int] = {}
    files_out: List[Dict[str, Any]] = []
    for name in _TIMELINE_FILES:
        src = proj / name
        if not src.is_file():
            continue
        raw = src.read_text(encoding="utf-8-sig")
        text = raw
        count = 0
        for kind, pat, repl in _REDACTORS:
            matches = pat.findall(text)
            n = len(matches)
            if n:
                tally[kind] = tally.get(kind, 0) + n
                count += n
                text = pat.sub(repl, text)
        dest = out / name
        dest.write_text(text, encoding="utf-8")
        files_out.append(
            {
                "file": name,
                "bytes_in": len(raw.encode("utf-8")),
                "bytes_out": len(text.encode("utf-8")),
                "redactions": count,
            }
        )

    if not files_out:
        raise ValueError(f"Không có timeline JSON trong {proj}")

    diag = diagnose_project(str(proj))
    (out / "diagnose.json").write_text(
        json.dumps(diag, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (out / "README.md").write_text(
        "# Sanitized CapCut draft (capcut-mate fixture)\n\n"
        "Timeline JSON only, paths/emails redacted. **No** media assets.\n"
        "Pure Python — no capcut-cli.\n",
        encoding="utf-8",
    )

    return {
        "ok": True,
        "source_dir": str(proj),
        "out_dir": str(out),
        "files": files_out,
        "redaction_kinds": tally,
        "media_excluded": True,
    }


# ── decrypt (detect only) ──────────────────────────────────────────────────


def detect_encryption(file_path: str) -> Dict[str, Any]:
    p = Path(file_path).expanduser()
    if not p.exists():
        return {
            "encrypted": False,
            "file_path": str(p),
            "size": 0,
            "reason": "File không tồn tại",
            "fix": "Kiểm tra path; lưu project trong CapCut một lần",
        }
    if p.is_dir():
        cand = p / "draft_content.json"
        if cand.is_file():
            p = cand
        else:
            return {
                "encrypted": False,
                "file_path": str(p),
                "size": 0,
                "reason": "Thư mục không có draft_content.json",
                "fix": "Truyền file draft_content.json",
            }

    data = p.read_bytes()
    size = len(data)
    head = data[: min(256, size)].decode("utf-8", errors="replace").lstrip()
    if head.startswith("{"):
        try:
            json.loads(data.decode("utf-8-sig"))
            return {
                "encrypted": False,
                "file_path": str(p),
                "size": size,
                "reason": "Parse JSON OK — không mã hóa",
                "fix": "",
            }
        except json.JSONDecodeError as e:
            return {
                "encrypted": False,
                "file_path": str(p),
                "size": size,
                "reason": f"Bắt đầu '{{' nhưng JSON lỗi: {e}. Có thể corrupt.",
                "fix": "Mở+lưu trong CapCut hoặc restore từ .bak",
            }
    return {
        "encrypted": True,
        "file_path": str(p),
        "size": size,
        "reason": (
            "Không bắt đầu bằng '{' — có thể JianYing 6.0+ AES-encrypted"
        ),
        "fix": (
            "Mate/CLI không decrypt. Dùng CapCut International hoặc "
            "JianYing 5.9.x; xem pyJianYingDraft issues #142."
        ),
    }


# ── config ─────────────────────────────────────────────────────────────────


def get_config() -> Dict[str, Any]:
    return {
        "be": "capcut-mate",
        "python": sys.version.split()[0],
        "platform": platform.platform(),
        "cwd": str(Path.cwd()),
        "capcut_cli_required": False,
        "engines": {
            "mate": True,
            "local": True,
            "cli_bridge": False,
        },
        "env": {
            "ANTHROPIC_API_KEY": "set" if os.environ.get("ANTHROPIC_API_KEY") else "unset",
            "LOCALAPPDATA": os.environ.get("LOCALAPPDATA") or "",
            "PATH_has_ffmpeg": bool(_which("ffmpeg")),
        },
        "api_prefix": "/openapi/capcut-mate/v1",
        "local_prefix": "/openapi/capcut-mate/v1/local",
    }


# ── render (optional ffmpeg) ───────────────────────────────────────────────


def render_preview(
    project: str,
    *,
    out_path: Optional[str] = None,
    skip: bool = False,
) -> Dict[str, Any]:
    """
    Optional ffmpeg proxy. Default: report capability / 501-style skip.
    Không gọi capcut-cli.
    """
    if skip:
        return {
            "ok": False,
            "skipped": True,
            "status_code_hint": 501,
            "message": "render skipped (optional)",
        }
    ffmpeg = _which("ffmpeg")
    if not ffmpeg:
        return {
            "ok": False,
            "skipped": True,
            "status_code_hint": 501,
            "message": "ffmpeg không có — không render preview",
            "capcut_cli_required": False,
        }

    # Detect only for now — full timeline encode is large; return plan
    try:
        draft, path = load_raw_draft(project)
        summary = summarize(draft)
    except Exception as e:  # noqa: BLE001
        raise ValueError(str(e)) from e

    return {
        "ok": False,
        "skipped": True,
        "status_code_hint": 501,
        "message": (
            "ffmpeg found nhưng full timeline render chưa port "
            "(WAVE2 E: stub có chủ đích). Dùng Mate gen_video cho export."
        ),
        "ffmpeg": ffmpeg,
        "project_path": str(path),
        "summary": summary,
        "out_path": out_path,
    }


# ── batch ──────────────────────────────────────────────────────────────────

OpHandler = Callable[[Dict[str, Any], Dict[str, Any]], Any]


def _batch_handlers() -> Dict[str, OpHandler]:
    def speed(draft: Dict[str, Any], op: Dict[str, Any]) -> Any:
        return set_speed(draft, str(op["segment_id"]), float(op["speed"]))

    def volume(draft: Dict[str, Any], op: Dict[str, Any]) -> Any:
        return set_volume(draft, str(op["segment_id"]), float(op["volume"]))

    def opacity(draft: Dict[str, Any], op: Dict[str, Any]) -> Any:
        return set_opacity(draft, str(op["segment_id"]), float(op["alpha"]))

    def shift(draft: Dict[str, Any], op: Dict[str, Any]) -> Any:
        return shift_segment(draft, str(op["segment_id"]), int(op["offset_us"]))

    def trim(draft: Dict[str, Any], op: Dict[str, Any]) -> Any:
        return trim_segment(
            draft,
            str(op["segment_id"]),
            int(op["start_us"]),
            int(op["duration_us"]),
        )

    def keyframe(draft: Dict[str, Any], op: Dict[str, Any]) -> Any:
        return motion_eng.add_keyframe(
            draft,
            str(op["segment_id"]),
            str(op.get("property") or "KFTypePositionX"),
            int(op.get("offset_us") or 0),
            float(op.get("value") or 0),
        )

    def transition(draft: Dict[str, Any], op: Dict[str, Any]) -> Any:
        return motion_eng.add_transition(
            draft,
            str(op["segment_id"]),
            str(op.get("name") or "淡入淡出"),
            int(op.get("duration_us") or 500_000),
        )

    def mask(draft: Dict[str, Any], op: Dict[str, Any]) -> Any:
        return visual_eng.set_mask(
            draft,
            str(op["segment_id"]),
            name=str(op.get("name") or "圆形"),
            width=int(op.get("width") or 512),
            height=int(op.get("height") or 512),
            feather=float(op.get("feather") or 0),
            off=bool(op.get("off") or False),
        )

    def transform(draft: Dict[str, Any], op: Dict[str, Any]) -> Any:
        return visual_eng.set_transform(
            draft,
            str(op["segment_id"]),
            scale_x=op.get("scale_x"),
            scale_y=op.get("scale_y"),
            transform_x=op.get("transform_x"),
            transform_y=op.get("transform_y"),
            rotation=op.get("rotation"),
        )

    def set_text(draft: Dict[str, Any], op: Dict[str, Any]) -> Any:
        return content_eng.set_text(
            draft,
            str(op["text"]),
            segment_id=op.get("segment_id"),
            material_id=op.get("material_id"),
        )

    def add_text(draft: Dict[str, Any], op: Dict[str, Any]) -> Any:
        return content_eng.add_text(
            draft,
            str(op["text"]),
            int(op["start_us"]),
            int(op["duration_us"]),
            font_size=int(op.get("font_size") or 15),
        )

    def import_srt(draft: Dict[str, Any], op: Dict[str, Any]) -> Any:
        content = srt_eng.load_srt_source(
            srt=op.get("srt"), srt_path=op.get("srt_path")
        )
        n = srt_eng.import_srt_into_draft(
            draft, content, font_size=int(op.get("font_size") or 15)
        )
        return {"cues_added": n}

    return {
        "speed": speed,
        "volume": volume,
        "opacity": opacity,
        "shift": shift,
        "trim": trim,
        "keyframe": keyframe,
        "transition": transition,
        "mask": mask,
        "transform": transform,
        "set-text": set_text,
        "set_text": set_text,
        "add-text": add_text,
        "add_text": add_text,
        "import-srt": import_srt,
        "import_srt": import_srt,
    }


def run_batch(
    project: str,
    ops: List[Dict[str, Any]],
    *,
    dry_run: bool = False,
    stop_on_error: bool = True,
) -> Dict[str, Any]:
    if not ops:
        raise ValueError("ops rỗng — cần ít nhất 1 operation")
    draft, path = load_raw_draft(project)
    handlers = _batch_handlers()
    results: List[Dict[str, Any]] = []

    for i, op in enumerate(ops):
        if not isinstance(op, dict):
            raise ValueError(f"ops[{i}] phải là object")
        name = str(op.get("op") or op.get("action") or "").strip()
        if not name:
            raise ValueError(f"ops[{i}] thiếu field op")
        handler = handlers.get(name)
        if handler is None:
            entry = {
                "index": i,
                "op": name,
                "ok": False,
                "error": f"op không hỗ trợ trong batch: {name}",
            }
            results.append(entry)
            if stop_on_error:
                break
            continue
        try:
            out = handler(draft, op)
            results.append({"index": i, "op": name, "ok": True, "result": out})
        except (KeyError, ValueError, TypeError, FileNotFoundError) as e:
            results.append(
                {"index": i, "op": name, "ok": False, "error": str(e)}
            )
            if stop_on_error:
                break

    saved = False
    if not dry_run and any(r.get("ok") for r in results):
        # only save if at least one op ok and no hard stop mid-way with failures only
        if all(r.get("ok") for r in results) or any(r.get("ok") for r in results):
            # if stop_on_error and last failed, still save successful prefix
            if any(r.get("ok") for r in results):
                save_raw_draft(path, draft)
                saved = True

    return {
        "ok": all(r.get("ok") for r in results),
        "path": str(path),
        "dry_run": dry_run,
        "saved": saved,
        "results": results,
        "ops_count": len(ops),
    }


# ── compile (minimal) ──────────────────────────────────────────────────────


def _find_template() -> Path:
    here = Path(__file__).resolve()
    # engines/local -> engines -> capcut-mate
    root = here.parents[2]
    for rel in (
        "template/default2",
        "template/default",
    ):
        cand = root / rel
        if (cand / "draft_content.json").is_file() or (
            cand / "draft_info.json"
        ).is_file():
            return cand
    raise FileNotFoundError("Không tìm thấy template/default2 trong capcut-mate")


def compile_spec(
    spec: Dict[str, Any],
    out_dir: str,
    *,
    overwrite: bool = False,
) -> Dict[str, Any]:
    """
    Compile tối thiểu: copy template → add text items từ spec.tracks.
    Media path (video/audio) ghi warning — cần WAVE2 A add-video.
    """
    if not isinstance(spec, dict):
        raise ValueError("spec phải là object JSON")
    tracks = spec.get("tracks")
    if not isinstance(tracks, list):
        raise ValueError("spec.tracks phải là array")

    out = Path(out_dir).expanduser().resolve()
    if out.exists() and any(out.iterdir()) and not overwrite:
        raise ValueError(f"out_dir đã tồn tại và không rỗng: {out} (overwrite=false)")
    out.mkdir(parents=True, exist_ok=True)

    tmpl = _find_template()
    for item in tmpl.iterdir():
        if item.is_file():
            shutil.copy2(item, out / item.name)

    draft, path = load_raw_draft(str(out))
    warnings: List[str] = []
    refs: Dict[str, str] = {}
    seg_count = 0

    # canvas
    w = int(spec.get("width") or 1080)
    h = int(spec.get("height") or 1920)
    fps = int(spec.get("fps") or 30)
    draft["fps"] = fps
    cc = draft.get("canvas_config")
    if not isinstance(cc, dict):
        cc = {}
    cc["width"] = w
    cc["height"] = h
    if spec.get("ratio"):
        cc["ratio"] = spec["ratio"]
    draft["canvas_config"] = cc
    if spec.get("name"):
        draft["name"] = str(spec["name"])

    max_end = 0
    for ti, track in enumerate(tracks):
        if not isinstance(track, dict):
            warnings.append(f"tracks[{ti}] bỏ qua — không phải object")
            continue
        ttype = str(track.get("type") or "text")
        items = track.get("items") or []
        if not isinstance(items, list):
            continue
        for ii, it in enumerate(items):
            if not isinstance(it, dict):
                continue
            start_s = float(it.get("start") or 0)
            dur_s = float(it.get("duration") or 1)
            start_us = int(start_s * US)
            duration_us = int(dur_s * US)
            max_end = max(max_end, start_us + duration_us)

            if ttype == "text":
                text = str(it.get("text") or "")
                if not text:
                    warnings.append(f"tracks[{ti}].items[{ii}] text rỗng")
                    continue
                result = content_eng.add_text(
                    draft,
                    text,
                    start_us,
                    duration_us,
                    font_size=int(it.get("fontSize") or it.get("font_size") or 15),
                    color=it.get("color"),
                )
                seg_count += 1
                ref = it.get("ref")
                if ref and isinstance(result, dict):
                    seg = result.get("segment") or {}
                    if isinstance(seg, dict) and seg.get("id"):
                        refs[str(ref)] = str(seg["id"])
            else:
                warnings.append(
                    f"tracks[{ti}] type={ttype} item[{ii}]: "
                    "media local path chưa compile (cần /local/add-video WAVE2 A) — skip"
                )

    draft["duration"] = max(int(draft.get("duration") or 0), max_end)
    save_raw_draft(path, draft, backup=False)

    return {
        "ok": True,
        "name": str(spec.get("name") or out.name),
        "draft_path": str(out),
        "file_path": str(path),
        "tracks": len(list_tracks(draft)),
        "segments": seg_count,
        "duration_us": draft.get("duration"),
        "warnings": warnings,
        "refs": refs,
        "template": str(tmpl),
    }


# ── describe + port-matrix ─────────────────────────────────────────────────

WAVE1_DONE = [
    "info",
    "tracks",
    "segments",
    "speed",
    "volume",
    "opacity",
    "shift",
    "trim",
    "import-srt",
    "export-srt",
    "keyframe",
    "transition",
    "mask",
    "transform",
    "materials",
    "texts",
    "set-text",
    "add-text",
    "text-styles",
    "status",
]

WAVE2_E_DONE = [
    "lint",
    "lint-fix",
    "doctor",
    "restore",
    "register",
    "sync-timelines",
    "diagnose",
    "fixture",
    "batch",
    "compile",
    "describe",
    "port-matrix",
    "config",
    "render",
    "decrypt",
]

WAVE2_A = [
    "crop",
    "duplicate",
    "replace-media",
    "relink",
    "prune",
    "add-cover",
    "audio-fade",
    "add-video",
    "add-audio",
    "material",
    "segment",
]
WAVE2_B = [
    "bg-blur",
    "chroma",
    "mix-mode",
    "text-anim",
    "image-anim",
    "text-style",
    "bubble-text",
    "add-sfx",
    "add-filter",
    "add-effect",
    "add-sticker",
    "enums",
]
WAVE2_C = [
    "cut",
    "concat",
    "diff",
    "detect-scenes",
    "timeline",
    "projects",
    "shift-all",
    "version",
    "init",
    "quickstart",
]
WAVE2_D = [
    "import-ass",
    "text-ranges",
    "caption",
    "translate",
]

SKIP_501 = ["serve", "completions", "export-mac"]

MATE_NATIVE = [
    "create_draft",
    "save_draft",
    "get_draft",
    "add_videos",
    "add_images",
    "add_audios",
    "add_captions",
    "add_effects",
    "add_filters",
    "add_masks",
    "add_keyframes",
    "add_sticker",
    "gen_video",
    "gen_video_status",
]


def _router_mounted(module: str) -> bool:
    try:
        import importlib

        importlib.import_module(module)
        return True
    except Exception:  # noqa: BLE001
        return False


def describe_local_apis() -> Dict[str, Any]:
    waves: List[Tuple[str, List[str]]] = [
        ("1", WAVE1_DONE),
        ("2E", WAVE2_E_DONE),
        ("2A", WAVE2_A),
        ("2B", WAVE2_B),
        ("2C", WAVE2_C),
        ("2D", WAVE2_D),
    ]
    routes = []
    for wave, names in waves:
        for name in names:
            method = "GET" if name in ("status", "describe", "port-matrix") else "POST"
            routes.append(
                {
                    "method": method,
                    "path": f"/openapi/capcut-mate/v1/local/{name}",
                    "op": name,
                    "wave": wave,
                }
            )
    return {
        "ok": True,
        "capcut_cli_required": False,
        "engine": "local-python",
        "routes": routes,
        "count": len(routes),
    }


def port_matrix() -> Dict[str, Any]:
    """Full CLI→local map; A–D marked done when their router modules import."""
    groups = {
        "A-media": (WAVE2_A, "src.router.local_media_ops"),
        "B-fx": (WAVE2_B, "src.router.local_fx_ops"),
        "C-structure": (WAVE2_C, "src.router.local_structure_ops"),
        "D-caption": (WAVE2_D, "src.router.local_caption_ops"),
        "E-tools": (WAVE2_E_DONE, "src.router.local_tool_ops"),
    }
    done = set(WAVE1_DONE)
    todo: Dict[str, List[str]] = {}
    mounted: Dict[str, bool] = {}
    for label, (ops, mod) in groups.items():
        ok = _router_mounted(mod)
        mounted[label] = ok
        if ok:
            done.update(ops)
        else:
            todo[label] = list(ops)
    # WAVE1 always done via local_draft etc.
    mounted["wave1"] = True
    return {
        "ok": True,
        "capcut_cli_required": False,
        "be": "capcut-mate",
        "done": sorted(done),
        "done_count": len(done),
        "todo": todo,
        "todo_count": sum(len(v) for v in todo.values()),
        "mounted": mounted,
        "skip_501": SKIP_501,
        "mate_native_cover": MATE_NATIVE,
        "note": "Pure Python only — no capcut-cli",
    }
