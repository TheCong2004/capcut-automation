"""Local materials/texts/set-text/add-text — pure Python (Grok D)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

from engines.local.draft_io import load_raw_draft, save_raw_draft
from engines.local import content as content_eng

router = APIRouter(prefix="/v1/local", tags=["local-python"])


class ProjectBody(BaseModel):
    project: str = Field(..., min_length=1, description="Folder draft hoặc path draft_content.json")


class SetTextBody(BaseModel):
    project: str = Field(..., min_length=1)
    text: str
    segment_id: Optional[str] = None
    material_id: Optional[str] = None
    recalc_style: bool = True
    font_size: Optional[int] = Field(default=None, ge=1, le=200)

    @model_validator(mode="after")
    def _need_id(self) -> "SetTextBody":
        if not self.segment_id and not self.material_id:
            raise ValueError("Cần segment_id hoặc material_id")
        return self


class AddTextBody(BaseModel):
    project: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1)
    start_us: int = Field(..., ge=0)
    duration_us: int = Field(..., gt=0)
    font_size: int = Field(default=15, ge=1, le=200)
    color: Optional[str] = Field(
        default=None,
        description="Màu chữ #RRGGBB (optional)",
    )


class StyleInfoBody(BaseModel):
    project: str = Field(..., min_length=1)
    segment_id: Optional[str] = None
    material_id: Optional[str] = None

    @model_validator(mode="after")
    def _need_id(self) -> "StyleInfoBody":
        if not self.segment_id and not self.material_id:
            raise ValueError("Cần segment_id hoặc material_id")
        return self


@router.post("/materials")
def local_materials(body: ProjectBody):
    try:
        draft, path = load_raw_draft(body.project)
        return {
            "ok": True,
            "path": str(path),
            "materials": content_eng.list_materials(draft),
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.post("/texts")
def local_texts(body: ProjectBody):
    try:
        draft, path = load_raw_draft(body.project)
        texts = content_eng.list_texts(draft)
        return {
            "ok": True,
            "path": str(path),
            "count": len(texts),
            "texts": texts,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.post("/set-text")
def local_set_text(body: SetTextBody):
    try:
        draft, path = load_raw_draft(body.project)
        mat = content_eng.set_text(
            draft,
            body.text,
            segment_id=body.segment_id,
            material_id=body.material_id,
            recalc_style=body.recalc_style,
            font_size=body.font_size,
        )
        save_raw_draft(path, draft)
        return {"ok": True, "path": str(path), "material": mat}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.post("/add-text")
def local_add_text(body: AddTextBody):
    try:
        draft, path = load_raw_draft(body.project)
        result = content_eng.add_text(
            draft,
            body.text,
            body.start_us,
            body.duration_us,
            font_size=body.font_size,
            color=body.color,
        )
        save_raw_draft(path, draft)
        return {"ok": True, "path": str(path), **result}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.post("/text-styles")
def local_text_styles(body: StyleInfoBody):
    """Parse content JSON style ranges for one text material (debug / FE)."""
    try:
        draft, path = load_raw_draft(body.project)
        info = content_eng.get_content_style_info(
            draft,
            segment_id=body.segment_id,
            material_id=body.material_id,
        )
        return {"ok": True, "path": str(path), **info}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
