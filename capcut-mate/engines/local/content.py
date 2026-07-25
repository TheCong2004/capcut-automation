"""Materials / texts / set-text / add-text — pure Python (Grok D).

Parses CapCut material ``content`` JSON:
  ``{"text": "...", "styles": [{"range": [start, end], "size": ..., "fill": ...}, ...]}``

When text length changes, style ranges are rescaled proportionally
(same approach as pyJianYingDraft ``ScriptFile.replace_text``).
"""

from __future__ import annotations

import json
import math
import uuid
from copy import deepcopy
from typing import Any, Dict, List, Optional

from .inspect import find_segment
from .srt import _ensure_text_track


# ── content JSON helpers ───────────────────────────────────────────


def parse_content_obj(content: Any) -> Optional[Dict[str, Any]]:
    """Parse material.content into a dict with text/styles, or None if plain string."""
    if content is None:
        return None
    if isinstance(content, dict):
        return content
    if not isinstance(content, str):
        return None
    s = content.strip()
    if not s.startswith("{"):
        return None
    try:
        obj = json.loads(s)
    except (json.JSONDecodeError, TypeError):
        return None
    return obj if isinstance(obj, dict) else None


def extract_plain_text(mat: Dict[str, Any]) -> str:
    """Plain text from material (content JSON or raw string)."""
    obj = parse_content_obj(mat.get("content"))
    if obj is not None and "text" in obj:
        return str(obj.get("text") or "")
    content = mat.get("content")
    if isinstance(content, str):
        return content
    return str(mat.get("text") or "")


