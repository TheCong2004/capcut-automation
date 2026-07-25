"""
FX / animation / style ops on raw CapCut draft — pure Python (WAVE2 Grok B).

No capcut-cli / Node. Metadata from pyJianYingDraft. Shared I/O via draft_io
is done in the router; these functions mutate the in-memory draft dict only.
"""

from __future__ import annotations

import os
import uuid
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Type, TypeVar, Union


def resolve_effect_path(resource_id: str, effect_id: str) -> str:
    """Resolve local CapCut cache asset directory for effect/filter."""
    try:
        cache_root = Path(os.path.expandvars("%LOCALAPPDATA%/CapCut/User Data/Cache/effect"))
        if not cache_root.is_dir():
            return ""
        for candidate in [resource_id, effect_id]:
            if candidate:
                eff_dir = cache_root / str(candidate)
                if eff_dir.is_dir():
                    subdirs = [s for s in eff_dir.iterdir() if s.is_dir() and not s.name.endswith("_tmp")]
                    if subdirs:
                        return str(subdirs[0]).replace("\\", "/")
        for eff_dir in cache_root.iterdir():
            if eff_dir.is_dir() and eff_dir.name not in ("model", "script_segment_js"):
                subdirs = [s for s in eff_dir.iterdir() if s.is_dir() and not s.name.endswith("_tmp")]
                if subdirs:
                    return str(subdirs[0]).replace("\\", "/")
    except Exception:
        pass
    return ""

from src.pyJianYingDraft.metadata import (
    AudioSceneEffectType,
    FilterType,
    GroupAnimationType,
    IntroType,
    MixModeType,
    OutroType,
    TextIntro,
    TextLoopAnim,
    TextOutro,
    TransitionType,
    VideoCharacterEffectType,
    VideoSceneEffectType,
)
from src.pyJianYingDraft.metadata.effect_meta import AnimationMeta, EffectEnum, EffectMeta
from src.pyJianYingDraft.metadata.mask_meta import MaskType

E = TypeVar("E", bound=EffectEnum)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _new_id() -> str:
    return uuid.uuid4().hex


def _materials(draft: Dict[str, Any]) -> Dict[str, Any]:
    m = draft.setdefault("materials", {})
    if not isinstance(m, dict):
        draft["materials"] = {}
        m = draft["materials"]
    return m


def _ensure_list(materials: Dict[str, Any], key: str) -> List[Any]:
    val = materials.get(key)
    if not isinstance(val, list):
        materials[key] = []
        return materials[key]
    return val


