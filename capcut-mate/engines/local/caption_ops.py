"""Caption nâng cao — ASS, text-ranges, export-srt word, Whisper caption, translate.

Pure Python trong capcut-mate. Cấm capcut-cli / Node.
Shared: load_raw_draft / save_raw_draft (router); srt helpers (import only).
"""

from __future__ import annotations

import json
import math
import os
import re
import shutil
import subprocess
import tempfile
import uuid
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .inspect import find_segment
from .srt import (
    _clear_text_track_segments,
    _ensure_text_track,
    _extract_plain_text,
    _minimal_text_material,
    _text_segment_json,
    _us_to_srt_ts,
    _utf16_len,
    export_srt_from_draft as _export_srt_line,
    import_srt_into_draft,
    parse_srt,
)

# ── ASS parser (port logic from capcut-cli/src/ass.ts) ──────────────

_ASS_TIME = re.compile(r"^(\d+):(\d{2}):(\d{2})[.,](\d{1,3})$")


def _ass_time_to_us(s: str) -> int:
    m = _ASS_TIME.match(s.strip())
    if not m:
        raise ValueError(f"ASS timestamp không hợp lệ: {s}")
    # centiseconds (2 digits) or ms (3 digits) — ASS uses cs
    frac = m.group(4).ljust(2, "0")[:2]
    cs = int(frac)
    ms = cs * 10
    h, mm, sec = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return ((h * 3600 + mm * 60 + sec) * 1000 + ms) * 1000


def _strip_ass_overrides(raw: str) -> str:
    return (
        re.sub(r"\{[^}]*\}", "", raw)
        .replace("\\N", "\n")
        .replace("\\n", "\n")
        .replace("\\h", " ")
        .strip()
    )


def parse_ass(content: str) -> List[Dict[str, Any]]:
    """Parse ASS/SSA → list of {start_us, end_us, text, style?}."""
    content = content.lstrip("\ufeff").replace("\r\n", "\n").replace("\r", "\n")
    lines = content.split("\n")
    in_events = False
    fmt: Optional[List[str]] = None
    cues: List[Dict[str, Any]] = []
    idx = 0

    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        if line.startswith("["):
            in_events = bool(re.match(r"^\[events\]", line, re.I))
            continue
        if not in_events:
            continue
        if re.match(r"^Format\s*:", line, re.I):
            fmt = [
                p.strip().lower()
                for p in line.split(":", 1)[1].split(",")
            ]
            continue
        if not re.match(r"^Dialogue\s*:", line, re.I):
            continue
        if not fmt:
            fmt = [
                "layer",
                "start",
                "end",
                "style",
                "name",
                "marginl",
                "marginr",
                "marginv",
                "effect",
                "text",
            ]
        rest = line.split(":", 1)[1].strip()
        start_col = fmt.index("start") if "start" in fmt else -1
        end_col = fmt.index("end") if "end" in fmt else -1
        text_col = fmt.index("text") if "text" in fmt else -1
        style_col = fmt.index("style") if "style" in fmt else -1
        if start_col < 0 or end_col < 0 or text_col < 0:
            raise ValueError(
                f"ASS Format thiếu cột start/end/text: {','.join(fmt)}"
            )

        # Split: last column absorbs remaining commas
        parts: List[str] = []
        cur = ""
        col = 0
        for ch in rest:
            if ch == "," and col < len(fmt) - 1:
                parts.append(cur)
                cur = ""
                col += 1
            else:
                cur += ch
        parts.append(cur)
        if len(parts) < len(fmt):
            continue

        try:
            start_us = _ass_time_to_us(parts[start_col])
            end_us = _ass_time_to_us(parts[end_col])
        except ValueError:
            continue
        if end_us <= start_us:
            continue
        text = _strip_ass_overrides(parts[text_col])
        if not text:
            continue
        idx += 1
        cues.append(
            {
                "index": idx,
                "start_us": start_us,
                "end_us": end_us,
                "text": text,
                "style": parts[style_col].strip() if style_col >= 0 else None,
            }
        )
    return cues


def load_ass_source(*, ass: Optional[str] = None, ass_path: Optional[str] = None) -> str:
    if ass is not None and str(ass).strip():
        return str(ass)
    if ass_path:
        path = Path(ass_path).expanduser()
        if not path.is_file():
            raise FileNotFoundError(f"Không tìm thấy file ASS: {path}")
        return path.read_text(encoding="utf-8-sig")
    raise ValueError("Cần ass (string) hoặc ass_path")