def extract_styles(mat: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return style entries (shallow copies) from content JSON."""
    obj = parse_content_obj(mat.get("content"))
    if not obj:
        return []
    styles = obj.get("styles")
    if not isinstance(styles, list):
        return []
    return [deepcopy(s) for s in styles if isinstance(s, dict)]


def summarize_styles(styles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Compact style view for list APIs (range, size, color)."""
    out: List[Dict[str, Any]] = []
    for st in styles:
        rng = st.get("range")
        if not (isinstance(rng, (list, tuple)) and len(rng) >= 2):
            rng = None
        color = _style_color_rgb(st)
        out.append(
            {
                "range": [int(rng[0]), int(rng[1])] if rng is not None else None,
                "size": st.get("size"),
                "color": color,
                "bold": st.get("bold"),
                "italic": st.get("italic"),
                "underline": st.get("underline"),
            }
        )
    return out


def _style_color_rgb(style: Dict[str, Any]) -> Optional[List[float]]:
    fill = style.get("fill")
    if not isinstance(fill, dict):
        return None
    content = fill.get("content")
    if not isinstance(content, dict):
        return None
    solid = content.get("solid")
    if not isinstance(solid, dict):
        return None
    color = solid.get("color")
    if isinstance(color, list) and len(color) >= 3:
        return [float(color[0]), float(color[1]), float(color[2])]
    return None


def recalc_style_ranges(
    styles: List[Dict[str, Any]],
    old_len: int,
    new_len: int,
) -> List[Dict[str, Any]]:
    """Rescale style ranges when text length changes.

    Mirrors pyJianYingDraft ScriptFile.replace_text proportional mapping.
    Drops zero-width ranges. Empty old_len → single style covering full new text.
    """
    if not styles:
        return []

    if old_len <= 0:
        # Cannot proportion — collapse to first style over full span
        base = deepcopy(styles[0])
        base["range"] = [0, max(new_len, 0)]
        return [base] if new_len > 0 else []

    if new_len <= 0:
        return []

    if old_len == new_len:
        # Still clamp ranges into [0, new_len]
        out: List[Dict[str, Any]] = []
        for style in styles:
            st = deepcopy(style)
            rng = st.get("range")
            if not (isinstance(rng, (list, tuple)) and len(rng) >= 2):
                continue
            start = max(0, min(int(rng[0]), new_len))
            end = max(0, min(int(rng[1]), new_len))
            if start > end:
                start, end = end, start
            st["range"] = [start, end]
            if start != end:
                out.append(st)
        return out

    new_styles: List[Dict[str, Any]] = []
    for style in styles:
        st = deepcopy(style)
        rng = st.get("range")
        if not (isinstance(rng, (list, tuple)) and len(rng) >= 2):
            continue
        start = math.ceil(int(rng[0]) / old_len * new_len)
        end = math.ceil(int(rng[1]) / old_len * new_len)
        start = max(0, min(start, new_len))
        end = max(0, min(end, new_len))
        if start > end:
            start, end = end, start
        st["range"] = [start, end]
        if start != end:
            new_styles.append(st)

    # Ensure at least one style covers [0, new_len] if all collapsed
    if not new_styles and new_len > 0:
        base = deepcopy(styles[0])
        base["range"] = [0, new_len]
        return [base]
    return new_styles


def apply_text_to_material(
    mat: Dict[str, Any],
    text: str,
    *,
    recalc_style: bool = True,
    font_size: Optional[int] = None,
) -> Dict[str, Any]:
    """Write ``text`` into material.content, preserving/rescaling styles."""
    text = str(text)
    obj = parse_content_obj(mat.get("content"))

    if obj is not None:
        old_text = str(obj.get("text") or "")
        styles_raw = obj.get("styles") if isinstance(obj.get("styles"), list) else []
        styles = [s for s in styles_raw if isinstance(s, dict)]

        if recalc_style and styles:
            obj["styles"] = recalc_style_ranges(styles, len(old_text), len(text))
        elif not styles and text:
            # No styles yet — create a default covering full text
            obj["styles"] = [
                _default_style(0, len(text), font_size or int(mat.get("font_size") or 15))
            ]
        else:
            # recalc_style=False: still fix first range end if single style
            if styles and len(styles) == 1:
                st = deepcopy(styles[0])
                st["range"] = [0, len(text)]
                obj["styles"] = [st] if text else []

        # Touch size on first style if font_size requested
        if font_size is not None and isinstance(obj.get("styles"), list) and obj["styles"]:
            first = obj["styles"][0]
            if isinstance(first, dict):
                first["size"] = font_size

        obj["text"] = text
        mat["content"] = json.dumps(obj, ensure_ascii=False)
    else:
        # Plain content string (or missing) — promote to structured JSON
        size = font_size if font_size is not None else int(mat.get("font_size") or 15)
        mat["content"] = json.dumps(
            {
                "text": text,
                "styles": [_default_style(0, len(text), size)] if text else [],
            },
            ensure_ascii=False,
        )

    if font_size is not None:
        mat["font_size"] = font_size
    return mat


def _default_style(start: int, end: int, size: int, color: Optional[List[float]] = None) -> Dict[str, Any]:
    rgb = color if color and len(color) >= 3 else [1.0, 1.0, 1.0]
    return {
        "fill": {
            "alpha": 1.0,
            "content": {
                "render_type": "solid",
                "solid": {"alpha": 1.0, "color": [float(rgb[0]), float(rgb[1]), float(rgb[2])]},
            },
        },
        "font": {"path": "", "id": ""},
        "size": int(size),
        "range": [int(start), int(end)],
        "bold": False,
        "italic": False,
        "underline": False,
    }


def hex_to_rgb(hex_color: str) -> List[float]:
    """#RRGGBB → [r,g,b] in 0..1."""
    h = (hex_color or "").strip().lstrip("#")
    if len(h) != 6:
        return [1.0, 1.0, 1.0]
    try:
        return [int(h[0:2], 16) / 255.0, int(h[2:4], 16) / 255.0, int(h[4:6], 16) / 255.0]
    except ValueError:
        return [1.0, 1.0, 1.0]


def build_text_material(
    text: str,
    *,
    font_size: int = 15,
    color: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a CapCut-compatible text material with content JSON + styles."""
    mid = uuid.uuid4().hex
    rgb = hex_to_rgb(color) if color else [1.0, 1.0, 1.0]
    content_obj = {
        "text": text,
        "styles": [_default_style(0, len(text), font_size, rgb)] if text else [],
    }
    hex_out = color if color and color.startswith("#") else (
        f"#{int(rgb[0]*255):02X}{int(rgb[1]*255):02X}{int(rgb[2]*255):02X}"
    )
    return {
        "id": mid,
        "type": "text",
        "content": json.dumps(content_obj, ensure_ascii=False),
        "font_size": int(font_size),
        "text_color": hex_out if color else "#FFFFFF",
        "alignment": 1,
        "typesetting": 0,
    }


# ── public API ─────────────────────────────────────────────────────


def list_materials(draft: Dict[str, Any]) -> Dict[str, Any]:
    materials = draft.get("materials") or {}
    out: Dict[str, Any] = {}
    for key, val in materials.items():
        if not isinstance(val, list):
            continue
        items = []
        for m in val:
            if not isinstance(m, dict):
                continue
            item: Dict[str, Any] = {
                "id": m.get("id"),
                "type": m.get("type") or key,
                "path": m.get("path") or m.get("material_name") or m.get("name"),
                "duration": m.get("duration"),
            }
            if key == "texts" or m.get("type") == "text":
                item["text"] = extract_plain_text(m)
                item["styles"] = summarize_styles(extract_styles(m))
            items.append(item)
        out[key] = {"count": len(items), "items": items}
    return out


def list_texts(draft: Dict[str, Any]) -> List[Dict[str, Any]]:
    """List text segments on text tracks (+ style ranges from content JSON)."""
    materials = draft.get("materials") or {}
    texts = {
        t.get("id"): t
        for t in (materials.get("texts") or [])
        if isinstance(t, dict) and t.get("id")
    }
    rows: List[Dict[str, Any]] = []
    seen_mids: set = set()

    for t in draft.get("tracks") or []:
        if not isinstance(t, dict) or t.get("type") != "text":
            continue
        for s in t.get("segments") or []:
            if not isinstance(s, dict):
                continue
            mid = s.get("material_id")
            mat = texts.get(mid) or {}
            tr = s.get("target_timerange") or {}
            styles = extract_styles(mat)
            plain = extract_plain_text(mat)
            rows.append(
                {
                    "segment_id": s.get("id"),
                    "material_id": mid,
                    "text": plain,
                    "start": tr.get("start"),
                    "duration": tr.get("duration"),
                    "styles": summarize_styles(styles),
                    "style_count": len(styles),
                    "content_is_json": parse_content_obj(mat.get("content")) is not None,
                }
            )
            if mid:
                seen_mids.add(mid)

    # Orphan text materials (no segment) — useful for debugging
    for mid, mat in texts.items():
        if mid in seen_mids:
            continue
        styles = extract_styles(mat)
        rows.append(
            {
                "segment_id": None,
                "material_id": mid,
                "text": extract_plain_text(mat),
                "start": None,
                "duration": None,
                "styles": summarize_styles(styles),
                "style_count": len(styles),
                "content_is_json": parse_content_obj(mat.get("content")) is not None,
                "orphan": True,
            }
        )
    return rows


def set_text(
    draft: Dict[str, Any],
    text: str,
    *,
    segment_id: Optional[str] = None,
    material_id: Optional[str] = None,
    recalc_style: bool = True,
    font_size: Optional[int] = None,
) -> Dict[str, Any]:
    """Change text on a material (by segment_id or material_id).

    Updates content JSON ``text`` and rescales style ``range`` values.
    """
    materials = draft.setdefault("materials", {})
    texts: List[Dict[str, Any]] = materials.setdefault("texts", [])

    mid = material_id
    if segment_id:
        seg = find_segment(draft, segment_id)
        if seg is None:
            raise KeyError(f"segment_id không tồn tại: {segment_id}")
        mid = seg.get("material_id") or mid

    if not mid:
        raise ValueError("Cần segment_id hoặc material_id")

    for mat in texts:
        if mat.get("id") == mid:
            apply_text_to_material(
                mat, text, recalc_style=recalc_style, font_size=font_size
            )
            # Return parse-friendly view
            return {
                "id": mat.get("id"),
                "type": mat.get("type"),
                "text": extract_plain_text(mat),
                "styles": summarize_styles(extract_styles(mat)),
                "content": mat.get("content"),
                "font_size": mat.get("font_size"),
            }

    raise KeyError(f"material_id không tồn tại: {mid}")


def add_text(
    draft: Dict[str, Any],
    text: str,
    start_us: int,
    duration_us: int,
    *,
    font_size: int = 15,
    color: Optional[str] = None,
) -> Dict[str, Any]:
    """Append a text material + segment on a text track."""
    if duration_us <= 0:
        raise ValueError("duration_us must be > 0")
    if start_us < 0:
        raise ValueError("start_us must be >= 0")
    if not str(text):
        raise ValueError("text must be non-empty")

    materials = draft.setdefault("materials", {})
    texts: List[Dict[str, Any]] = materials.setdefault("texts", [])
    mat = build_text_material(text, font_size=font_size, color=color)
    texts.append(mat)

    track = _ensure_text_track(draft)
    segs: List[Dict[str, Any]] = track.setdefault("segments", [])
    seg = {
        "id": uuid.uuid4().hex,
        "material_id": mat["id"],
        "target_timerange": {"start": int(start_us), "duration": int(duration_us)},
        "source_timerange": {"start": 0, "duration": int(duration_us)},
        "speed": 1.0,
        "volume": 1.0,
        "visible": True,
        "render_index": 0,
        "extra_material_refs": [],
    }
    segs.append(seg)
    end = int(start_us) + int(duration_us)
    draft["duration"] = max(int(draft.get("duration") or 0), end)

    return {
        "material": {
            "id": mat["id"],
            "text": extract_plain_text(mat),
            "styles": summarize_styles(extract_styles(mat)),
            "content": mat.get("content"),
            "font_size": mat.get("font_size"),
        },
        "segment": seg,
    }


def get_content_style_info(
    draft: Dict[str, Any],
    *,
    segment_id: Optional[str] = None,
    material_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Debug/helper: full parse of content styles for one material."""
    materials = draft.get("materials") or {}
    texts = {
        t.get("id"): t
        for t in (materials.get("texts") or [])
        if isinstance(t, dict) and t.get("id")
    }
    mid = material_id
    if segment_id:
        seg = find_segment(draft, segment_id)
        if seg is None:
            raise KeyError(f"segment_id không tồn tại: {segment_id}")
        mid = seg.get("material_id")
    if not mid or mid not in texts:
        raise KeyError(f"material_id không tồn tại: {mid}")
    mat = texts[mid]
    obj = parse_content_obj(mat.get("content"))
    plain = extract_plain_text(mat)
    styles = extract_styles(mat)
    return {
        "material_id": mid,
        "text": plain,
        "text_len": len(plain),
        "styles": summarize_styles(styles),
        "raw_styles": styles,
        "content_is_json": obj is not None,
        "content_keys": list(obj.keys()) if obj else [],
    }
