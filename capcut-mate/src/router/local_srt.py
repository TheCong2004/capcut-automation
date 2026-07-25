"""Local SRT APIs — pure Python (Grok A)."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from engines.local.draft_io import load_raw_draft, save_raw_draft
from engines.local import srt as srt_eng

router = APIRouter(prefix="/v1/local", tags=["local-python"])


class ImportSrtBody(BaseModel):
    project: str = Field(..., min_length=1, description="Folder draft hoặc path draft_content.json")
    srt: Optional[str] = Field(None, description="Nội dung SRT (string)")
    srt_path: Optional[str] = Field(None, description="Đường dẫn file .srt trên máy BE")
    font_size: float = Field(5.0, ge=1.0, le=200.0, description="Size kiểu Jianying SRT (mặc định 5)")
    time_offset_us: int = Field(0, description="Offset toàn bộ cue (microseconds)")
    transform_y: float = Field(-0.8, description="Vị trí dọc clip (mặc định đáy khung hình)")
    replace: bool = Field(False, description="Xóa subtitle trên text track trước khi import")


class ExportSrtBody(BaseModel):
    project: str = Field(..., min_length=1)


@router.post("/import-srt")
def local_import_srt(body: ImportSrtBody):
    try:
        content = srt_eng.load_srt_source(srt=body.srt, srt_path=body.srt_path)
        draft, path = load_raw_draft(body.project)
        n = srt_eng.import_srt_into_draft(
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


@router.post("/export-srt")
def local_export_srt(body: ExportSrtBody):
    try:
        draft, path = load_raw_draft(body.project)
        text = srt_eng.export_srt_from_draft(draft)
        cue_count = len(srt_eng.parse_srt(text)) if text.strip() else 0
        return {
            "ok": True,
            "path": str(path),
            "srt": text,
            "cue_count": cue_count,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
