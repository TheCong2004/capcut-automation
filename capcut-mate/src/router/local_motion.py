"""Local keyframe + transition — pure Python (no capcut-cli)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from engines.local.draft_io import load_raw_draft, save_raw_draft
from engines.local import motion as motion_eng

router = APIRouter(prefix="/v1/local", tags=["local-python"])


class KeyframeBody(BaseModel):
    project: str
    segment_id: str
    property: str = Field(..., description="KFTypePositionX or alias position_x")
    offset_us: int = 0
    value: float = 0.0
    easing: Optional[str] = Field(
        default="linear",
        description="linear | ease-in | ease-out | ease-in-out",
    )


class TransitionBody(BaseModel):
    project: str
    segment_id: str
    name: str = Field(default="叠化", description="Tên transition (alias: 淡入淡出→叠化)")
    duration_us: Optional[int] = Field(
        default=None,
        description="Microseconds; default = TransitionMeta.default_duration",
    )
    replace: bool = True


@router.post("/keyframe")
def local_keyframe(body: KeyframeBody):
    try:
        draft, path = load_raw_draft(body.project)
        kf = motion_eng.add_keyframe(
            draft,
            body.segment_id,
            body.property,
            body.offset_us,
            body.value,
            easing=body.easing,
        )
        save_raw_draft(path, draft)
        return {"ok": True, "path": str(path), "keyframe": kf}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.post("/transition")
def local_transition(body: TransitionBody):
    try:
        draft, path = load_raw_draft(body.project)
        t = motion_eng.add_transition(
            draft,
            body.segment_id,
            body.name,
            body.duration_us,
            replace=body.replace,
        )
        save_raw_draft(path, draft)
        return {"ok": True, "path": str(path), "transition": t}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