def import_ass_into_draft(
    draft: Dict[str, Any],
    ass_content: str,
    *,
    font_size: float = 5.0,
    time_offset_us: int = 0,
    transform_y: float = -0.8,
    replace: bool = False,
) -> int:
    """Parse ASS and add subtitle segments (same material schema as import-srt)."""
    cues = parse_ass(ass_content)
    if not cues:
        raise ValueError("ASS rỗng hoặc không parse được Dialogue nào")

    materials = draft.setdefault("materials", {})
    if not isinstance(materials, dict):
        raise ValueError("draft.materials phải là object")
    texts: List[Dict[str, Any]] = materials.setdefault("texts", [])
    if not isinstance(texts, list):
        materials["texts"] = []
        texts = materials["texts"]

    track = _ensure_text_track(draft, name="subtitle")
    if replace:
        _clear_text_track_segments(draft, track)

    segs: List[Dict[str, Any]] = track.setdefault("segments", [])
    if not isinstance(segs, list):
        track["segments"] = []
        segs = track["segments"]

    added = 0
    max_end = int(draft.get("duration") or 0)
    for cue in cues:
        start = int(cue["start_us"]) + int(time_offset_us)
        end = int(cue["end_us"]) + int(time_offset_us)
        if end <= start:
            continue
        text = str(cue["text"])
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
        raise ValueError("ASS không có cue hợp lệ sau khi lọc")
    draft["duration"] = max(int(draft.get("duration") or 0), max_end)
    return added


# ── text-ranges (multi style on one material) ───────────────────────


def _hex_to_rgb01(hex_color: str) -> List[float]:
    h = (hex_color or "").strip().lstrip("#")
    if len(h) != 6:
        return [1.0, 1.0, 1.0]
    try:
        return [
            int(h[0:2], 16) / 255.0,
            int(h[2:4], 16) / 255.0,
            int(h[4:6], 16) / 255.0,
        ]
    except ValueError:
        return [1.0, 1.0, 1.0]


def _parse_content(mat: Dict[str, Any]) -> Dict[str, Any]:
    content = mat.get("content")
    if isinstance(content, dict):
        return content
    if isinstance(content, str) and content.strip().startswith("{"):
        try:
            obj = json.loads(content)
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            pass
    text = _extract_plain_text(mat) if content else str(content or "")
    return {"text": text, "styles": []}


