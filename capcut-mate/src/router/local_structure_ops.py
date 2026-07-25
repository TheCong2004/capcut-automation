"""
WAVE2 Grok C — structure / timeline / projects local APIs (pure Python).

Prefix: /openapi/capcut-mate/v1/local/*
Leader mounts this router in main.py.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from engines.local import structure_ops as ops

router = APIRouter(prefix="/v1/local", tags=["local-python"])


# ---------------------------------------------------------------------------
# Bodies
# ---------------------------------------------------------------------------


class CutBody(BaseModel):
    project: str
    start_us: int = Field(..., ge=0)
    end_us: int = Field(..., gt=0)
    out: str = Field(..., description="Output .json file or directory")


class ConcatBody(BaseModel):
    project_a: str
    project_b: str
    out: Optional[str] = None


class DiffBody(BaseModel):
    project_a: str
    project_b: str


class DetectScenesBody(BaseModel):
    video: str
    threshold: float = Field(0.4, gt=0, le=1)
    min_gap: float = Field(2.0, ge=0)
    limit: Optional[int] = Field(None, ge=1)
    ffmpeg_cmd: str = "ffmpeg"
    timeout_s: float = Field(600.0, gt=0)


class TimelineBody(BaseModel):
    project: str
    cols: int = Field(60, ge=1, le=500)


class ProjectsBody(BaseModel):
    drafts_dir: Optional[str] = None
    query: Optional[str] = None
    names: bool = False


class DeleteProjectBody(BaseModel):
    project: str = Field(..., description="Folder draft hoặc path draft_content.json")
    confirm: bool = Field(
        False,
        description="Bắt buộc true để xóa folder trên đĩa (không hoàn tác)",
    )


class ShiftAllBody(BaseModel):
    project: str
    offset_us: int
    track_type: Optional[str] = None


class VersionBody(BaseModel):
    project: str


class InitBody(BaseModel):
    name: str
    drafts_dir: Optional[str] = None
    template_dir: Optional[str] = None


class QuickstartBody(BaseModel):
    name: str
    video: str
    drafts_dir: Optional[str] = None
    template_dir: Optional[str] = None
    duration_us: Optional[int] = Field(None, gt=0)


def _map_err(exc: Exception) -> HTTPException:
    if isinstance(exc, FileNotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, ops.FfmpegNotFoundError):
        return HTTPException(status_code=503, detail=str(exc))
    if isinstance(exc, (ops.StructureError, ValueError)):
        return HTTPException(status_code=422, detail=str(exc))
    return HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/cut")
def local_cut(body: CutBody):
    """Extract time range into a new standalone draft (CLI `cut`)."""
    try:
        return ops.cut_to_out(body.project, body.start_us, body.end_us, body.out)
    except Exception as e:
        raise _map_err(e) from e


@router.post("/concat")
def local_concat(body: ConcatBody):
    """Append project_b onto project_a timeline (CLI `concat`)."""
    try:
        return ops.concat_drafts(body.project_a, body.project_b, out=body.out)
    except Exception as e:
        raise _map_err(e) from e


@router.post("/diff")
def local_diff(body: DiffBody):
    """Compare two drafts' tracks/segments/materials (CLI `diff`)."""
    try:
        return ops.diff_projects(body.project_a, body.project_b)
    except Exception as e:
        raise _map_err(e) from e


@router.post("/detect-scenes")
def local_detect_scenes(body: DetectScenesBody):
    """
    Scene cuts via **ffmpeg** scene filter (not capcut-cli).
    Returns 503 if ffmpeg is missing.
    """
    try:
        return ops.detect_scenes(
            body.video,
            threshold=body.threshold,
            min_gap=body.min_gap,
            limit=body.limit,
            ffmpeg_cmd=body.ffmpeg_cmd,
            timeout_s=body.timeout_s,
        )
    except Exception as e:
        raise _map_err(e) from e


@router.post("/timeline")
def local_timeline(body: TimelineBody):
    """JSON track/segment layout (CLI `timeline`)."""
    try:
        return ops.timeline_layout(body.project, cols=body.cols)
    except Exception as e:
        raise _map_err(e) from e


@router.post("/projects")
def local_projects(body: ProjectsBody):
    """List CapCut/JianYing draft folders on disk (CLI `projects`)."""
    try:
        return ops.list_projects(
            body.drafts_dir, query=body.query, names=body.names
        )
    except Exception as e:
        raise _map_err(e) from e


@router.post("/delete-project")
def local_delete_project(body: DeleteProjectBody):
    """Xóa folder draft trên đĩa (CapCut hoặc mate output). Cần confirm=true."""
    try:
        return ops.delete_project(body.project, confirm=body.confirm)
    except Exception as e:
        raise _map_err(e) from e


@router.get("/cover")
def local_project_cover(
    project: str = Query(
        ...,
        description="Folder draft CapCut hoặc path draft_content.json",
    ),
):
    """
    Serve ảnh cover dự án (draft_cover.jpg…) cho FE list All Projects.
    Chỉ cho phép file cover trong folder có draft_content/draft_info.
    """
    try:
        p = Path(project).expanduser()
        if p.is_file() and p.name in ("draft_content.json", "draft_info.json"):
            entry = p.parent
        else:
            entry = p
        if not entry.is_dir():
            raise HTTPException(404, f"Không thấy folder project: {entry}")
        # must look like a draft project
        if not any(
            (entry / n).is_file()
            for n in ("draft_content.json", "draft_info.json")
        ):
            raise HTTPException(404, "Không phải folder draft CapCut")
        cover = ops._resolve_project_cover(entry)
        if not cover:
            raise HTTPException(404, "Project không có draft_cover / cover image")
        cover_p = Path(cover)
        # safety: cover must live under project dir
        try:
            cover_p.resolve().relative_to(entry.resolve())
        except ValueError as e:
            raise HTTPException(403, "Cover ngoài folder project") from e
        media = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".bmp": "image/bmp",
        }.get(cover_p.suffix.lower(), "application/octet-stream")
        return FileResponse(
            path=str(cover_p),
            media_type=media,
            filename=cover_p.name,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise _map_err(e) from e


@router.post("/shift-all")
def local_shift_all(body: ShiftAllBody):
    """Shift every segment (optional track_type filter) by offset_us."""
    try:
        return ops.shift_all(
            body.project, body.offset_us, track_type=body.track_type
        )
    except Exception as e:
        raise _map_err(e) from e


@router.post("/version")
def local_version(body: VersionBody):
    """Read platform app_version / schema flags from draft JSON."""
    try:
        return ops.detect_version(body.project)
    except Exception as e:
        raise _map_err(e) from e


@router.post("/init")
def local_init(body: InitBody):
    """Create empty draft from Mate template/default2 (CLI `init`)."""
    try:
        return ops.init_draft(
            body.name,
            drafts_dir=body.drafts_dir,
            template_dir=body.template_dir,
        )
    except Exception as e:
        raise _map_err(e) from e


@router.post("/quickstart")
def local_quickstart(body: QuickstartBody):
    """init + add one local video (CLI `quickstart` subset)."""
    try:
        return ops.quickstart(
            body.name,
            video=body.video,
            drafts_dir=body.drafts_dir,
            template_dir=body.template_dir,
            duration_us=body.duration_us,
        )
    except Exception as e:
        raise _map_err(e) from e
