"""WAVE2 Grok A — local media ops HTTP (pure Python)."""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from engines.local.draft_io import load_raw_draft, save_raw_draft
from engines.local import media_ops as eng

router = APIRouter(prefix="/v1/local", tags=["local-python"])


def _load(project: str):
    try:
        return load_raw_draft(project)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


def _mutate(project: str, fn):
    draft, path = _load(project)
    try:
        result = fn(draft, path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    save_raw_draft(path, draft)
    if isinstance(result, dict):
        result.setdefault("ok", True)
        # draft_path = JSON file; keep engine fields like media `path` intact
        result["draft_path"] = str(path)
        result.setdefault("path", str(path))
    return result


class ProjectBody(BaseModel):
    project: str = Field(..., min_length=1)


class CropBody(BaseModel):
    project: str
    segment_id: str
    ratio: Optional[str] = None
    rect: Optional[Dict[str, float]] = None  # x,y,w,h
    reset: bool = False


class DuplicateBody(BaseModel):
    project: str
    segment_id: str
    new_track: bool = True
    track_name: Optional[str] = None


class ReplaceMediaBody(BaseModel):
    project: str
    segment_id: str
    new_file: str
    retime: bool = False
    dry_run: bool = False


class RelinkBody(BaseModel):
    project: str
    dir: Optional[str] = Field(None, description="Folder chứa basename media")
    from_prefix: Optional[str] = Field(None, alias="from")
    to_prefix: Optional[str] = Field(None, alias="to")

    model_config = {"populate_by_name": True}


class AddCoverBody(BaseModel):
    project: str
    image: str
    time_ms: int = 0


class AudioFadeBody(BaseModel):
    project: str
    segment_id: str
    fade_in_s: float = Field(0.0, ge=0)
    fade_out_s: float = Field(0.0, ge=0)


class AddVideoBody(BaseModel):
    project: str
    file: str
    start_us: int = Field(0, ge=0)
    duration_us: Optional[int] = Field(None, gt=0)
    track_name: str = "video"
    width: int = 1920
    height: int = 1080
    media_type: Optional[str] = None


class AddAudioBody(BaseModel):
    project: str
    file: str
    start_us: int = Field(0, ge=0)
    duration_us: Optional[int] = Field(None, gt=0)
    track_name: str = "audio"
    volume: float = Field(1.0, ge=0)


class MaterialBody(BaseModel):
    project: str
    material_id: str


class SegmentBody(BaseModel):
    project: str
    segment_id: str


@router.post("/crop")
def local_crop(body: CropBody):
    def go(draft, path):
        return eng.set_crop(
            draft,
            body.segment_id,
            ratio=body.ratio,
            rect=body.rect,
            reset=body.reset,
        )

    return _mutate(body.project, go)


@router.post("/duplicate")
def local_duplicate(body: DuplicateBody):
    def go(draft, path):
        return eng.duplicate_segment(
            draft,
            body.segment_id,
            new_track=body.new_track,
            track_name=body.track_name,
        )

    return _mutate(body.project, go)


@router.post("/replace-media")
def local_replace_media(body: ReplaceMediaBody):
    def go(draft, path):
        return eng.replace_media(
            draft,
            path,
            body.segment_id,
            body.new_file,
            retime=body.retime,
            dry_run=body.dry_run,
        )

    if body.dry_run:
        draft, path = _load(body.project)
        try:
            result = eng.replace_media(
                draft,
                path,
                body.segment_id,
                body.new_file,
                retime=body.retime,
                dry_run=True,
            )
        except FileNotFoundError as e:
            raise HTTPException(404, str(e)) from e
        except KeyError as e:
            raise HTTPException(404, str(e)) from e
        except ValueError as e:
            raise HTTPException(422, str(e)) from e
        result["path"] = str(path)
        return result
    return _mutate(body.project, go)


@router.post("/relink")
def local_relink(body: RelinkBody):
    def go(draft, path):
        return eng.relink_materials(
            draft,
            directory=body.dir,
            from_prefix=body.from_prefix,
            to_prefix=body.to_prefix,
        )

    return _mutate(body.project, go)


@router.post("/prune")
def local_prune(body: ProjectBody):
    def go(draft, path):
        return eng.prune_materials(draft)

    return _mutate(body.project, go)


@router.post("/add-cover")
def local_add_cover(body: AddCoverBody):
    def go(draft, path):
        return eng.add_cover(draft, body.image, time_ms=body.time_ms)

    return _mutate(body.project, go)


@router.post("/audio-fade")
def local_audio_fade(body: AudioFadeBody):
    def go(draft, path):
        return eng.set_audio_fade(
            draft,
            body.segment_id,
            fade_in_s=body.fade_in_s,
            fade_out_s=body.fade_out_s,
        )

    return _mutate(body.project, go)


@router.post("/add-video")
def local_add_video(body: AddVideoBody):
    def go(draft, path):
        return eng.add_video(
            draft,
            path,
            body.file,
            start_us=body.start_us,
            duration_us=body.duration_us,
            track_name=body.track_name,
            width=body.width,
            height=body.height,
            media_type=body.media_type,
        )

    return _mutate(body.project, go)


@router.post("/add-audio")
def local_add_audio(body: AddAudioBody):
    def go(draft, path):
        return eng.add_audio(
            draft,
            path,
            body.file,
            start_us=body.start_us,
            duration_us=body.duration_us,
            track_name=body.track_name,
            volume=body.volume,
        )

    return _mutate(body.project, go)


@router.post("/material")
def local_material(body: MaterialBody):
    draft, path = _load(body.project)
    try:
        info = eng.get_material(draft, body.material_id)
    except KeyError as e:
        raise HTTPException(404, str(e)) from e
    return {"ok": True, "path": str(path), **info}


@router.post("/segment")
def local_segment(body: SegmentBody):
    draft, path = _load(body.project)
    try:
        info = eng.get_segment_full(draft, body.segment_id)
    except KeyError as e:
        raise HTTPException(404, str(e)) from e
    return {"ok": True, "path": str(path), **info}
