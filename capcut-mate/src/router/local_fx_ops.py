"""Local FX / anim / style endpoints — pure Python (WAVE2 Grok B)."""

from __future__ import annotations

from typing import List, Optional, Union

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from engines.local.draft_io import load_raw_draft, save_raw_draft
from engines.local import fx_ops

router = APIRouter(prefix="/v1/local", tags=["local-python"])


def _err(e: Exception) -> HTTPException:
    if isinstance(e, FileNotFoundError):
        return HTTPException(status_code=404, detail=str(e))
    if isinstance(e, KeyError):
        return HTTPException(status_code=404, detail=str(e))
    if isinstance(e, ValueError):
        return HTTPException(status_code=422, detail=str(e))
    return HTTPException(status_code=500, detail=str(e))


# ── bodies ─────────────────────────────────────────────────────────


class ProjectSeg(BaseModel):
    project: str
    segment_id: str


class BgBlurBody(ProjectSeg):
    level: Union[int, str] = Field(2, description="1–4 or 'off'")


class ChromaBody(ProjectSeg):
    color: str = "#00FF00"
    intensity: float = 0.5
    shadow: float = 0.0
    off: bool = False


class MixModeBody(ProjectSeg):
    mode: str = Field(..., description="正片叠底 / multiply / normal / …")


class TextAnimBody(ProjectSeg):
    intro: Optional[str] = None
    outro: Optional[str] = None
    loop: Optional[str] = None
    intro_duration_us: Optional[int] = None
    outro_duration_us: Optional[int] = None
    loop_duration_us: Optional[int] = None


class ImageAnimBody(ProjectSeg):
    intro: Optional[str] = None
    outro: Optional[str] = None
    combo: Optional[str] = None
    intro_duration_us: Optional[int] = None
    outro_duration_us: Optional[int] = None
    combo_duration_us: Optional[int] = None


class TextStyleBody(ProjectSeg):
    alpha: Optional[float] = None
    vertical: Optional[bool] = None
    shadow: Optional[bool] = None
    shadow_alpha: Optional[float] = None
    shadow_angle: Optional[float] = None
    shadow_color: Optional[str] = None
    shadow_distance: Optional[float] = None
    shadow_smoothing: Optional[float] = None
    border_width: Optional[float] = None
    border_color: Optional[str] = None
    border_alpha: Optional[float] = None
    bg_color: Optional[str] = None
    bg_alpha: Optional[float] = None
    bg_style: Optional[int] = None
    bg_round_radius: Optional[float] = None
    fixed_width: Optional[float] = None
    fixed_height: Optional[float] = None


class BubbleTextBody(ProjectSeg):
    slug: Optional[str] = Field(None, description="rectangle|cloud|heart|…")
    effect_id: Optional[str] = None
    resource_id: Optional[str] = None


class AddSfxBody(BaseModel):
    project: str
    name: str = Field(..., description="SFX name e.g. 回声")
    start_us: int = 0
    duration_us: int = 1_000_000
    track_name: str = "sfx"
    volume: float = 1.0


class AddFilterBody(BaseModel):
    project: str
    name: str
    start_us: int = 0
    duration_us: int = 3_000_000
    intensity: float = 1.0
    track_name: str = "filter"


class AddEffectBody(BaseModel):
    project: str
    name: str
    start_us: int = 0
    duration_us: int = 3_000_000
    track_name: str = "effect"
    face: bool = False


class EffectBatchItem(BaseModel):
    name: str
    start_us: int = 0
    duration_us: int = 3_000_000
    track_name: str = "effect"
    face: bool = False


class AddEffectsBatchBody(BaseModel):
    project: str
    effects: List[EffectBatchItem]


AddEffectsBatchBody.model_rebuild()


class ProjectBody(BaseModel):
    project: str


class RemoveEffectBody(BaseModel):
    project: str
    name: Optional[str] = None
    material_id: Optional[str] = None


