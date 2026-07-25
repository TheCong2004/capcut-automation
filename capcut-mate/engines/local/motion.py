"""
Keyframe + transition on raw CapCut draft — pure Python (no capcut-cli).

Port notes (Grok B):
- Keyframe schema matches pyJianYingDraft KeyframeList / CapCut common_keyframes.
- Easing presets (ease-in/out/in-out) write FreeCurveInOut handles like CapCut UI
  (ratios from capcut-cli oracle; reimplemented in Python, no subprocess).
- Transition materials resolve resource_id / effect_id from TransitionType metadata.
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional, Tuple

from src.pyJianYingDraft.keyframe import KeyframeProperty
from src.pyJianYingDraft.metadata import TransitionType
from src.pyJianYingDraft.metadata.effect_meta import TransitionMeta

from .inspect import find_segment

# ---------------------------------------------------------------------------
# Property aliases (CLI short names + native KFType*)
# ---------------------------------------------------------------------------

_PROPERTY_ALIASES: Dict[str, str] = {
    "position_x": "KFTypePositionX",
    "position_y": "KFTypePositionY",
    "rotation": "KFTypeRotation",
    "scale_x": "KFTypeScaleX",
    "scale_y": "KFTypeScaleY",
    "uniform_scale": "UNIFORM_SCALE",
    "alpha": "KFTypeAlpha",
    "saturation": "KFTypeSaturation",
    "contrast": "KFTypeContrast",
    "brightness": "KFTypeBrightness",
    "volume": "KFTypeVolume",
    # common CapCut alternate
    "KFTypeUniformScale": "UNIFORM_SCALE",
}

_VALID_PROPERTIES = {p.value for p in KeyframeProperty} | set(_PROPERTY_ALIASES.values())

# ---------------------------------------------------------------------------
# Easing (CapCut UI FreeCurveInOut encoding — pure Python port)
# ---------------------------------------------------------------------------

EasingName = str  # "linear" | "ease-in" | "ease-out" | "ease-in-out"

_EASING_PROFILES: Dict[str, Dict[str, float]] = {
    "ease-in": {"startRightXRatio": 0.42, "endLeftXRatio": 0.0},
    "ease-out": {"startRightXRatio": 0.32, "endLeftXRatio": -0.4},
    "ease-in-out": {"startRightXRatio": 0.42, "endLeftXRatio": -0.42},
}
_EASE_OUT_RIGHT_Y_RATIO = 0.94

# Transition name aliases → Jianying/CapCut meta display name
_TRANSITION_ALIASES: Dict[str, str] = {
    "淡入淡出": "叠化",
    "fade": "叠化",
    "crossfade": "叠化",
    "dissolve": "叠化",
    "fade-in-out": "叠化",
}


def resolve_property(property_name: str) -> str:
    """Map alias or KFType* to canonical property_type string."""
    raw = (property_name or "").strip()
    if not raw:
        raise ValueError("property không được rỗng")
    if raw in _PROPERTY_ALIASES:
        return _PROPERTY_ALIASES[raw]
    if raw in _VALID_PROPERTIES:
        return raw
    # try KeyframeProperty enum names
    try:
        return KeyframeProperty[raw].value
    except KeyError:
        pass
    raise ValueError(
        f"property không hỗ trợ: {property_name!r}. "
        f"Dùng KFType* hoặc alias: {', '.join(sorted(_PROPERTY_ALIASES))}"
    )


def resolve_easing(easing: Optional[str]) -> str:
    if easing is None or easing == "" or easing == "linear":
        return "linear"
    if easing in _EASING_PROFILES:
        return easing
    raise ValueError(
        f"easing không hỗ trợ: {easing!r}. "
        f"Supported: linear, {', '.join(sorted(_EASING_PROFILES))}"
    )


def resolve_transition_meta(name: str) -> TransitionMeta:
    """Resolve transition by Chinese name / alias → TransitionMeta with real IDs."""
    raw = (name or "").strip()
    if not raw:
        raise ValueError("transition name không được rỗng")
    resolved = _TRANSITION_ALIASES.get(raw, raw)
    resolved = _TRANSITION_ALIASES.get(resolved.lower(), resolved)

    # Enum member name (from_name strips space/underscore)
    try:
        return TransitionType.from_name(resolved).value
    except ValueError:
        pass

    # Match display name (meta.name)
    needle = resolved.lower().replace(" ", "").replace("_", "")
    for t in TransitionType:
        meta = t.value
        if meta.name == resolved:
            return meta
        if meta.name.lower().replace(" ", "").replace("_", "") == needle:
            return meta

    raise ValueError(
        f"Không tìm thấy transition: {name!r} "
        f"(thử '叠化', '上移', '向下擦除', … từ TransitionType metadata)"
    )


def _ctrl(x: float = 0.0, y: float = 0.0) -> Dict[str, float]:
    return {"x": float(x), "y": float(y)}


def _is_zero_ctrl(c: Optional[Dict[str, Any]]) -> bool:
    if not isinstance(c, dict):
        return True
    return float(c.get("x") or 0) == 0.0 and float(c.get("y") or 0) == 0.0


def _find_neighbours(
    klist: List[Dict[str, Any]], time_offset: int
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    prev = next_ = None
    for k in klist:
        if not isinstance(k, dict):
            continue
        to = int(k.get("time_offset") or 0)
        if to < time_offset and (prev is None or to > int(prev.get("time_offset") or 0)):
            prev = k
        if to > time_offset and (next_ is None or to < int(next_.get("time_offset") or 0)):
            next_ = k
    return prev, next_


def _clear_facing_handles(klist: List[Dict[str, Any]], time_offset: int) -> None:
    prev, next_ = _find_neighbours(klist, time_offset)
    if prev is not None:
        prev["right_control"] = _ctrl()
        if _is_zero_ctrl(prev.get("left_control")):
            prev["curveType"] = "Line"
    if next_ is not None:
        next_["left_control"] = _ctrl()
        if _is_zero_ctrl(next_.get("right_control")):
            next_["curveType"] = "Line"


def _apply_easing(
    klist: List[Dict[str, Any]],
    entry: Dict[str, Any],
    easing: str,
) -> bool:
    """Stamp FreeCurveInOut handles on entry + neighbours. False if lone keyframe."""
    profile = _EASING_PROFILES[easing]
    time_offset = int(entry["time_offset"])

    def right_y(from_v: float, to_v: float) -> float:
        if easing == "ease-out":
            return round(_EASE_OUT_RIGHT_Y_RATIO * (to_v - from_v), 6)
        return 0.0

    prev, next_ = _find_neighbours(klist, time_offset)
    if prev is None and next_ is None:
        return False

    entry["curveType"] = "FreeCurveInOut"
    if prev is not None:
        interval = time_offset - int(prev.get("time_offset") or 0)
        prev_val = float((prev.get("values") or [0.0])[0])
        entry_val = float((entry.get("values") or [0.0])[0])
        prev["curveType"] = "FreeCurveInOut"
        prev["right_control"] = _ctrl(
            round(profile["startRightXRatio"] * interval),
            right_y(prev_val, entry_val),
        )
        entry["left_control"] = _ctrl(round(profile["endLeftXRatio"] * interval), 0.0)
    if next_ is not None:
        interval = int(next_.get("time_offset") or 0) - time_offset
        entry_val = float((entry.get("values") or [0.0])[0])
        next_val = float((next_.get("values") or [0.0])[0])
        next_["curveType"] = "FreeCurveInOut"
        next_["left_control"] = _ctrl(round(profile["endLeftXRatio"] * interval), 0.0)
        entry["right_control"] = _ctrl(
            round(profile["startRightXRatio"] * interval),
            right_y(entry_val, next_val),
        )
    return True


def add_keyframe(
    draft: Dict[str, Any],
    segment_id: str,
    property_name: str,
    offset_us: int,
    value: float,
    *,
    easing: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Add (or upsert same time_offset) a keyframe on a segment.

    Returns the keyframe dict written into the draft, plus optional warning keys.
    """
    seg = find_segment(draft, segment_id)
    if seg is None:
        raise KeyError(f"segment_id không tồn tại: {segment_id}")

    prop = resolve_property(property_name)
    ease = resolve_easing(easing)
    offset_us = int(offset_us)
    value = float(value)

    ck: List[Dict[str, Any]] = seg.setdefault("common_keyframes", [])
    if not isinstance(ck, list):
        raise ValueError("segment.common_keyframes phải là list")

    bucket: Optional[Dict[str, Any]] = None
    for b in ck:
        if isinstance(b, dict) and b.get("property_type") == prop:
            bucket = b
            break
    if bucket is None:
        bucket = {
            "id": uuid.uuid4().hex,
            "property_type": prop,
            "material_id": "",
            "keyframe_list": [],
        }
        ck.append(bucket)

    klist: List[Dict[str, Any]] = bucket.setdefault("keyframe_list", [])
    if not isinstance(klist, list):
        raise ValueError("keyframe_list phải là list")

    # Upsert same time_offset
    existing: Optional[Dict[str, Any]] = None
    for k in klist:
        if isinstance(k, dict) and int(k.get("time_offset") or 0) == offset_us:
            existing = k
            break

    if existing is not None:
        existing["values"] = [value]
        kf = existing
        # re-apply easing after value change
        if ease != "linear":
            if not _apply_easing(klist, kf, ease):
                kf["curveType"] = "Line"
                kf["left_control"] = _ctrl()
                kf["right_control"] = _ctrl()
                kf["_easing_warning"] = (
                    f"easing '{ease}' has no adjacent keyframe; wrote linear"
                )
        else:
            _clear_facing_handles(klist, offset_us)
            kf["curveType"] = "Line"
            kf["left_control"] = _ctrl()
            kf["right_control"] = _ctrl()
    else:
        kf = {
            "id": uuid.uuid4().hex,
            "time_offset": offset_us,
            "values": [value],
            "curveType": "Line",
            "graphID": "",
            "left_control": _ctrl(),
            "right_control": _ctrl(),
        }
        if ease != "linear":
            if not _apply_easing(klist, kf, ease):
                kf["_easing_warning"] = (
                    f"easing '{ease}' has no adjacent keyframe; wrote linear"
                )
        else:
            _clear_facing_handles(klist, offset_us)
        klist.append(kf)

    klist.sort(key=lambda x: int(x.get("time_offset") or 0))
    # strip internal warning from stored draft if present — keep on return copy
    warning = kf.pop("_easing_warning", None)
    out = dict(kf)
    if warning:
        out["warning"] = warning
    out["property_type"] = prop
    out["easing"] = ease
    return out