def set_text_ranges(
    draft: Dict[str, Any],
    ranges: List[Dict[str, Any]],
    *,
    segment_id: Optional[str] = None,
    material_id: Optional[str] = None,
    range_unit: str = "code_unit",
) -> Dict[str, Any]:
    """Apply multi style ranges to a text material.

    ``ranges`` items:
      start, end (int, half-open), font_color?, font_size?, font_alpha?,
      bold?, italic?, underline?

    ``range_unit``:
      - ``code_unit`` (default): indices like Python ``len`` / JS string length;
        stored as UTF-16 code units (matches hardened import-srt).
      - ``byte``: convert code-unit indices → UTF-16-LE byte offsets for storage
        (CLI decorators.ts parity).
    """
    if not ranges:
        raise ValueError("Cần ít nhất một range trong styles/ranges")

    mid = material_id
    if segment_id:
        seg = find_segment(draft, segment_id)
        if seg is None:
            raise KeyError(f"segment_id không tồn tại: {segment_id}")
        mid = seg.get("material_id") or mid
    if not mid:
        raise ValueError("Cần segment_id hoặc material_id")

    materials = draft.setdefault("materials", {})
    texts: List[Dict[str, Any]] = materials.setdefault("texts", [])
    mat = next((t for t in texts if isinstance(t, dict) and t.get("id") == mid), None)
    if mat is None:
        raise KeyError(f"material_id không tồn tại: {mid}")

    content = _parse_content(mat)
    full = str(content.get("text") or "")
    max_cu = len(full)  # Python str length ≈ UTF-16 code units for BMP

    # Normalize + validate ranges (input always in code-unit indices)
    sorted_ranges = sorted(ranges, key=lambda r: int(r.get("start", 0)))
    for r in sorted_ranges:
        try:
            start = int(r["start"])
            end = int(r["end"])
        except (KeyError, TypeError, ValueError) as e:
            raise ValueError(f"range cần start/end integer: {r}") from e
        if start < 0 or end > max_cu:
            raise ValueError(
                f"range [{start},{end}) ngoài bounds (text length={max_cu})"
            )
        if end <= start:
            raise ValueError(f"range [{start},{end}) phải end > start")
        r["_s"], r["_e"] = start, end

    for i in range(1, len(sorted_ranges)):
        if sorted_ranges[i]["_s"] < sorted_ranges[i - 1]["_e"]:
            a, b = sorted_ranges[i - 1], sorted_ranges[i]
            raise ValueError(
                f"ranges chồng chéo: [{a['_s']},{a['_e']}) và [{b['_s']},{b['_e']})"
            )

    base_styles = content.get("styles") if isinstance(content.get("styles"), list) else []
    base = base_styles[0] if base_styles and isinstance(base_styles[0], dict) else {}
    base_fill = (
        ((base.get("fill") or {}).get("content") or {}).get("solid") or {}
        if isinstance(base.get("fill"), dict)
        else {}
    )
    default_color = base_fill.get("color") or [1.0, 1.0, 1.0]
    default_alpha = float(base_fill.get("alpha") if base_fill.get("alpha") is not None else 1.0)
    default_size = float(base.get("size") if base.get("size") is not None else 15)
    default_bold = bool(base.get("bold") or False)
    default_italic = bool(base.get("italic") or False)
    default_underline = bool(base.get("underline") or False)

    use_bytes = range_unit == "byte"

    def to_stored(cu: int) -> int:
        if use_bytes:
            # UTF-16-LE byte offset for first `cu` code units
            return len(full[:cu].encode("utf-16-le"))
        return cu

    stored_len = to_stored(max_cu)

    def make_style(cu_start: int, cu_end: int, r: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        color = (
            _hex_to_rgb01(str(r["font_color"]))
            if r and r.get("font_color")
            else list(default_color)
        )
        alpha = float(r["font_alpha"]) if r and r.get("font_alpha") is not None else default_alpha
        size = float(r["font_size"]) if r and r.get("font_size") is not None else default_size
        return {
            "range": [to_stored(cu_start), to_stored(cu_end)],
            "size": size,
            "bold": bool(r["bold"]) if r and r.get("bold") is not None else default_bold,
            "italic": bool(r["italic"]) if r and r.get("italic") is not None else default_italic,
            "underline": bool(r["underline"]) if r and r.get("underline") is not None else default_underline,
            "fill": {
                "alpha": 1.0,
                "content": {
                    "render_type": "solid",
                    "solid": {"alpha": alpha, "color": color},
                },
            },
            "strokes": [],
        }

    styles: List[Dict[str, Any]] = []
    cursor = 0
    for r in sorted_ranges:
        s, e = r["_s"], r["_e"]
        if s > cursor:
            styles.append(make_style(cursor, s))
        styles.append(make_style(s, e, r))
        cursor = e
    if cursor < max_cu:
        styles.append(make_style(cursor, max_cu))
    if not styles and max_cu > 0:
        styles.append(make_style(0, max_cu))

    content["styles"] = styles
    content["text"] = full
    mat["content"] = json.dumps(content, ensure_ascii=False)

    return {
        "segment_id": segment_id,
        "material_id": mid,
        "styles": len(styles),
        "text_length": max_cu,
        "stored_range_end": stored_len,
        "range_unit": range_unit,
        "text": full,
    }


# ── export-srt (line | word) ────────────────────────────────────────


def _tokenize_words(text: str) -> List[str]:
    # Keep non-space runs (works for CJK continuous + Latin spaced)
    parts = re.findall(r"\S+", text.strip())
    return parts if parts else ([text] if text else [])


def _interpolate_word_times(
    text: str, start_us: int, end_us: int
) -> List[Tuple[str, int, int]]:
    words = _tokenize_words(text)
    if not words:
        return []
    total_chars = sum(len(w) for w in words) or 1
    dur = max(1, int(end_us) - int(start_us))
    out: List[Tuple[str, int, int]] = []
    cursor = int(start_us)
    seen = 0
    for i, w in enumerate(words):
        seen += len(w)
        if i == len(words) - 1:
            w_end = int(end_us)
        else:
            w_end = int(start_us) + int(dur * seen / total_chars)
        w_end = max(cursor + 1, w_end)
        out.append((w, cursor, w_end))
        cursor = w_end
    return out


def export_srt_from_draft(
    draft: Dict[str, Any],
    *,
    granularity: str = "line",
) -> Dict[str, Any]:
    """Export text tracks to SRT.

    granularity:
      - line: one cue per segment (default)
      - word: split each segment into per-word cues (interpolated timing)
    """
    g = (granularity or "line").lower().strip()
    if g not in ("line", "word"):
        raise ValueError("granularity phải là 'line' hoặc 'word'")

    if g == "line":
        srt = _export_srt_line(draft)
        cues = parse_srt(srt) if srt.strip() else []
        return {
            "srt": srt,
            "cue_count": len(cues),
            "granularity": "line",
        }

    materials = draft.get("materials") or {}
    texts = {
        t.get("id"): t
        for t in (materials.get("texts") or [])
        if isinstance(t, dict) and t.get("id")
    }
    word_cues: List[Tuple[int, int, str]] = []
    for t in draft.get("tracks") or []:
        if not isinstance(t, dict) or t.get("type") != "text":
            continue
        for s in t.get("segments") or []:
            if not isinstance(s, dict):
                continue
            tr = s.get("target_timerange") or {}
            start = int(tr.get("start") or 0)
            dur = int(tr.get("duration") or 0)
            end = start + max(dur, 1)
            mat = texts.get(s.get("material_id")) or {}
            plain = _extract_plain_text(mat)
            if not plain:
                continue
            for word, ws, we in _interpolate_word_times(plain, start, end):
                word_cues.append((ws, we, word))

    word_cues.sort(key=lambda x: (x[0], x[1]))
    lines: List[str] = []
    for i, (start, end, text) in enumerate(word_cues, 1):
        lines.append(str(i))
        lines.append(f"{_us_to_srt_ts(start)} --> {_us_to_srt_ts(end)}")
        lines.append(text)
        lines.append("")
    srt = "\n".join(lines).strip() + ("\n" if word_cues else "")
    return {
        "srt": srt,
        "cue_count": len(word_cues),
        "granularity": "word",
    }


# ── caption (Whisper) ───────────────────────────────────────────────


class CaptionUnavailableError(RuntimeError):
    """Whisper not installed / failed — map to HTTP 503."""


def _resolve_audio_path(
    draft: Dict[str, Any],
    *,
    audio: Optional[str] = None,
    from_segment: Optional[str] = None,
) -> str:
    if audio:
        p = Path(audio).expanduser()
        if not p.is_file():
            raise FileNotFoundError(f"Không tìm thấy file audio: {p}")
        return str(p.resolve())

    if from_segment:
        seg = find_segment(draft, from_segment)
        if seg is None:
            raise KeyError(f"segment_id không tồn tại: {from_segment}")
        # find track type
        track_type = None
        for t in draft.get("tracks") or []:
            if not isinstance(t, dict):
                continue
            for s in t.get("segments") or []:
                if isinstance(s, dict) and s.get("id") == from_segment:
                    track_type = t.get("type")
                    break
        if track_type and track_type not in ("audio", "video"):
            raise ValueError(
                f"from_segment phải thuộc track audio/video (got {track_type})"
            )
        mid = seg.get("material_id")
        materials = draft.get("materials") or {}
        path = None
        for key in ("audios", "videos"):
            for m in materials.get(key) or []:
                if isinstance(m, dict) and m.get("id") == mid:
                    path = m.get("path") or m.get("material_url") or m.get("file_Path")
                    break
            if path:
                break
        if not path:
            raise ValueError(f"Segment {from_segment} không có path audio trên material")
        p = Path(str(path)).expanduser()
        if not p.is_file():
            raise FileNotFoundError(f"Material path không tồn tại: {p}")
        return str(p.resolve())

    raise ValueError("Cần audio (path) hoặc from_segment")


def _run_whisper_binary(
    audio: str,
    *,
    whisper_cmd: str = "whisper",
    model: str = "base",
    language: str = "auto",
    timeout_s: int = 300,
) -> str:
    """Run openai-whisper CLI → return SRT string."""
    cmd = whisper_cmd or "whisper"
    if not shutil.which(cmd) and not Path(cmd).is_file():
        raise CaptionUnavailableError(
            f"Không tìm thấy binary whisper: '{cmd}'. "
            "Cài: pip install openai-whisper  hoặc  faster-whisper; "
            "hoặc đặt whisper_cmd trỏ tới executable. "
            "Không dùng capcut-cli."
        )
    tmp = tempfile.mkdtemp(prefix="capcut-caption-")
    try:
        args = [
            cmd,
            audio,
            "--model",
            model,
            "--output_format",
            "srt",
            "--output_dir",
            tmp,
        ]
        if language and language != "auto":
            args.extend(["--language", language])
        try:
            r = subprocess.run(
                args,
                capture_output=True,
                text=True,
                timeout=timeout_s,
                check=False,
            )
        except FileNotFoundError as e:
            raise CaptionUnavailableError(
                f"Không chạy được whisper: {e}. Cài openai-whisper hoặc chỉ định whisper_cmd."
            ) from e
        except subprocess.TimeoutExpired as e:
            raise CaptionUnavailableError(f"Whisper timeout sau {timeout_s}s") from e

        if r.returncode != 0:
            err = (r.stderr or r.stdout or "")[:800]
            raise CaptionUnavailableError(
                f"Whisper exit {r.returncode}: {err}\ncmd: {' '.join(args)}"
            )

        srts = list(Path(tmp).glob("*.srt"))
        if not srts:
            raise CaptionUnavailableError(
                f"Whisper xong nhưng không có file .srt. stdout: {(r.stdout or '')[:200]}"
            )
        return srts[0].read_text(encoding="utf-8-sig")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def _run_faster_whisper_python(
    audio: str,
    *,
    model: str = "base",
    language: Optional[str] = None,
) -> str:
    """Try faster-whisper Python API → SRT string."""
    try:
        from faster_whisper import WhisperModel  # type: ignore
    except ImportError as e:
        raise CaptionUnavailableError(
            "faster-whisper chưa cài (pip install faster-whisper). "
            "Hoặc dùng whisper binary / openai-whisper."
        ) from e

    lang = None if not language or language == "auto" else language
    wm = WhisperModel(model, device="cpu", compute_type="int8")
    segments, _info = wm.transcribe(audio, language=lang)
    lines: List[str] = []
    i = 0
    for seg in segments:
        i += 1
        start_us = int(float(seg.start) * 1_000_000)
        end_us = int(float(seg.end) * 1_000_000)
        text = (seg.text or "").strip()
        if not text or end_us <= start_us:
            continue
        lines.append(str(i))
        lines.append(f"{_us_to_srt_ts(start_us)} --> {_us_to_srt_ts(end_us)}")
        lines.append(text)
        lines.append("")
    if not lines:
        raise ValueError("Whisper không tạo được cue (audio im lặng hoặc model lỗi)")
    return "\n".join(lines)


def _run_openai_whisper_python(
    audio: str,
    *,
    model: str = "base",
    language: Optional[str] = None,
) -> str:
    try:
        import whisper  # type: ignore
    except ImportError as e:
        raise CaptionUnavailableError(
            "openai-whisper chưa cài (pip install openai-whisper)."
        ) from e

    m = whisper.load_model(model)
    kw: Dict[str, Any] = {}
    if language and language != "auto":
        kw["language"] = language
    result = m.transcribe(audio, **kw)
    lines: List[str] = []
    for i, seg in enumerate(result.get("segments") or [], 1):
        start_us = int(float(seg["start"]) * 1_000_000)
        end_us = int(float(seg["end"]) * 1_000_000)
        text = str(seg.get("text") or "").strip()
        if not text or end_us <= start_us:
            continue
        lines.append(str(i))
        lines.append(f"{_us_to_srt_ts(start_us)} --> {_us_to_srt_ts(end_us)}")
        lines.append(text)
        lines.append("")
    if not lines:
        raise ValueError("Whisper không tạo được cue")
    return "\n".join(lines)


def caption_draft(
    draft: Dict[str, Any],
    *,
    audio: Optional[str] = None,
    from_segment: Optional[str] = None,
    whisper_cmd: Optional[str] = None,
    whisper_model: str = "base",
    language: str = "auto",
    engine: str = "auto",
    font_size: float = 5.0,
    replace: bool = False,
    transform_y: float = -0.8,
) -> Dict[str, Any]:
    """Transcribe audio → import SRT cues into draft.

    engine: auto | faster-whisper | openai-whisper | binary
    Raises CaptionUnavailableError if no whisper available (→ HTTP 503).
    """
    audio_path = _resolve_audio_path(
        draft, audio=audio, from_segment=from_segment
    )
    eng = (engine or "auto").lower().strip()
    srt_text: Optional[str] = None
    used = eng
    errors: List[str] = []

    def try_fw() -> Optional[str]:
        return _run_faster_whisper_python(
            audio_path, model=whisper_model, language=language
        )

    def try_ow() -> Optional[str]:
        return _run_openai_whisper_python(
            audio_path, model=whisper_model, language=language
        )

    def try_bin() -> Optional[str]:
        return _run_whisper_binary(
            audio_path,
            whisper_cmd=whisper_cmd or "whisper",
            model=whisper_model,
            language=language,
        )

    order: List[Tuple[str, Any]]
    if eng == "faster-whisper":
        order = [("faster-whisper", try_fw)]
    elif eng in ("openai-whisper", "openai"):
        order = [("openai-whisper", try_ow)]
    elif eng in ("binary", "shell", "whisper-cli"):
        order = [("binary", try_bin)]
    else:
        order = [
            ("faster-whisper", try_fw),
            ("openai-whisper", try_ow),
            ("binary", try_bin),
        ]

    for name, fn in order:
        try:
            srt_text = fn()
            used = name
            break
        except CaptionUnavailableError as e:
            errors.append(f"{name}: {e}")
        except Exception as e:  # noqa: BLE001 — try next engine
            errors.append(f"{name}: {e}")

    if not srt_text:
        raise CaptionUnavailableError(
            "Không chạy được Whisper. "
            + " | ".join(errors)
            + " — Cài: pip install faster-whisper  hoặc  openai-whisper; "
            "hoặc cài binary `whisper` và truyền whisper_cmd."
        )

    n = import_srt_into_draft(
        draft,
        srt_text,
        font_size=font_size,
        transform_y=transform_y,
        replace=replace,
    )
    cues = parse_srt(srt_text)
    return {
        "cues_added": n,
        "engine": used,
        "source_audio": audio_path,
        "language": language,
        "first_cue": (
            {"start_us": cues[0][0], "text": cues[0][2]} if cues else None
        ),
        "last_cue": (
            {"start_us": cues[-1][0], "text": cues[-1][2]} if cues else None
        ),
    }


# ── translate (optional Anthropic) ──────────────────────────────────


class TranslateUnavailableError(RuntimeError):
    """No API key / HTTP failure — map carefully."""


def _collect_text_materials(
    draft: Dict[str, Any],
) -> List[Tuple[str, str]]:
    materials = draft.get("materials") or {}
    out: List[Tuple[str, str]] = []
    for mat in materials.get("texts") or []:
        if not isinstance(mat, dict) or not mat.get("id"):
            continue
        plain = _extract_plain_text(mat).strip()
        if plain:
            out.append((str(mat["id"]), plain))
    return out


def _apply_translated_text(mat: Dict[str, Any], new_text: str) -> None:
    content = _parse_content(mat)
    old = str(content.get("text") or "")
    styles = content.get("styles") if isinstance(content.get("styles"), list) else []
    # Rescale ranges proportional (code units)
    old_len = len(old)
    new_len = len(new_text)
    new_styles: List[Dict[str, Any]] = []
    if styles and old_len > 0 and new_len > 0:
        for st in styles:
            if not isinstance(st, dict):
                continue
            st = deepcopy(st)
            rng = st.get("range")
            if not (isinstance(rng, (list, tuple)) and len(rng) >= 2):
                continue
            s = max(0, min(new_len, math.ceil(int(rng[0]) / old_len * new_len)))
            e = max(0, min(new_len, math.ceil(int(rng[1]) / old_len * new_len)))
            if s > e:
                s, e = e, s
            st["range"] = [s, e]
            if s != e:
                new_styles.append(st)
    if not new_styles and new_len > 0:
        new_styles = [
            {
                "fill": {
                    "alpha": 1.0,
                    "content": {
                        "render_type": "solid",
                        "solid": {"alpha": 1.0, "color": [1.0, 1.0, 1.0]},
                    },
                },
                "range": [0, _utf16_len(new_text)],
                "size": float(mat.get("font_size") or 5),
                "bold": False,
                "italic": False,
                "underline": False,
                "strokes": [],
            }
        ]
    content["text"] = new_text
    content["styles"] = new_styles
    mat["content"] = json.dumps(content, ensure_ascii=False)


def _call_anthropic_batch(
    api_key: str,
    model: str,
    texts: List[str],
    to_lang: str,
    from_lang: str,
) -> List[str]:
    import urllib.error
    import urllib.request

    prompt = (
        f"Translate the following {len(texts)} text strings from {from_lang} to {to_lang}.\n"
        "Preserve line breaks and punctuation. Do not add commentary, only translations.\n"
        f"Output a JSON array of {len(texts)} strings, same order as input. "
        "No markdown fences, just JSON.\n\n"
        f"Input strings (JSON array):\n{json.dumps(texts, ensure_ascii=False)}"
    )
    body = json.dumps(
        {
            "model": model,
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": prompt}],
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:500]
        raise TranslateUnavailableError(f"Anthropic API {e.code}: {detail}") from e
    except Exception as e:  # noqa: BLE001
        raise TranslateUnavailableError(f"Anthropic request failed: {e}") from e

    parts = data.get("content") or []
    text = ""
    for p in parts:
        if isinstance(p, dict) and p.get("type") == "text":
            text = str(p.get("text") or "")
            break
    clean = re.sub(r"^```(?:json)?\s*", "", text.strip())
    clean = re.sub(r"```\s*$", "", clean).strip()
    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError as e:
        raise TranslateUnavailableError(
            f"Model output không phải JSON array: {clean[:300]}"
        ) from e
    if not isinstance(parsed, list):
        raise TranslateUnavailableError(f"Expected JSON array, got {type(parsed)}")
    return [x if isinstance(x, str) else str(x) for x in parsed]


def translate_draft(
    draft: Dict[str, Any],
    *,
    to_lang: str,
    from_lang: str = "auto",
    out_path: Optional[str] = None,
    api_key: Optional[str] = None,
    model: str = "claude-haiku-4-5-20251001",
    dry_run: bool = False,
) -> Dict[str, Any]:
    """Clone draft texts → translate via Anthropic (optional).

    Writes translated draft to ``out_path`` (required unless dry_run with
    in-place skip). Original project file is never overwritten by this function
    — caller passes a clone; we mutate the given draft dict.
    """
    if not to_lang or not str(to_lang).strip():
        raise ValueError("Cần to (ngôn ngữ đích)")

    collected = _collect_text_materials(draft)
    pairs: List[Dict[str, str]] = []

    if dry_run or not collected:
        for mid, original in collected:
            pairs.append({"id": mid, "original": original, "translated": original})
        result_path = None
        if out_path:
            result_path = _write_draft_copy(draft, out_path)
        return {
            "count": len(collected),
            "to": to_lang,
            "from": from_lang,
            "out": result_path,
            "pairs": pairs,
            "dry_run": True,
        }

    key = api_key or os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_KEY")
    if not key:
        raise TranslateUnavailableError(
            "Thiếu ANTHROPIC_API_KEY (env) hoặc api_key trong body. "
            "Dùng dry_run=true để xem danh sách text không gọi API. "
            "https://console.anthropic.com/"
        )

    translations = _call_anthropic_batch(
        key, model, [c[1] for c in collected], to_lang, from_lang
    )
    texts = (draft.get("materials") or {}).get("texts") or []
    by_id = {t.get("id"): t for t in texts if isinstance(t, dict)}

    for i, (mid, original) in enumerate(collected):
        translated = translations[i] if i < len(translations) else original
        mat = by_id.get(mid)
        if mat is not None:
            _apply_translated_text(mat, translated)
        pairs.append({"id": mid, "original": original, "translated": translated})

    result_path = None
    if out_path:
        result_path = _write_draft_copy(draft, out_path)

    return {
        "count": len(pairs),
        "to": to_lang,
        "from": from_lang,
        "out": result_path,
        "pairs": pairs,
        "dry_run": False,
        "model": model,
    }


def _write_draft_copy(draft: Dict[str, Any], out_path: str) -> str:
    path = Path(out_path).expanduser()
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.suffix.lower() == ".json":
        path.write_text(
            json.dumps(draft, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return str(path.resolve())
    # Treat as project folder
    path.mkdir(parents=True, exist_ok=True)
    dest = path / "draft_content.json"
    dest.write_text(
        json.dumps(draft, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return str(dest.resolve())