def _find_segment_ctx(
    draft: Dict[str, Any], segment_id: str
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    for t in draft.get("tracks") or []:
        if not isinstance(t, dict):
            continue
        for s in t.get("segments") or []:
            if isinstance(s, dict) and s.get("id") == segment_id:
                return t, s
    raise KeyError(f"segment_id không tồn tại: {segment_id}")


def _seg_duration_us(seg: Dict[str, Any]) -> int:
    tr = seg.get("target_timerange") or {}
    return int(tr.get("duration") or 0)


def _refs(seg: Dict[str, Any]) -> List[Any]:
    refs = seg.setdefault("extra_material_refs", [])
    if not isinstance(refs, list):
        seg["extra_material_refs"] = []
        return seg["extra_material_refs"]
    return refs


def _norm_key(s: str) -> str:
    return (
        str(s)
        .strip()
        .lower()
        .replace(" ", "")
        .replace("_", "")
        .replace("-", "")
    )


def resolve_effect_enum(enum_cls: Type[E], name: str, *, kind: str = "effect") -> E:
    """Resolve by enum member name or meta.name / meta.title."""
    raw = (name or "").strip()
    if not raw:
        raise ValueError(f"{kind} name rỗng")
    try:
        return enum_cls.from_name(raw)  # type: ignore[return-value]
    except ValueError:
        pass
    needle = _norm_key(raw)
    for e in enum_cls:  # type: ignore[attr-defined]
        meta = e.value
        candidates = [e.name]
        if hasattr(meta, "name") and meta.name:
            candidates.append(str(meta.name))
        if hasattr(meta, "title") and meta.title:
            candidates.append(str(meta.title))
        for c in candidates:
            if _norm_key(c) == needle:
                return e  # type: ignore[return-value]
    sample = []
    for i, e in enumerate(enum_cls):  # type: ignore[attr-defined]
        if i >= 8:
            break
        meta = e.value
        sample.append(getattr(meta, "title", None) or getattr(meta, "name", e.name))
    raise ValueError(
        f"Không tìm thấy {kind}: {name!r}. Ví dụ: {', '.join(map(str, sample))}…"
    )


def _find_material(
    draft: Dict[str, Any], material_id: str, *pool_keys: str
) -> Optional[Dict[str, Any]]:
    mats = draft.get("materials") or {}
    if not isinstance(mats, dict):
        return None
    for key in pool_keys:
        pool = mats.get(key)
        if not isinstance(pool, list):
            continue
        for item in pool:
            if isinstance(item, dict) and item.get("id") == material_id:
                return item
    return None


def _get_or_create_track(
    draft: Dict[str, Any],
    track_type: str,
    name: str,
    *,
    start_us: int = 0,
    duration_us: int = 3_000_000,
) -> Dict[str, Any]:
    tracks = draft.setdefault("tracks", [])
    if not isinstance(tracks, list):
        draft["tracks"] = []
        tracks = draft["tracks"]

    end_us = start_us + duration_us
    for t in tracks:
        if isinstance(t, dict) and t.get("type") == track_type:
            segs = t.get("segments") or []
            has_overlap = False
            for s in segs:
                if isinstance(s, dict):
                    tr = s.get("target_timerange") or {}
                    st = int(tr.get("start") or 0)
                    du = int(tr.get("duration") or 0)
                    if not (end_us <= st or start_us >= st + du):
                        has_overlap = True
                        break
            if not has_overlap:
                return t

    track = {
        "id": _new_id(),
        "type": track_type,
        "name": name,
        "attribute": 0,
        "flag": 0,
        "segments": [],
    }
    tracks.append(track)
    return track


def _timerange(start: int, duration: int) -> Dict[str, int]:
    return {"start": int(start), "duration": int(duration)}


# ---------------------------------------------------------------------------
# bg-blur
# ---------------------------------------------------------------------------

_BLUR_LEVELS = {1: 0.0625, 2: 0.375, 3: 0.75, 4: 1.0}


def set_bg_blur(
    draft: Dict[str, Any],
    segment_id: str,
    level: Union[int, str] = 2,
) -> Dict[str, Any]:
    """Background blur canvas material (levels 1–4 or 'off')."""
    _track, seg = _find_segment_ctx(draft, segment_id)
    mats = _materials(draft)
    canvases = _ensure_list(mats, "canvases")

    # Drop existing canvas refs on this segment
    canvas_ids = {c.get("id") for c in canvases if isinstance(c, dict)}
    refs = _refs(seg)
    seg["extra_material_refs"] = [r for r in refs if r not in canvas_ids]
    # prune orphaned canvases only referenced by this removal? keep others
    removed = [r for r in refs if r in canvas_ids]
    if removed:
        mats["canvases"] = [
            c for c in canvases if not (isinstance(c, dict) and c.get("id") in removed)
        ]
        canvases = mats["canvases"]

    if str(level).lower() in ("off", "0", "false", "none"):
        return {"segment_id": segment_id, "canvas_id": None, "blur": None, "off": True}

    try:
        lv = int(level)
    except (TypeError, ValueError) as e:
        raise ValueError(f"bg-blur level phải là 1–4 hoặc 'off', got {level!r}") from e
    if lv not in _BLUR_LEVELS:
        raise ValueError(f"bg-blur level phải là 1–4 hoặc 'off', got {level!r}")

    blur = _BLUR_LEVELS[lv]
    cid = _new_id()
    canvases.append(
        {
            "album_image": "",
            "blur": blur,
            "color": "",
            "id": cid,
            "image": "",
            "image_id": "",
            "image_name": "",
            "source_platform": 0,
            "team_id": "",
            "type": "canvas_blur",
        }
    )
    _refs(seg).append(cid)
    return {"segment_id": segment_id, "canvas_id": cid, "blur": blur, "level": lv, "off": False}


# ---------------------------------------------------------------------------
# chroma
# ---------------------------------------------------------------------------


def set_chroma(
    draft: Dict[str, Any],
    segment_id: str,
    color: str = "#00FF00",
    intensity: float = 0.5,
    shadow: float = 0.0,
    *,
    off: bool = False,
) -> Dict[str, Any]:
    track, seg = _find_segment_ctx(draft, segment_id)
    if track.get("type") not in ("video",):
        raise ValueError(
            f"chroma chỉ áp dụng video segment (track type={track.get('type')!r})"
        )

    mats = _materials(draft)
    chromas = _ensure_list(mats, "chromas")
    chroma_ids = {c.get("id") for c in chromas if isinstance(c, dict)}
    refs = _refs(seg)
    removed = [r for r in refs if r in chroma_ids]
    if removed:
        seg["extra_material_refs"] = [r for r in refs if r not in chroma_ids]
        mats["chromas"] = [
            c for c in chromas if not (isinstance(c, dict) and c.get("id") in removed)
        ]
        chromas = mats["chromas"]

    if off:
        return {"segment_id": segment_id, "removed": removed, "off": True}

    color = str(color).strip()
    if not color.startswith("#"):
        color = f"#{color}"
    if len(color) not in (7, 9) or any(c not in "0123456789abcdefABCDEF#" for c in color):
        raise ValueError(f"color hex không hợp lệ: {color!r} (dạng #RRGGBB)")

    intensity = max(0.0, min(1.0, float(intensity)))
    shadow = max(0.0, min(1.0, float(shadow)))
    mid = _new_id()
    chromas.append(
        {
            "id": mid,
            "type": "chromas",
            "color": color,
            "intensity": intensity,
            "shadow": shadow,
            "path": "",
        }
    )
    _refs(seg).append(mid)
    return {
        "segment_id": segment_id,
        "material_id": mid,
        "color": color,
        "intensity": intensity,
        "shadow": shadow,
    }


# ---------------------------------------------------------------------------
# mix-mode
# ---------------------------------------------------------------------------

_MIX_EN_TO_CN = {
    "normal": None,  # clear
    "multiply": "正片叠底",
    "screen": "滤色",
    "overlay": "叠加",
    "soft-light": "柔光",
    "softlight": "柔光",
    "hard-light": "强光",
    "hardlight": "强光",
    "color-dodge": "颜色减淡",
    "colordodge": "颜色减淡",
    "color-burn": "颜色加深",
    "colorburn": "颜色加深",
    "darken": "变暗",
    "lighten": "变亮",
    "linear-burn": "线性加深",
    "linearburn": "线性加深",
}


def set_mix_mode(
    draft: Dict[str, Any],
    segment_id: str,
    mode: str,
) -> Dict[str, Any]:
    """Attach mix_mode material (JianYing meta) or clear with mode=normal."""
    _track, seg = _find_segment_ctx(draft, segment_id)
    mats = _materials(draft)
    mix_pool = _ensure_list(mats, "mix_modes")

    # remove existing mix_mode refs
    mix_ids = {
        m.get("id")
        for m in mix_pool
        if isinstance(m, dict) and m.get("type") == "mix_mode"
    }
    refs = _refs(seg)
    removed = [r for r in refs if r in mix_ids]
    if removed:
        seg["extra_material_refs"] = [r for r in refs if r not in mix_ids]
        mats["mix_modes"] = [
            m for m in mix_pool if not (isinstance(m, dict) and m.get("id") in removed)
        ]
        mix_pool = mats["mix_modes"]

    raw_mode = mode.strip()
    low = raw_mode.lower()
    cn = _MIX_EN_TO_CN.get(low) if low in _MIX_EN_TO_CN else _MIX_EN_TO_CN.get(_norm_key(raw_mode))
    # explicit EN key present with None value = normal/clear
    if low in _MIX_EN_TO_CN and _MIX_EN_TO_CN[low] is None:
        vmat = _find_material(draft, str(seg.get("material_id") or ""), "videos")
        if vmat is not None:
            vmat["mix_mode"] = "Normal"
        return {"segment_id": segment_id, "mix_mode": "Normal", "cleared": True}

    name = cn if cn is not None else raw_mode
    meta_e = resolve_effect_enum(MixModeType, name, kind="mix-mode")
    meta: EffectMeta = meta_e.value
    mid = _new_id()
    entry = {
        "type": "mix_mode",
        "name": meta.name,
        "effect_id": meta.effect_id,
        "resource_id": meta.resource_id,
        "value": 1.0,
        "apply_target_type": 0,
        "platform": "all",
        "source_platform": 0,
        "category_id": "",
        "category_name": "",
        "sub_type": "none",
        "time_range": None,
        "id": mid,
    }
    mix_pool.append(entry)
    _refs(seg).append(mid)

    vmat = _find_material(draft, str(seg.get("material_id") or ""), "videos")
    if vmat is not None:
        # CapCut EN mirror when known
        for en, cname in _MIX_EN_TO_CN.items():
            if cname == meta.name and en not in ("softlight", "hardlight", "colordodge", "colorburn", "linearburn"):
                vmat["mix_mode"] = en.replace("-", " ").title().replace(" ", " ")
                break

    return {
        "segment_id": segment_id,
        "material_id": mid,
        "mix_mode": meta.name,
        "resource_id": meta.resource_id,
        "effect_id": meta.effect_id,
    }


# ---------------------------------------------------------------------------
# text-anim / image-anim
# ---------------------------------------------------------------------------

_TEXT_INTRO_ALIASES = {
    "fade-in": "渐显",
    "fadein": "渐显",
    "typewriter": "打字机 I",
}
_TEXT_OUTRO_ALIASES = {
    "fade-out": "渐隐",
    "fadeout": "渐隐",
}
_VIDEO_INTRO_ALIASES = {
    "fade-in": "渐显",
    "fadein": "渐显",
}
_VIDEO_OUTRO_ALIASES = {
    "fade-out": "渐隐",
    "fadeout": "渐隐",
}


def _get_anim_container(draft: Dict[str, Any], seg: Dict[str, Any]) -> Dict[str, Any]:
    mats = _materials(draft)
    anims = _ensure_list(mats, "material_animations")
    by_id = {a.get("id"): a for a in anims if isinstance(a, dict)}
    for ref in _refs(seg):
        m = by_id.get(ref)
        if m and m.get("type") in ("sticker_animation", "material_animation", None):
            m.setdefault("animations", [])
            return m
    cid = _new_id()
    container = {
        "animations": [],
        "id": cid,
        "multi_language_current": "none",
        "type": "sticker_animation",
    }
    anims.append(container)
    _refs(seg).append(cid)
    return container


def _push_animation(
    container: Dict[str, Any],
    *,
    anim_type: str,
    meta: AnimationMeta,
    material_type: str,
    duration_us: int,
    start_us: int,
    panel: str = "",
) -> Dict[str, Any]:
    anims: List[Any] = container.setdefault("animations", [])
    # replace same type
    container["animations"] = [
        a for a in anims if not (isinstance(a, dict) and a.get("type") == anim_type)
    ]
    entry = {
        "anim_adjust_params": None,
        "category_id": "in_fav" if anim_type == "in" else ("out_fav" if anim_type == "out" else ""),
        "category_name": "in_fav" if anim_type == "in" else ("out_fav" if anim_type == "out" else ""),
        "duration": int(duration_us),
        "id": meta.effect_id,
        "material_type": material_type,
        "name": meta.title,
        "panel": panel,
        "path": "",
        "platform": "all",
        "request_id": "",
        "resource_id": meta.resource_id,
        "source_platform": 1,
        "start": int(start_us),
        "third_resource_id": "",
        "type": anim_type,
    }
    container["animations"].append(entry)
    return entry


def add_text_anim(
    draft: Dict[str, Any],
    segment_id: str,
    *,
    intro: Optional[str] = None,
    outro: Optional[str] = None,
    loop: Optional[str] = None,
    intro_duration_us: Optional[int] = None,
    outro_duration_us: Optional[int] = None,
    loop_duration_us: Optional[int] = None,
) -> Dict[str, Any]:
    if not intro and not outro and not loop:
        raise ValueError("cần ít nhất một trong intro / outro / loop")
    track, seg = _find_segment_ctx(draft, segment_id)
    if track.get("type") not in ("text", "subtitle"):
        # allow if text material exists
        mid = seg.get("material_id")
        if not _find_material(draft, str(mid or ""), "texts"):
            raise ValueError(
                f"text-anim cần text segment (track={track.get('type')!r})"
            )

    container = _get_anim_container(draft, seg)
    target = _seg_duration_us(seg) or 5_000_000
    added: List[Dict[str, Any]] = []

    if intro:
        name = _TEXT_INTRO_ALIASES.get(intro.strip().lower(), intro)
        e = resolve_effect_enum(TextIntro, name, kind="text-intro")
        meta: AnimationMeta = e.value
        dur = int(intro_duration_us if intro_duration_us is not None else meta.duration)
        if target and dur > target:
            dur = target
        entry = _push_animation(
            container,
            anim_type="in",
            meta=meta,
            material_type="text",
            duration_us=dur,
            start_us=0,
        )
        added.append({"type": "in", "name": meta.title, "duration_us": dur, "resource_id": meta.resource_id})

    if outro:
        name = _TEXT_OUTRO_ALIASES.get(outro.strip().lower(), outro)
        e = resolve_effect_enum(TextOutro, name, kind="text-outro")
        meta = e.value
        dur = int(outro_duration_us if outro_duration_us is not None else meta.duration)
        if target and dur > target:
            dur = target
        start = max(0, target - dur)
        entry = _push_animation(
            container,
            anim_type="out",
            meta=meta,
            material_type="text",
            duration_us=dur,
            start_us=start,
        )
        added.append({"type": "out", "name": meta.title, "duration_us": dur, "resource_id": meta.resource_id})

    if loop:
        e = resolve_effect_enum(TextLoopAnim, loop, kind="text-loop")
        meta = e.value
        dur = int(loop_duration_us if loop_duration_us is not None else meta.duration)
        entry = _push_animation(
            container,
            anim_type="group",
            meta=meta,
            material_type="text",
            duration_us=dur,
            start_us=0,
        )
        added.append({"type": "group", "name": meta.title, "duration_us": dur, "resource_id": meta.resource_id})

    return {
        "segment_id": segment_id,
        "material_id": container["id"],
        "added": added,
    }


def add_image_anim(
    draft: Dict[str, Any],
    segment_id: str,
    *,
    intro: Optional[str] = None,
    outro: Optional[str] = None,
    combo: Optional[str] = None,
    intro_duration_us: Optional[int] = None,
    outro_duration_us: Optional[int] = None,
    combo_duration_us: Optional[int] = None,
) -> Dict[str, Any]:
    if not intro and not outro and not combo:
        raise ValueError("cần ít nhất một trong intro / outro / combo")
    _track, seg = _find_segment_ctx(draft, segment_id)
    container = _get_anim_container(draft, seg)
    target = _seg_duration_us(seg) or 5_000_000
    added: List[Dict[str, Any]] = []

    if intro:
        name = _VIDEO_INTRO_ALIASES.get(intro.strip().lower(), intro)
        e = resolve_effect_enum(IntroType, name, kind="image-intro")
        meta: AnimationMeta = e.value
        dur = int(intro_duration_us if intro_duration_us is not None else meta.duration)
        if target and dur > target:
            dur = target
        _push_animation(
            container,
            anim_type="in",
            meta=meta,
            material_type="video",
            duration_us=dur,
            start_us=0,
            panel="video",
        )
        added.append({"type": "in", "name": meta.title, "duration_us": dur, "resource_id": meta.resource_id})

    if outro:
        name = _VIDEO_OUTRO_ALIASES.get(outro.strip().lower(), outro)
        e = resolve_effect_enum(OutroType, name, kind="image-outro")
        meta = e.value
        dur = int(outro_duration_us if outro_duration_us is not None else meta.duration)
        if target and dur > target:
            dur = target
        start = max(0, target - dur)
        _push_animation(
            container,
            anim_type="out",
            meta=meta,
            material_type="video",
            duration_us=dur,
            start_us=start,
            panel="video",
        )
        added.append({"type": "out", "name": meta.title, "duration_us": dur, "resource_id": meta.resource_id})

    if combo:
        e = resolve_effect_enum(GroupAnimationType, combo, kind="image-combo")
        meta = e.value
        dur = int(combo_duration_us if combo_duration_us is not None else meta.duration)
        _push_animation(
            container,
            anim_type="group",
            meta=meta,
            material_type="video",
            duration_us=dur,
            start_us=0,
            panel="video",
        )
        added.append({"type": "group", "name": meta.title, "duration_us": dur, "resource_id": meta.resource_id})

    return {"segment_id": segment_id, "material_id": container["id"], "added": added}


# ---------------------------------------------------------------------------
# text-style
# ---------------------------------------------------------------------------


def set_text_style(
    draft: Dict[str, Any],
    segment_id: str,
    *,
    alpha: Optional[float] = None,
    vertical: Optional[bool] = None,
    shadow: Optional[bool] = None,
    shadow_alpha: Optional[float] = None,
    shadow_angle: Optional[float] = None,
    shadow_color: Optional[str] = None,
    shadow_distance: Optional[float] = None,
    shadow_smoothing: Optional[float] = None,
    border_width: Optional[float] = None,
    border_color: Optional[str] = None,
    border_alpha: Optional[float] = None,
    bg_color: Optional[str] = None,
    bg_alpha: Optional[float] = None,
    bg_style: Optional[int] = None,
    bg_round_radius: Optional[float] = None,
    fixed_width: Optional[float] = None,
    fixed_height: Optional[float] = None,
) -> Dict[str, Any]:
    _track, seg = _find_segment_ctx(draft, segment_id)
    mid = str(seg.get("material_id") or "")
    text = _find_material(draft, mid, "texts")
    if text is None:
        raise ValueError(f"Không tìm thấy text material cho segment {segment_id}")

    applied: List[str] = []
    if alpha is not None:
        text["text_alpha"] = float(alpha)
        applied.append("alpha")
    if vertical is not None:
        text["typesetting"] = 1 if vertical else 0
        applied.append("vertical")
    if fixed_width is not None:
        text["fixed_width"] = float(fixed_width)
        applied.append("fixed_width")
    if fixed_height is not None:
        text["fixed_height"] = float(fixed_height)
        applied.append("fixed_height")

    if shadow is True:
        text["has_shadow"] = True
        if shadow_alpha is not None:
            text["shadow_alpha"] = float(shadow_alpha)
        if shadow_angle is not None:
            text["shadow_angle"] = float(shadow_angle)
        if shadow_color is not None:
            text["shadow_color"] = shadow_color
        if shadow_distance is not None:
            text["shadow_distance"] = float(shadow_distance)
        if shadow_smoothing is not None:
            text["shadow_smoothing"] = float(shadow_smoothing)
        applied.append("shadow")
    elif shadow is False:
        text["has_shadow"] = False
        applied.append("shadow-off")

    if border_width is not None or border_color is not None or border_alpha is not None:
        text["has_border"] = True
        if border_width is not None:
            text["border_width"] = float(border_width)
        if border_color is not None:
            text["border_color"] = border_color
        if border_alpha is not None:
            text["border_alpha"] = float(border_alpha)
        applied.append("border")

    if any(x is not None for x in (bg_color, bg_alpha, bg_style, bg_round_radius)):
        if bg_color is not None:
            text["background_color"] = bg_color
        if bg_alpha is not None:
            text["background_alpha"] = float(bg_alpha)
        if bg_style is not None:
            text["background_style"] = int(bg_style)
        if bg_round_radius is not None:
            text["background_round_radius"] = float(bg_round_radius)
        applied.append("bg")

    if not applied:
        raise ValueError("text-style: không có field nào được set")
    return {"segment_id": segment_id, "material_id": mid, "applied": applied}


# ---------------------------------------------------------------------------
# bubble-text
# ---------------------------------------------------------------------------

_BUBBLES: Dict[str, Dict[str, str]] = {
    "rectangle": {
        "name": "Rectangle",
        "effect_id": "7137268628230638087",
        "resource_id": "7137268628230638087",
    },
    "rounded": {
        "name": "Rounded Rectangle",
        "effect_id": "7137268898998568967",
        "resource_id": "7137268898998568967",
    },
    "cloud": {
        "name": "Cloud",
        "effect_id": "7137269184932778510",
        "resource_id": "7137269184932778510",
    },
    "oval": {
        "name": "Oval",
        "effect_id": "7137269466232116231",
        "resource_id": "7137269466232116231",
    },
    "star": {
        "name": "Star",
        "effect_id": "7137269743886750214",
        "resource_id": "7137269743886750214",
    },
    "heart": {
        "name": "Heart",
        "effect_id": "7137270031716044302",
        "resource_id": "7137270031716044302",
    },
    "burst": {
        "name": "Burst",
        "effect_id": "7137270320304885262",
        "resource_id": "7137270320304885262",
    },
}


def set_bubble_text(
    draft: Dict[str, Any],
    segment_id: str,
    *,
    slug: Optional[str] = None,
    effect_id: Optional[str] = None,
    resource_id: Optional[str] = None,
) -> Dict[str, Any]:
    track, seg = _find_segment_ctx(draft, segment_id)
    if track.get("type") not in ("text", "subtitle"):
        mid0 = seg.get("material_id")
        if not _find_material(draft, str(mid0 or ""), "texts"):
            raise ValueError(
                f"bubble-text chỉ cho text segment (track={track.get('type')!r})"
            )

    eid, rid = effect_id, resource_id
    if (not eid or not rid) and slug:
        meta = _BUBBLES.get(slug.strip().lower())
        if not meta:
            raise ValueError(
                f"bubble slug không biết: {slug!r}. Hỗ trợ: {', '.join(_BUBBLES)}"
            )
        eid = eid or meta["effect_id"]
        rid = rid or meta["resource_id"]
    if not eid or not rid:
        raise ValueError("bubble-text cần slug hoặc (effect_id + resource_id)")

    mats = _materials(draft)
    filters = _ensure_list(mats, "filters")
    # drop existing text_shape bubbles on segment
    bubble_ids = {
        f.get("id")
        for f in filters
        if isinstance(f, dict) and f.get("type") == "text_shape"
    }
    refs = _refs(seg)
    seg["extra_material_refs"] = [r for r in refs if r not in bubble_ids]
    mats["filters"] = [
        f for f in filters if not (isinstance(f, dict) and f.get("id") in bubble_ids and f.get("type") == "text_shape")
    ]
    filters = mats["filters"]

    bid = _new_id()
    filters.append(
        {
            "id": bid,
            "apply_target_type": 0,
            "effect_id": eid,
            "resource_id": rid,
            "type": "text_shape",
            "value": 1.0,
        }
    )
    _refs(seg).append(bid)

    text = _find_material(draft, str(seg.get("material_id") or ""), "texts")
    if text is not None:
        text["bubble_effect_id"] = eid
        text["bubble_resource_id"] = rid

    return {
        "segment_id": segment_id,
        "bubble_id": bid,
        "effect_id": eid,
        "resource_id": rid,
    }


# ---------------------------------------------------------------------------
# add-sfx / add-filter / add-effect / add-sticker (track-level local)
# ---------------------------------------------------------------------------


def add_sfx(
    draft: Dict[str, Any],
    *,
    name: str,
    start_us: int = 0,
    duration_us: int = 1_000_000,
    track_name: str = "sfx",
    volume: float = 1.0,
) -> Dict[str, Any]:
    e = resolve_effect_enum(AudioSceneEffectType, name, kind="sfx")
    meta: EffectMeta = e.value
    if duration_us <= 0:
        raise ValueError("duration_us phải > 0")

    mats = _materials(draft)
    pool = _ensure_list(mats, "audio_effects")
    mid = _new_id()
    pool.append(
        {
            "id": mid,
            "name": meta.name,
            "effect_id": meta.effect_id,
            "resource_id": meta.resource_id,
            "formula_id": "",
            "is_vip": bool(meta.is_vip),
            "md5": meta.md5,
            "type": "sound_effect",
            "category_id": "",
            "category_name": "",
            "path": "",
            "platform": "all",
            "source_platform": 0,
            "version": "",
        }
    )
    track = _get_or_create_track(draft, "audio", track_name)
    segs = track.setdefault("segments", [])
    sid = _new_id()
    segs.append(
        {
            "id": sid,
            "material_id": mid,
            "target_timerange": _timerange(start_us, duration_us),
            "source_timerange": _timerange(0, duration_us),
            "speed": 1.0,
            "volume": float(volume),
            "visible": True,
            "extra_material_refs": [],
            "common_keyframes": [],
        }
    )
    return {
        "segment_id": sid,
        "material_id": mid,
        "track_id": track["id"],
        "name": meta.name,
        "resource_id": meta.resource_id,
    }


def add_filter(
    draft: Dict[str, Any],
    *,
    name: str,
    start_us: int = 0,
    duration_us: int = 3_000_000,
    intensity: float = 1.0,
    track_name: str = "filter",
) -> Dict[str, Any]:
    e = resolve_effect_enum(FilterType, name, kind="filter")
    meta: EffectMeta = e.value
    if duration_us <= 0:
        raise ValueError("duration_us phải > 0")
    intensity = max(0.0, min(1.0, float(intensity)))

    mats = _materials(draft)
    # filters + video_effects both used by CapCut variants
    pool = _ensure_list(mats, "filters")
    mid = _new_id()
    mat = {
        "adjust_params": [],
        "apply_target_type": 2,
        "apply_time_range": None,
        "category_id": "",
        "category_name": "Filter",
        "common_keyframes": [],
        "effect_id": meta.effect_id,
        "formula_id": "",
        "id": mid,
        "name": meta.name,
        "platform": "all",
        "render_index": 11000,
        "resource_id": meta.resource_id,
        "source_platform": 0,
        "time_range": None,
        "track_render_index": 0,
        "type": "filter",
        "value": intensity,
        "version": "",
    }
    pool.append(mat)
    _ensure_list(mats, "video_effects").append(dict(mat))

    track = _get_or_create_track(draft, "filter", track_name, start_us=start_us, duration_us=duration_us)
    segs = track.setdefault("segments", [])
    sid = _new_id()
    segs.append(
        {
            "id": sid,
            "material_id": mid,
            "target_timerange": _timerange(start_us, duration_us),
            "source_timerange": _timerange(0, duration_us),
            "speed": 1.0,
            "volume": 1.0,
            "visible": True,
            "render_index": 11000,
            "extra_material_refs": [],
            "common_keyframes": [],
        }
    )
    return {
        "segment_id": sid,
        "material_id": mid,
        "track_id": track["id"],
        "name": meta.name,
        "resource_id": meta.resource_id,
        "intensity": intensity,
    }


def add_effect(
    draft: Dict[str, Any],
    *,
    name: str,
    start_us: int = 0,
    duration_us: int = 3_000_000,
    track_name: str = "effect",
    face: bool = False,
) -> Dict[str, Any]:
    if duration_us <= 0:
        raise ValueError("duration_us phải > 0")
    effect_type = "face_effect" if face else "video_effect"
    if face:
        e = resolve_effect_enum(VideoCharacterEffectType, name, kind="character-effect")
    else:
        try:
            e = resolve_effect_enum(VideoSceneEffectType, name, kind="scene-effect")
        except ValueError:
            e = resolve_effect_enum(VideoCharacterEffectType, name, kind="character-effect")
            effect_type = "face_effect"
    meta: EffectMeta = e.value

    mats = _materials(draft)
    pool = _ensure_list(mats, "video_effects")
    mid = _new_id()
    raw_params = meta.parse_params(None) if hasattr(meta, "parse_params") else []
    adjust_params = []
    for p in raw_params:
        p_json = p.export_json() if hasattr(p, "export_json") else p
        if isinstance(p_json, dict):
            adjust_params.append({
                "name": p_json.get("name", ""),
                "value": float(p_json.get("value", 1.0)),
                "default_value": float(p_json.get("default_value", 1.0)),
            })

    mat = {
        "id": mid,
        "effect_id": meta.effect_id,
        "resource_id": meta.resource_id,
        "name": meta.name,
        "type": effect_type,
        "sub_type": 0,
        "bind_segment_id": "",
        "transparent_params": "",
        "path": resolve_effect_path(meta.resource_id, meta.effect_id),
        "value": 1.0,
        "category_id": "",
        "category_name": "",
        "platform": "all",
        "apply_target_type": 2,
        "source_platform": 1,
        "version": "",
        "item_effect_type": 0,
        "adjust_params": adjust_params,
        "time_range": None,
        "formula_id": "",
        "apply_time_range": None,
        "render_index": 0,
        "track_render_index": 0,
        "common_keyframes": [],
        "disable_effect_faces": [],
        "covering_relation_change": 0,
        "enable_mask": True,
        "effect_mask": [],
        "enable_video_mask_stroke": True,
        "enable_video_mask_shadow": True,
    }
    pool.append(mat)

    track = _get_or_create_track(draft, "effect", track_name, start_us=start_us, duration_us=duration_us)
    segs = track.setdefault("segments", [])
    sid = _new_id()
    segs.append(
        {
            "id": sid,
            "source_timerange": None,
            "target_timerange": _timerange(start_us, duration_us),
            "render_timerange": {"start": 0, "duration": 0},
            "desc": "",
            "state": 0,
            "speed": 1.0,
            "is_loop": False,
            "is_tone_modify": False,
            "reverse": False,
            "intensifies_audio": False,
            "cartoon": False,
            "volume": 1.0,
            "last_nonzero_volume": 1.0,
            "clip": None,
            "uniform_scale": None,
            "material_id": mid,
            "extra_material_refs": [],
            "render_index": 11000,
            "keyframe_refs": [],
            "enable_lut": False,
            "enable_adjust": False,
            "enable_hsl": False,
            "visible": True,
            "group_id": "",
            "enable_color_curves": True,
            "enable_hsl_curves": True,
            "track_render_index": 1,
            "hdr_settings": None,
            "enable_color_wheels": True,
            "track_attribute": 0,
            "is_placeholder": False,
            "template_id": "",
            "enable_smart_color_adjust": False,
            "template_scene": "default",
            "common_keyframes": [],
            "caption_info": None,
            "responsive_layout": {
                "enable": False,
                "target_follow": "",
                "size_layout": 0,
                "horizontal_pos_layout": 0,
                "vertical_pos_layout": 0,
            },
            "enable_color_match_adjust": False,
            "enable_color_correct_adjust": False,
            "enable_adjust_mask": False,
            "raw_segment_id": "",
            "lyric_keyframes": None,
            "enable_video_mask": True,
            "digital_human_template_group_id": "",
            "color_correct_alg_result": "",
            "source": "segmentsourcenormal",
            "enable_mask_stroke": False,
            "enable_mask_shadow": False,
            "enable_color_adjust_pro": False,
            "segment_color_tag": "",
        }
    )
    return {
        "segment_id": sid,
        "material_id": mid,
        "track_id": track["id"],
        "name": meta.name,
        "resource_id": meta.resource_id,
        "type": effect_type,
    }


def add_effects_batch(
    draft: Dict[str, Any],
    effects_data: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Add multiple video effects in a single atomic memory operation."""
    out = []
    for item in effects_data:
        res = add_effect(
            draft,
            name=item.get("name", ""),
            start_us=item.get("start_us", 0),
            duration_us=item.get("duration_us", 3_000_000),
            track_name=item.get("track_name", "effect"),
            face=item.get("face", False),
        )
        out.append(res)
    return out


def list_project_effects(draft: Dict[str, Any]) -> List[Dict[str, Any]]:
    """List all active video effects in the draft."""
    mats = _materials(draft)
    effects = mats.get("video_effects") or []
    out = []
    for ve in effects:
        if isinstance(ve, dict) and ve.get("id"):
            out.append({
                "id": ve.get("id"),
                "name": ve.get("name", "Unknown"),
                "effect_id": ve.get("effect_id", ""),
                "resource_id": ve.get("resource_id", ""),
                "type": ve.get("type", "video_effect"),
            })
    return out


def remove_project_effect(
    draft: Dict[str, Any],
    *,
    name: Optional[str] = None,
    material_id: Optional[str] = None,
) -> int:
    """Remove video effect by material_id/resource_id/name, or clear ALL video effects if no filter specified."""
    mats = _materials(draft)
    v_effects = mats.get("video_effects") or []
    if not isinstance(v_effects, list):
        return 0

    target_mids = set()
    new_v_effects = []

    clear_all = not name and not material_id

    for ve in v_effects:
        if isinstance(ve, dict):
            ve_id = ve.get("id", "")
            ve_name = ve.get("name", "")
            ve_res = ve.get("resource_id", "")
            ve_eff = ve.get("effect_id", "")
            if (
                clear_all
                or (material_id and material_id in (ve_id, ve_res, ve_eff))
                or (name and ve_name.lower() == name.lower())
            ):
                target_mids.add(ve_id)
            else:
                new_v_effects.append(ve)
    mats["video_effects"] = new_v_effects

    if not target_mids and not clear_all:
        return 0

    tracks = draft.get("tracks") or []
    new_tracks = []
    removed_count = len(target_mids)

    for t in tracks:
        if isinstance(t, dict) and t.get("type") in ("effect", "video_effect"):
            if clear_all:
                continue
            segs = t.get("segments") or []
            new_segs = [s for s in segs if isinstance(s, dict) and s.get("material_id") not in target_mids]
            if new_segs:
                t["segments"] = new_segs
                new_tracks.append(t)
        else:
            new_tracks.append(t)

    draft["tracks"] = new_tracks
    return removed_count


def add_sticker(
    draft: Dict[str, Any],
    *,
    resource_id: str,
    start_us: int = 0,
    duration_us: int = 3_000_000,
    track_name: str = "sticker",
    scale: float = 1.0,
    transform_x: float = 0.0,
    transform_y: float = 0.0,
    rotation: float = 0.0,
) -> Dict[str, Any]:
    rid = (resource_id or "").strip()
    if not rid:
        raise ValueError("resource_id sticker rỗng")
    if duration_us <= 0:
        raise ValueError("duration_us phải > 0")

    mats = _materials(draft)
    stickers = _ensure_list(mats, "stickers")
    mid = _new_id()
    stickers.append(
        {
            "id": mid,
            "resource_id": rid,
            "sticker_id": rid,
            "source_platform": 1,
            "type": "sticker",
        }
    )
    track = _get_or_create_track(draft, "sticker", track_name, start_us=start_us, duration_us=duration_us)
    segs = track.setdefault("segments", [])
    sid = _new_id()
    segs.append(
        {
            "id": sid,
            "material_id": mid,
            "target_timerange": _timerange(start_us, duration_us),
            "source_timerange": _timerange(0, duration_us),
            "speed": 1.0,
            "volume": 1.0,
            "visible": True,
            "clip": {
                "alpha": 1.0,
                "flip": {"horizontal": False, "vertical": False},
                "rotation": float(rotation),
                "scale": {"x": float(scale), "y": float(scale)},
                "transform": {"x": float(transform_x), "y": float(transform_y)},
            },
            "extra_material_refs": [],
            "common_keyframes": [],
            "render_index": 14000,
        }
    )
    return {
        "segment_id": sid,
        "material_id": mid,
        "track_id": track["id"],
        "resource_id": rid,
    }


# ---------------------------------------------------------------------------
# enums (read-only catalogue)
# ---------------------------------------------------------------------------


def _enum_list(
    enum_cls: Type[Enum],
    *,
    title_attr: str = "name",
    limit: Optional[int] = None,
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for i, e in enumerate(enum_cls):  # type: ignore[attr-defined]
        if limit is not None and i >= limit:
            break
        meta = e.value
        name = getattr(meta, title_attr, None) or getattr(meta, "name", e.name)
        item: Dict[str, Any] = {
            "member": e.name,
            "name": name,
            "resource_id": getattr(meta, "resource_id", None),
            "effect_id": getattr(meta, "effect_id", None),
        }
        if hasattr(meta, "is_vip"):
            item["is_vip"] = bool(meta.is_vip)
        if hasattr(meta, "duration"):
            item["duration_us"] = int(meta.duration)
        out.append(item)
    return out


def list_enums(
    category: Optional[str] = None,
    *,
    limit: Optional[int] = 50,
) -> Dict[str, Any]:
    """
    List metadata catalogues. category=None → summary counts.
    Categories: filters, effects, face_effects, transitions, masks, mix_modes,
    text_intros, text_outros, text_loops, video_intros, video_outros,
    video_combos, sfx, bubbles
    """
    catalogs = {
        "filters": lambda: _enum_list(FilterType, limit=limit),
        "effects": lambda: _enum_list(VideoSceneEffectType, limit=limit),
        "face_effects": lambda: _enum_list(VideoCharacterEffectType, limit=limit),
        "transitions": lambda: _enum_list(TransitionType, limit=limit),
        "masks": lambda: _enum_list(MaskType, limit=limit),
        "mix_modes": lambda: _enum_list(MixModeType, limit=limit),
        "text_intros": lambda: _enum_list(TextIntro, title_attr="title", limit=limit),
        "text_outros": lambda: _enum_list(TextOutro, title_attr="title", limit=limit),
        "text_loops": lambda: _enum_list(TextLoopAnim, title_attr="title", limit=limit),
        "video_intros": lambda: _enum_list(IntroType, title_attr="title", limit=limit),
        "video_outros": lambda: _enum_list(OutroType, title_attr="title", limit=limit),
        "video_combos": lambda: _enum_list(GroupAnimationType, title_attr="title", limit=limit),
        "sfx": lambda: _enum_list(AudioSceneEffectType, limit=limit),
        "bubbles": lambda: [
            {"slug": k, "name": v["name"], "effect_id": v["effect_id"], "resource_id": v["resource_id"]}
            for k, v in _BUBBLES.items()
        ],
    }

    if category is None or category in ("", "all", "summary"):
        counts = {}
        for k, fn in catalogs.items():
            if k == "bubbles":
                counts[k] = len(_BUBBLES)
            else:
                # full count without building huge lists
                enum_map = {
                    "filters": FilterType,
                    "effects": VideoSceneEffectType,
                    "face_effects": VideoCharacterEffectType,
                    "transitions": TransitionType,
                    "masks": MaskType,
                    "mix_modes": MixModeType,
                    "text_intros": TextIntro,
                    "text_outros": TextOutro,
                    "text_loops": TextLoopAnim,
                    "video_intros": IntroType,
                    "video_outros": OutroType,
                    "video_combos": GroupAnimationType,
                    "sfx": AudioSceneEffectType,
                }
                counts[k] = len(list(enum_map[k])) if k in enum_map else len(fn())
        return {"categories": list(catalogs.keys()), "counts": counts}

    key = category.strip().lower().replace("-", "_")
    # aliases
    aliases = {
        "scene_effects": "effects",
        "character_effects": "face_effects",
        "audio_effects": "sfx",
        "sound_effects": "sfx",
        "intros": "video_intros",
        "outros": "video_outros",
    }
    key = aliases.get(key, key)
    if key not in catalogs:
        raise ValueError(
            f"category không hỗ trợ: {category!r}. "
            f"Hỗ trợ: {', '.join(catalogs)}"
        )
    items = catalogs[key]()
    return {"category": key, "count": len(items), "items": items, "limit": limit}