def add_transition(
    draft: Dict[str, Any],
    segment_id: str,
    name: str,
    duration_us: Optional[int] = None,
    *,
    replace: bool = True,
) -> Dict[str, Any]:
    """
    Attach a transition material to a segment with real resource_id / effect_id.

    If the segment already has a transition ref and ``replace`` is True (default),
    remove the old material entry and ref first.
    """
    seg = find_segment(draft, segment_id)
    if seg is None:
        raise KeyError(f"segment_id không tồn tại: {segment_id}")

    meta = resolve_transition_meta(name)
    dur = int(duration_us) if duration_us is not None else int(meta.default_duration)
    if dur <= 0:
        raise ValueError(f"duration_us phải > 0, got {dur}")

    materials = draft.setdefault("materials", {})
    if not isinstance(materials, dict):
        raise ValueError("draft.materials phải là object")
    transitions: List[Dict[str, Any]] = materials.setdefault("transitions", [])
    if not isinstance(transitions, list):
        raise ValueError("materials.transitions phải là list")

    refs: List[Any] = seg.setdefault("extra_material_refs", [])
    if not isinstance(refs, list):
        raise ValueError("segment.extra_material_refs phải là list")

    # Existing transition materials referenced by this segment
    transition_ids = {
        t.get("id")
        for t in transitions
        if isinstance(t, dict) and t.get("type") == "transition"
    }
    existing_refs = [r for r in refs if r in transition_ids]
    if existing_refs and not replace:
        raise ValueError(
            f"Segment đã có transition (material {existing_refs[0]}). "
            f"Gọi lại với replace=true hoặc xóa ref trước."
        )
    if existing_refs:
        remove = set(existing_refs)
        materials["transitions"] = [
            t
            for t in transitions
            if not (isinstance(t, dict) and t.get("id") in remove)
        ]
        transitions = materials["transitions"]
        seg["extra_material_refs"] = [r for r in refs if r not in remove]
        refs = seg["extra_material_refs"]
        # drop legacy inline field if present
        seg.pop("transition", None)

    tid = uuid.uuid4().hex
    tmat: Dict[str, Any] = {
        "category_id": "",
        "category_name": "",
        "duration": dur,
        "effect_id": meta.effect_id,
        "id": tid,
        "is_overlap": bool(meta.is_overlap),
        "name": meta.name,
        "platform": "all",
        "resource_id": meta.resource_id,
        "type": "transition",
    }
    transitions.append(tmat)
    refs.append(tid)

    # Optional convenience pointer (not always present in CapCut exports;
    # material + extra_material_refs is the canonical link).
    seg["transition"] = {
        "material_id": tid,
        "duration": dur,
        "name": meta.name,
        "resource_id": meta.resource_id,
        "effect_id": meta.effect_id,
    }
    return tmat
