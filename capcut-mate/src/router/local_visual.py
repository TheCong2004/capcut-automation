"""Local mask + transform — pure Python (engines.local.visual)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from engines.local.draft_io import load_raw_draft, save_raw_draft
from engines.local import visual as visual_eng

router = APIRouter(prefix="/v1/local", tags=["local-python"])


class MaskBody(BaseModel):
    project: str = Field(..., description="Draft folder or draft_content.json path")
    segment_id: str
    name: str = Field("圆形", description="Mask type CN/EN: 圆形/circle, 矩形/rectangle, …")
    width: int = Field(512, description="Mask width in pixels (rectangle; size base for others)")
    height: int = Field(512, description="Mask height in pixels → main size ratio")
    feather: float = Field(0.0, ge=0, le=100, description="Feather 0–100")
    off: bool = False
    # Geometry (JianYing / Mate add_masks parity)
    center_x: float = Field(0.0, description="Mask center X offset in pixels from material center")
    center_y: float = Field(0.0, description="Mask center Y offset in pixels from material center")
    rotation: float = Field(0.0, description="Rotation degrees clockwise")
    invert: bool = False
    round_corner: float = Field(
        0.0,
        ge=0,
        le=100,
        description="Rectangle corner radius 0–100 (rectangle only)",
    )


class TransformBody(BaseModel):
    project: str
    segment_id: str
    scale_x: Optional[float] = None
    scale_y: Optional[float] = None
    transform_x: Optional[float] = None
    transform_y: Optional[float] = None
    rotation: Optional[float] = None
    alpha: Optional[float] = Field(None, ge=0, le=1)


@router.post("/mask")
def local_mask(body: MaskBody):
    try:
        draft, path = load_raw_draft(body.project)
        m = visual_eng.set_mask(
            draft,
            body.segment_id,
            name=body.name,
            width=body.width,
            height=body.height,
            feather=body.feather,
            off=body.off,
            center_x=body.center_x,
            center_y=body.center_y,
            rotation=body.rotation,
            invert=body.invert,
            round_corner=body.round_corner,
        )
        save_raw_draft(path, draft)
        return {"ok": True, "path": str(path), "mask": m}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.post("/transform")
def local_transform(body: TransformBody):
    try:
        draft, path = load_raw_draft(body.project)
        clip = visual_eng.set_transform(
            draft,
            body.segment_id,
            scale_x=body.scale_x,
            scale_y=body.scale_y,
            transform_x=body.transform_x,
            transform_y=body.transform_y,
            rotation=body.rotation,
            alpha=body.alpha,
        )
        save_raw_draft(path, draft)
        return {"ok": True, "path": str(path), "clip": clip}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
