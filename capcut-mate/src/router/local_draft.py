"""
Pure-Python local draft APIs (replacing capcut-cli dependency).

Prefix: /openapi/capcut-mate/v1/local/*
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from engines import local as eng

router = APIRouter(prefix="/v1/local", tags=["local-python"])


class ProjectBody(BaseModel):
    project: str = Field(..., description="Folder draft hoặc path draft_content.json")


class SegmentMutBody(BaseModel):
    project: str
    segment_id: str


class SpeedBody(SegmentMutBody):
    speed: float = Field(..., gt=0)


class VolumeBody(SegmentMutBody):
    volume: float = Field(..., ge=0)


class OpacityBody(SegmentMutBody):
    alpha: float = Field(..., ge=0, le=1)


class ShiftBody(SegmentMutBody):
    offset_us: int = Field(..., description="Dời start (microseconds), âm = lùi")


class TrimBody(SegmentMutBody):
    start_us: int = Field(..., ge=0)
    duration_us: int = Field(..., gt=0)


class SegmentsQuery(BaseModel):
    project: str
    track_type: Optional[str] = None


def _load(project: str):
    try:
        return eng.load_raw_draft(project)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.post("/info")
def local_info(body: ProjectBody):
    """Tương đương CLI `info` — pure Python."""
    draft, path = _load(body.project)
    summary = eng.summarize(draft)
    summary["path"] = str(path)
    return summary


@router.post("/tracks")
def local_tracks(body: ProjectBody):
    """Tương đương CLI `tracks`."""
    draft, path = _load(body.project)
    return {"path": str(path), "tracks": eng.list_tracks(draft)}


@router.post("/segments")
def local_segments(body: SegmentsQuery):
    """Tương đương CLI `segments`."""
    draft, path = _load(body.project)
    return {
        "path": str(path),
        "segments": eng.list_segments(draft, track_type=body.track_type),
    }


@router.post("/speed")
def local_speed(body: SpeedBody):
    """Tương đương CLI `speed` — ghi file draft."""
    draft, path = _load(body.project)
    try:
        seg = eng.set_speed(draft, body.segment_id, body.speed)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    eng.save_raw_draft(path, draft)
    return {"ok": True, "path": str(path), "segment": seg}


@router.post("/volume")
def local_volume(body: VolumeBody):
    draft, path = _load(body.project)
    try:
        seg = eng.set_volume(draft, body.segment_id, body.volume)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    eng.save_raw_draft(path, draft)
    return {"ok": True, "path": str(path), "segment": seg}


@router.post("/opacity")
def local_opacity(body: OpacityBody):
    draft, path = _load(body.project)
    try:
        seg = eng.set_opacity(draft, body.segment_id, body.alpha)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    eng.save_raw_draft(path, draft)
    return {"ok": True, "path": str(path), "segment": seg}


@router.post("/shift")
def local_shift(body: ShiftBody):
    draft, path = _load(body.project)
    try:
        seg = eng.shift_segment(draft, body.segment_id, body.offset_us)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    eng.save_raw_draft(path, draft)
    return {"ok": True, "path": str(path), "segment": seg}


@router.post("/trim")
def local_trim(body: TrimBody):
    draft, path = _load(body.project)
    try:
        seg = eng.trim_segment(
            draft, body.segment_id, body.start_us, body.duration_us
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    eng.save_raw_draft(path, draft)
    return {"ok": True, "path": str(path), "segment": seg}


@router.get("/status")
def local_engine_status():
    return {
        "engine": "local-python",
        "capcut_cli_required": False,
        "wave1_done": [
            "info",
            "tracks",
            "segments",
            "speed",
            "volume",
            "opacity",
            "shift",
            "trim",
            "import-srt",
            "export-srt",
            "keyframe",
            "transition",
            "mask",
            "transform",
            "materials",
            "texts",
            "set-text",
            "add-text",
        ],
        "wave2_plan": "docs/PORT-ALL-WAVE2.md",
        "wave2_prompts": [
            "docs/prompts/WAVE2-GROK-A-media.md",
            "docs/prompts/WAVE2-GROK-B-fx.md",
            "docs/prompts/WAVE2-GROK-C-structure.md",
            "docs/prompts/WAVE2-GROK-D-caption.md",
            "docs/prompts/WAVE2-GROK-E-tools-fe.md",
        ],
        "note": "Wave2: 5 Grok đưa HẾT lệnh CLI còn lại sang pure Python.",
    }
