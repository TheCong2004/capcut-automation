"""
Mask + clip transform — pure Python on raw CapCut/JianYing draft.

Schema (aligned with pyJianYingDraft Mask.export_json + materials.masks):
- Mask material lives in ``materials.masks`` (and ``common_mask`` if present)
- Segment references it via ``extra_material_refs``
- Geometry: center in half-material units; height = size ratio of material height;
  feather / roundCorner stored 0..1

No subprocess / capcut-cli.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from .inspect import find_segment


# ---------------------------------------------------------------------------
# Mask catalogue (JianYing / pyJianYingDraft MaskType — resource ids)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class MaskMeta:
    name: str
    resource_type: str
    resource_id: str
    effect_id: str
    md5: str
    default_aspect_ratio: float


# Source: src/pyJianYingDraft/metadata/mask_meta.py
_MASK_TABLE: Tuple[MaskMeta, ...] = (
    MaskMeta("线性", "line", "6791652175668843016", "636071", "1f467b8b9bb94cecc46d916219b7940a", 1.0),
    MaskMeta("镜面", "mirror", "6791699060140020232", "636073", "b2c0516d1f737f4542fb9b2862907817", 1.0),
    MaskMeta("圆形", "circle", "6791700663249146381", "636075", "9a55eae0e99ee6d1ecbc6defaf0501ec", 1.0),
    MaskMeta("矩形", "rectangle", "6791700809454195207", "636077", "ef361d96c456cd6077c76d737f98898d", 1.0),
    MaskMeta("爱心", "geometric_shape", "6794051276482023949", "636079", "0bf09fa1e3a32464fed4f71e49a8ab01", 1.115),
    MaskMeta("星形", "geometric_shape", "6794051169434997255", "636081", "155612dee601d3f5422a3fbeabc7610c", 1.05),
)

# Aliases: EN slug / CN name / resource_type → canonical CN name
_MASK_ALIASES: Dict[str, str] = {
    "线性": "线性",
    "linear": "线性",
    "line": "线性",
    "split": "线性",
    "镜面": "镜面",
    "mirror": "镜面",
    "filmstrip": "镜面",
    "圆形": "圆形",
    "circle": "圆形",
    "矩形": "矩形",
    "rectangle": "矩形",
    "rect": "矩形",
    "爱心": "爱心",
    "heart": "爱心",
    "星形": "星形",
    "star": "星形",
    "stars": "星形",
}

_MASK_BY_NAME: Dict[str, MaskMeta] = {m.name: m for m in _MASK_TABLE}

_MASK_POOL_KEYS = ("masks", "common_mask")


def list_mask_names() -> List[str]:
    """Canonical CN names supported for local mask."""
    return [m.name for m in _MASK_TABLE]


def resolve_mask_meta(name: str) -> MaskMeta:
    """Resolve CN/EN/slug to MaskMeta; raise ValueError if unknown."""
    if not name or not str(name).strip():
        raise ValueError("mask name rỗng / empty mask name")
    key = str(name).strip()
    canonical = _MASK_ALIASES.get(key) or _MASK_ALIASES.get(key.lower())
    if canonical is None:
        # allow exact CN table hit even if not in aliases
        if key in _MASK_BY_NAME:
            return _MASK_BY_NAME[key]
        supported = ", ".join(list_mask_names())
        raise ValueError(
            f"Mask type không hỗ trợ: {name!r}. / Unsupported mask: {name!r}. "
            f"Supported: {supported}"
        )
    return _MASK_BY_NAME[canonical]


def _ensure_list(materials: Dict[str, Any], key: str) -> List[Any]:
    val = materials.get(key)
    if not isinstance(val, list):
        materials[key] = []
        return materials[key]
    return val


def _mask_pools(draft: Dict[str, Any]) -> List[List[Any]]:
    """Return writable mask material lists (masks always; common_mask if present)."""
    materials = draft.setdefault("materials", {})
    if not isinstance(materials, dict):
        draft["materials"] = {}
        materials = draft["materials"]
    pools: List[List[Any]] = [_ensure_list(materials, "masks")]
    # CapCut 8.x+ may already use common_mask — dual-write only if key exists
    if "common_mask" in materials:
        pools.append(_ensure_list(materials, "common_mask"))
    return pools


def _iter_mask_materials(draft: Dict[str, Any]) -> List[Dict[str, Any]]:
    materials = draft.get("materials") or {}
    out: List[Dict[str, Any]] = []
    if not isinstance(materials, dict):
        return out
    for key in _MASK_POOL_KEYS:
        for m in materials.get(key) or []:
            if isinstance(m, dict) and m.get("id"):
                out.append(m)
    return out


def _mask_ids_on_segment(draft: Dict[str, Any], seg: Dict[str, Any]) -> List[str]:
    refs = seg.get("extra_material_refs") or []
    if not isinstance(refs, list):
        return []
    known = {m["id"] for m in _iter_mask_materials(draft)}
    return [r for r in refs if isinstance(r, str) and r in known]


def _material_size(draft: Dict[str, Any], seg: Dict[str, Any]) -> Tuple[int, int]:
    """Material pixel size for the segment; fall back to canvas."""
    mid = seg.get("material_id")
    materials = draft.get("materials") or {}
    if isinstance(materials, dict) and mid:
        for bucket in ("videos", "images", "photos", "stickers"):
            for mat in materials.get(bucket) or []:
                if not isinstance(mat, dict) or mat.get("id") != mid:
                    continue
                w = mat.get("width") or mat.get("material_width") or mat.get("source_width")
                h = mat.get("height") or mat.get("material_height") or mat.get("source_height")
                if w and h:
                    return int(w), int(h)
    canvas = draft.get("canvas_config") or {}
    cw = int(canvas.get("width") or 1920)
    ch = int(canvas.get("height") or 1080)
    return cw, ch


def _remove_mask_from_segment(draft: Dict[str, Any], seg: Dict[str, Any]) -> List[str]:
    """Detach mask refs from segment; drop materials from pools. Returns removed ids."""
    removed = _mask_ids_on_segment(draft, seg)
    # Legacy seed field
    seg.pop("mask", None)

    if removed:
        refs = seg.get("extra_material_refs")
        if isinstance(refs, list):
            seg["extra_material_refs"] = [r for r in refs if r not in removed]
        rid_set = set(removed)
        materials = draft.get("materials") or {}
        if isinstance(materials, dict):
            for key in _MASK_POOL_KEYS:
                pool = materials.get(key)
                if isinstance(pool, list):
                    materials[key] = [
                        m for m in pool if not (isinstance(m, dict) and m.get("id") in rid_set)
                    ]
    return removed


def _build_mask_material(
    meta: MaskMeta,
    *,
    material_width: int,
    material_height: int,
    center_x_px: float,
    center_y_px: float,
    width_px: float,
    height_px: float,
    feather: float,
    rotation: float,
    invert: bool,
    round_corner: float,
) -> Dict[str, Any]:
    """
    Build materials.masks[] entry matching pyJianYingDraft Mask.export_json.

    Geometry notes (JianYing):
    - centerX/Y: pixel offset from material center, stored in *half-material* units
      (px / (dim/2))
    - height (size): height_px / material_height  (main size ratio)
    - width: for rectangle = width_px / material_width; else derived from aspect
    - feather, roundCorner: API 0..100 → stored 0..1
    """
    mw = max(int(material_width), 1)
    mh = max(int(material_height), 1)

    size = float(height_px) / mh  # main dimension ratio
    if size <= 0:
        size = 0.5

    is_rect = meta.name == "矩形"
    if is_rect:
        width_ratio = float(width_px) / mw if width_px else size
    else:
        # Match VideoSegment.add_mask width formula
        width_ratio = size * mh * meta.default_aspect_ratio / mw

    # Clamp feather / roundCorner inputs (0–100 style, like add_masks)
    feather_in = float(feather)
    if feather_in < 0 or feather_in > 100:
        raise ValueError(f"feather must be 0..100, got {feather}")
    rc_in = float(round_corner)
    if rc_in < 0 or rc_in > 100:
        raise ValueError(f"round_corner must be 0..100, got {round_corner}")
    if not is_rect and rc_in != 0:
        raise ValueError("round_corner chỉ dùng cho mask 矩形 / rectangle only")

    mid = uuid.uuid4().hex
    return {
        "config": {
            "aspectRatio": meta.default_aspect_ratio,
            "centerX": float(center_x_px) / (mw / 2.0),
            "centerY": float(center_y_px) / (mh / 2.0),
            "feather": feather_in / 100.0,
            "height": size,
            "invert": bool(invert),
            "rotation": float(rotation),
            "roundCorner": (rc_in / 100.0) if is_rect else 0.0,
            "width": width_ratio,
        },
        "id": mid,
        "name": meta.name,
        "platform": "all",
        "position_info": "",
        "resource_type": meta.resource_type,
        "resource_id": meta.resource_id,
        "type": "mask",
        # effect_id kept for tooling parity (not always in export_json)
        "effect_id": meta.effect_id,
        "category": "video",
        "category_id": "",
        "category_name": "",
    }


def set_mask(
    draft: Dict[str, Any],
    segment_id: str,
    *,
    name: str = "圆形",
    width: int = 512,
    height: int = 512,
    feather: float = 0.0,
    off: bool = False,
    center_x: float = 0.0,
    center_y: float = 0.0,
    rotation: float = 0.0,
    invert: bool = False,
    round_corner: float = 0.0,
) -> Dict[str, Any]:
    """
    Apply or remove a mask on a segment.

    Parameters mirror Mate ``add_masks`` (pixel width/height/X/Y, feather 0–100).
    Writes JianYing-compatible ``materials.masks`` + ``extra_material_refs``.
    """
    seg = find_segment(draft, segment_id)
    if seg is None:
        raise KeyError(f"segment_id không tồn tại: {segment_id}")

    if off:
        removed = _remove_mask_from_segment(draft, seg)
        return {"off": True, "segment_id": segment_id, "removed_ids": removed}

    meta = resolve_mask_meta(name)
    mw, mh = _material_size(draft, seg)

    # Replace any existing mask (one mask per segment)
    _remove_mask_from_segment(draft, seg)

    material = _build_mask_material(
        meta,
        material_width=mw,
        material_height=mh,
        center_x_px=center_x,
        center_y_px=center_y,
        width_px=float(width),
        height_px=float(height),
        feather=feather,
        rotation=rotation,
        invert=invert,
        round_corner=round_corner,
    )

    for pool in _mask_pools(draft):
        # Primary pool is masks; if common_mask also returned, dual-write same object id
        if not any(isinstance(x, dict) and x.get("id") == material["id"] for x in pool):
            pool.append(dict(material))

    refs = seg.setdefault("extra_material_refs", [])
    if not isinstance(refs, list):
        seg["extra_material_refs"] = []
        refs = seg["extra_material_refs"]
    if material["id"] not in refs:
        refs.append(material["id"])

    return material


def set_transform(
    draft: Dict[str, Any],
    segment_id: str,
    *,
    scale_x: Optional[float] = None,
    scale_y: Optional[float] = None,
    transform_x: Optional[float] = None,
    transform_y: Optional[float] = None,
    rotation: Optional[float] = None,
    alpha: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Patch ``segment.clip`` scale / transform / rotation / alpha.

    Coordinates follow CapCut clip space (transform ~ half-canvas units).
    """
    if all(
        v is None
        for v in (scale_x, scale_y, transform_x, transform_y, rotation, alpha)
    ):
        raise ValueError(
            "Cần ít nhất một field transform / Need at least one of: "
            "scale_x, scale_y, transform_x, transform_y, rotation, alpha"
        )

    seg = find_segment(draft, segment_id)
    if seg is None:
        raise KeyError(f"segment_id không tồn tại: {segment_id}")

    clip = seg.get("clip")
    if not isinstance(clip, dict):
        clip = {
            "alpha": 1.0,
            "flip": {"horizontal": False, "vertical": False},
            "rotation": 0.0,
            "scale": {"x": 1.0, "y": 1.0},
            "transform": {"x": 0.0, "y": 0.0},
        }
        seg["clip"] = clip
    else:
        clip.setdefault("flip", {"horizontal": False, "vertical": False})

    scale = clip.get("scale")
    if not isinstance(scale, dict):
        scale = {"x": 1.0, "y": 1.0}
        clip["scale"] = scale
    transform = clip.get("transform")
    if not isinstance(transform, dict):
        transform = {"x": 0.0, "y": 0.0}
        clip["transform"] = transform

    if scale_x is not None:
        if float(scale_x) <= 0:
            raise ValueError(f"scale_x must be > 0, got {scale_x}")
        scale["x"] = float(scale_x)
    if scale_y is not None:
        if float(scale_y) <= 0:
            raise ValueError(f"scale_y must be > 0, got {scale_y}")
        scale["y"] = float(scale_y)
    if transform_x is not None:
        transform["x"] = float(transform_x)
    if transform_y is not None:
        transform["y"] = float(transform_y)
    if rotation is not None:
        clip["rotation"] = float(rotation)
    if alpha is not None:
        a = float(alpha)
        if a < 0.0 or a > 1.0:
            raise ValueError(f"alpha must be 0..1, got {alpha}")
        clip["alpha"] = a

    return clip


def get_segment_mask(draft: Dict[str, Any], segment_id: str) -> Optional[Dict[str, Any]]:
    """Return the mask material attached to the segment, if any."""
    seg = find_segment(draft, segment_id)
    if seg is None:
        raise KeyError(f"segment_id không tồn tại: {segment_id}")
    ids = _mask_ids_on_segment(draft, seg)
    if not ids:
        return None
    mid = ids[0]
    for m in _iter_mask_materials(draft):
        if m.get("id") == mid:
            return m
    return None
