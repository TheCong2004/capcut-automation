"""WAVE2 Grok D — caption / ASS / text-ranges / translate (pure Python)."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

from engines.local.draft_io import load_raw_draft, save_raw_draft
from engines.local import caption_ops as cap

router = APIRouter(prefix="/v1/local", tags=["local-python"])


# ── bodies ──────────────────────────────────────────────────────────


class ImportAssBody(BaseModel):
    project: str = Field(..., min_length=1)
    ass: Optional[str] = Field(None, description="Nội dung ASS/SSA")
    ass_path: Optional[str] = Field(None, description="Path file .ass trên máy BE")
    font_size: float = Field(5.0, ge=1.0, le=200.0)
    time_offset_us: int = 0
    transform_y: float = -0.8
    replace: bool = False


class TextRangeItem(BaseModel):
    start: int = Field(..., ge=0, description="Code-unit index inclusive")
    end: int = Field(..., gt=0, description="Code-unit index exclusive")
    font_color: Optional[str] = None
    font_size: Optional[float] = None
    font_alpha: Optional[float] = Field(None, ge=0.0, le=1.0)
    bold: Optional[bool] = None
    italic: Optional[bool] = None
    underline: Optional[bool] = None


class TextRangesBody(BaseModel):
    project: str = Field(..., min_length=1)
    segment_id: Optional[str] = None
    material_id: Optional[str] = None
    ranges: Optional[List[TextRangeItem]] = None
    styles: Optional[List[TextRangeItem]] = Field(
        None, description="Alias of ranges (CLI --styles)"
    )
    range_unit: str = Field(
        "code_unit",
        description="code_unit (default, match import-srt) | byte (CLI UTF-16LE bytes)",
    )

    @model_validator(mode="after")
    def _need_id_and_ranges(self) -> "TextRangesBody":
        if not self.segment_id and not self.material_id:
            raise ValueError("Cần segment_id hoặc material_id")
        if not self.ranges and not self.styles:
            raise ValueError("Cần ranges hoặc styles (list)")
        return self


class ExportSrtBody(BaseModel):
    project: str = Field(..., min_length=1)
    granularity: str = Field(
        "line",
        description="line | word — word chia mỗi segment thành cue theo từ (timing nội suy)",
    )


class CaptionBody(BaseModel):
    project: str = Field(..., min_length=1)
    audio: Optional[str] = Field(None, description="Path file audio local")
    from_segment: Optional[str] = Field(None, description="segment_id audio/video trong draft")
    whisper_cmd: Optional[str] = Field(None, description="Binary whisper (default: whisper)")
    whisper_model: str = "base"
    language: str = "auto"
    engine: str = Field(
        "auto",
        description="auto | faster-whisper | openai-whisper | binary",
    )
    font_size: float = Field(5.0, ge=1.0, le=200.0)
    replace: bool = False
    transform_y: float = -0.8


class TranslateBody(BaseModel):
    project: str = Field(..., min_length=1)
    to: str = Field(..., min_length=1, description="Ngôn ngữ đích (es, vi, French, …)")
    from_lang: str = Field("auto", alias="from")
    out_path: Optional[str] = Field(
        None,
        description="Ghi draft đã dịch ra path (json hoặc folder). Không ghi đè project nếu khác.",
    )
    api_key: Optional[str] = None
    model: str = "claude-haiku-4-5-20251001"
    dry_run: bool = False
    save_in_place: bool = Field(
        False,
        description="Nếu true: dịch và save_raw_draft project gốc (cẩn thận)",
    )

    model_config = {"populate_by_name": True}


# ── routes ──────────────────────────────────────────────────────────


@router.post("/import-ass")
def local_import_ass(body: ImportAssBody):
    try:
        content = cap.load_ass_source(ass=body.ass, ass_path=body.ass_path)
        draft, path = load_raw_draft(body.project)
        n = cap.import_ass_into_draft(
            draft,
            content,
            font_size=body.font_size,
            time_offset_us=body.time_offset_us,
            transform_y=body.transform_y,
            replace=body.replace,
        )
        save_raw_draft(path, draft)
        return {
            "ok": True,
            "path": str(path),
            "cues_added": n,
            "replace": body.replace,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except OSError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.post("/text-ranges")
def local_text_ranges(body: TextRangesBody):
    try:
        draft, path = load_raw_draft(body.project)
        items = body.ranges or body.styles or []
        ranges: List[Dict[str, Any]] = [r.model_dump(exclude_none=True) for r in items]
        result = cap.set_text_ranges(
            draft,
            ranges,
            segment_id=body.segment_id,
            material_id=body.material_id,
            range_unit=body.range_unit,
        )
        save_raw_draft(path, draft)
        return {"ok": True, "path": str(path), **result}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.post("/export-srt")
def local_export_srt_extended(body: ExportSrtBody):
    """Export SRT with optional word granularity (WAVE2 mở rộng).

    Note: local_srt also registers /export-srt (line-only). Leader should
    mount this router *before* or merge — both return valid SRT; this one
    supports ``granularity=word``.
    """
    try:
        draft, path = load_raw_draft(body.project)
        result = cap.export_srt_from_draft(draft, granularity=body.granularity)
        return {"ok": True, "path": str(path), **result}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.post("/caption")
def local_caption(body: CaptionBody):
    try:
        draft, path = load_raw_draft(body.project)
        result = cap.caption_draft(
            draft,
            audio=body.audio,
            from_segment=body.from_segment,
            whisper_cmd=body.whisper_cmd,
            whisper_model=body.whisper_model,
            language=body.language,
            engine=body.engine,
            font_size=body.font_size,
            replace=body.replace,
            transform_y=body.transform_y,
        )
        save_raw_draft(path, draft)
        return {"ok": True, "path": str(path), **result}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except cap.CaptionUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.post("/translate")
def local_translate(body: TranslateBody):
    """Dịch mọi materials.texts.

    - ``dry_run=true``: liệt kê text, không gọi API, không đổi disk (trừ out_path copy).
    - ``out_path``: ghi bản clone đã dịch (không đụng project gốc).
    - ``save_in_place=true``: dịch + ``save_raw_draft`` project gốc (cần API key).
    - Không key + không dry_run → 503.
    """
    try:
        draft, path = load_raw_draft(body.project)

        if body.save_in_place and not body.dry_run:
            work = draft
            out_path = body.out_path
        else:
            work = deepcopy(draft)
            out_path = body.out_path

        result = cap.translate_draft(
            work,
            to_lang=body.to,
            from_lang=body.from_lang,
            out_path=out_path,
            api_key=body.api_key,
            model=body.model,
            dry_run=body.dry_run,
        )

        if body.save_in_place and not body.dry_run:
            save_raw_draft(path, draft)
            result["path"] = str(path)

        return {"ok": True, "source_path": str(path), **result}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except cap.TranslateUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