class AddStickerBody(BaseModel):
    project: str
    resource_id: str
    start_us: int = 0
    duration_us: int = 3_000_000
    track_name: str = "sticker"
    scale: float = 1.0
    transform_x: float = 0.0
    transform_y: float = 0.0
    rotation: float = 0.0


class EnumsBody(BaseModel):
    category: Optional[str] = Field(
        None,
        description="filters|effects|transitions|masks|mix_modes|text_intros|sfx|bubbles|…",
    )
    limit: Optional[int] = 50


# ── routes ─────────────────────────────────────────────────────────


@router.post("/bg-blur")
def local_bg_blur(body: BgBlurBody):
    try:
        draft, path = load_raw_draft(body.project)
        result = fx_ops.set_bg_blur(draft, body.segment_id, body.level)
        save_raw_draft(path, draft)
        return {"ok": True, "path": str(path), **result}
    except Exception as e:
        raise _err(e) from e


@router.post("/chroma")
def local_chroma(body: ChromaBody):
    try:
        draft, path = load_raw_draft(body.project)
        result = fx_ops.set_chroma(
            draft,
            body.segment_id,
            color=body.color,
            intensity=body.intensity,
            shadow=body.shadow,
            off=body.off,
        )
        save_raw_draft(path, draft)
        return {"ok": True, "path": str(path), **result}
    except Exception as e:
        raise _err(e) from e


@router.post("/mix-mode")
def local_mix_mode(body: MixModeBody):
    try:
        draft, path = load_raw_draft(body.project)
        result = fx_ops.set_mix_mode(draft, body.segment_id, body.mode)
        save_raw_draft(path, draft)
        return {"ok": True, "path": str(path), **result}
    except Exception as e:
        raise _err(e) from e


@router.post("/text-anim")
def local_text_anim(body: TextAnimBody):
    try:
        draft, path = load_raw_draft(body.project)
        result = fx_ops.add_text_anim(
            draft,
            body.segment_id,
            intro=body.intro,
            outro=body.outro,
            loop=body.loop,
            intro_duration_us=body.intro_duration_us,
            outro_duration_us=body.outro_duration_us,
            loop_duration_us=body.loop_duration_us,
        )
        save_raw_draft(path, draft)
        return {"ok": True, "path": str(path), **result}
    except Exception as e:
        raise _err(e) from e


@router.post("/image-anim")
def local_image_anim(body: ImageAnimBody):
    try:
        draft, path = load_raw_draft(body.project)
        result = fx_ops.add_image_anim(
            draft,
            body.segment_id,
            intro=body.intro,
            outro=body.outro,
            combo=body.combo,
            intro_duration_us=body.intro_duration_us,
            outro_duration_us=body.outro_duration_us,
            combo_duration_us=body.combo_duration_us,
        )
        save_raw_draft(path, draft)
        return {"ok": True, "path": str(path), **result}
    except Exception as e:
        raise _err(e) from e


@router.post("/text-style")
def local_text_style(body: TextStyleBody):
    try:
        draft, path = load_raw_draft(body.project)
        result = fx_ops.set_text_style(
            draft,
            body.segment_id,
            alpha=body.alpha,
            vertical=body.vertical,
            shadow=body.shadow,
            shadow_alpha=body.shadow_alpha,
            shadow_angle=body.shadow_angle,
            shadow_color=body.shadow_color,
            shadow_distance=body.shadow_distance,
            shadow_smoothing=body.shadow_smoothing,
            border_width=body.border_width,
            border_color=body.border_color,
            border_alpha=body.border_alpha,
            bg_color=body.bg_color,
            bg_alpha=body.bg_alpha,
            bg_style=body.bg_style,
            bg_round_radius=body.bg_round_radius,
            fixed_width=body.fixed_width,
            fixed_height=body.fixed_height,
        )
        save_raw_draft(path, draft)
        return {"ok": True, "path": str(path), **result}
    except Exception as e:
        raise _err(e) from e


@router.post("/bubble-text")
def local_bubble_text(body: BubbleTextBody):
    try:
        draft, path = load_raw_draft(body.project)
        result = fx_ops.set_bubble_text(
            draft,
            body.segment_id,
            slug=body.slug,
            effect_id=body.effect_id,
            resource_id=body.resource_id,
        )
        save_raw_draft(path, draft)
        return {"ok": True, "path": str(path), **result}
    except Exception as e:
        raise _err(e) from e


@router.post("/add-sfx")
def local_add_sfx(body: AddSfxBody):
    try:
        draft, path = load_raw_draft(body.project)
        result = fx_ops.add_sfx(
            draft,
            name=body.name,
            start_us=body.start_us,
            duration_us=body.duration_us,
            track_name=body.track_name,
            volume=body.volume,
        )
        save_raw_draft(path, draft)
        return {"ok": True, "path": str(path), **result}
    except Exception as e:
        raise _err(e) from e


@router.post("/add-filter")
def local_add_filter(body: AddFilterBody):
    try:
        draft, path = load_raw_draft(body.project)
        result = fx_ops.add_filter(
            draft,
            name=body.name,
            start_us=body.start_us,
            duration_us=body.duration_us,
            intensity=body.intensity,
            track_name=body.track_name,
        )
        save_raw_draft(path, draft)
        return {"ok": True, "path": str(path), **result}
    except Exception as e:
        raise _err(e) from e


@router.post("/add-effect")
def local_add_effect(body: AddEffectBody):
    try:
        draft, path = load_raw_draft(body.project)
        result = fx_ops.add_effect(
            draft,
            name=body.name,
            start_us=body.start_us,
            duration_us=body.duration_us,
            track_name=body.track_name,
            face=body.face,
        )
        save_raw_draft(path, draft)
        return {"ok": True, "path": str(path), **result}
    except Exception as e:
        raise _err(e) from e


@router.post("/project-effects")
def local_project_effects(body: ProjectBody):
    try:
        draft, _ = load_raw_draft(body.project)
        effects = fx_ops.list_project_effects(draft)
        return {"ok": True, "effects": effects}
    except Exception as e:
        raise _err(e) from e


@router.post("/remove-effect")
def local_remove_effect(body: RemoveEffectBody):
    try:
        draft, path = load_raw_draft(body.project)
        count = fx_ops.remove_project_effect(
            draft, name=body.name, material_id=body.material_id
        )
        save_raw_draft(path, draft)
        return {"ok": True, "removed": count, "path": str(path)}
    except Exception as e:
        raise _err(e) from e


@router.post("/add-effects-batch")
def local_add_effects_batch(body: AddEffectsBatchBody):
    try:
        draft, path = load_raw_draft(body.project)
        effects_dicts = [
            item.model_dump() if hasattr(item, "model_dump") else dict(item)
            for item in body.effects
        ]
        results = fx_ops.add_effects_batch(draft, effects_dicts)
        save_raw_draft(path, draft)
        return {"ok": True, "count": len(results), "path": str(path), "results": results}
    except Exception as e:
        raise _err(e) from e


@router.post("/add-sticker")
def local_add_sticker(body: AddStickerBody):
    try:
        draft, path = load_raw_draft(body.project)
        result = fx_ops.add_sticker(
            draft,
            resource_id=body.resource_id,
            start_us=body.start_us,
            duration_us=body.duration_us,
            track_name=body.track_name,
            scale=body.scale,
            transform_x=body.transform_x,
            transform_y=body.transform_y,
            rotation=body.rotation,
        )
        save_raw_draft(path, draft)
        return {"ok": True, "path": str(path), **result}
    except Exception as e:
        raise _err(e) from e


@router.post("/enums")
def local_enums(body: EnumsBody):
    try:
        result = fx_ops.list_enums(body.category, limit=body.limit)
        return {"ok": True, **result}
    except Exception as e:
        raise _err(e) from e
