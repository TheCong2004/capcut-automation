"""
Toàn bộ tính năng capcut-cli đưa vào Mate qua HTTP.

- POST /v1/cli/run  → chạy BẤT KỲ lệnh capcut (args[]) — cổng chính “đưa hết”
- Các route tiện ích (projects, keyframe…) giữ cho FE dễ gọi
- Mate native (create_draft, add_videos…) vẫn ở /v1/* — không thay bằng CLI

Cần: npm i -g capcut-cli (hoặc CAPCUT_CLI_BIN). Lỗi → 4xx/5xx, bảo trì sau.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Union

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from engines.cli_bridge import (
    CliBinaryNotFoundError,
    CliBridgeError,
    CliCommandFailedError,
    CliTimeoutError,
)
from engines.cli_bridge import wrappers as cli
from engines.cli_bridge.runner import run_cmd

router = APIRouter(prefix="/v1/cli", tags=["cli-bridge"])

# Full surface from capcut-cli docs/command-reference.md — all available via /run
CLI_ALL_COMMANDS: List[str] = [
    "info",
    "version",
    "lint",
    "tracks",
    "segments",
    "texts",
    "set-text",
    "shift",
    "shift-all",
    "speed",
    "volume",
    "trim",
    "opacity",
    "export-srt",
    "materials",
    "segment",
    "material",
    "add-audio",
    "add-video",
    "add-text",
    "crop",
    "cut",
    "duplicate",
    "keyframe",
    "transition",
    "mask",
    "bg-blur",
    "text-style",
    "text-anim",
    "image-anim",
    "add-sticker",
    "mix-mode",
    "audio-fade",
    "add-cover",
    "add-filter",
    "bubble-text",
    "add-effect",
    "save-template",
    "apply-template",
    "make-preset",
    "templates",
    "batch",
    "import-srt",
    "import-ass",
    "text-ranges",
    "caption",
    "translate",
    "migrate",
    "add-sfx",
    "chroma",
    "prune",
    "register",
    "relink",
    "replace-media",
    "timeline",
    "projects",
    "diff",
    "concat",
    "config",
    "describe",
    "completions",
    "enums",
    "doctor",
    "diagnose",
    "fixture",
    "sync-timelines",
    "restore",
    "serve",
    "decrypt",
    "export",
    "init",
    "quickstart",
    "compile",
    "render",
    "detect-scenes",
]


def _http_error(exc: Exception) -> HTTPException:
    if isinstance(exc, CliBinaryNotFoundError):
        return HTTPException(status_code=503, detail=exc.as_dict(lang="vi"))
    if isinstance(exc, CliTimeoutError):
        return HTTPException(status_code=504, detail=exc.as_dict(lang="vi"))
    if isinstance(exc, CliCommandFailedError):
        return HTTPException(status_code=400, detail=exc.as_dict(lang="vi"))
    if isinstance(exc, CliBridgeError):
        return HTTPException(status_code=500, detail=exc.as_dict(lang="vi"))
    if isinstance(exc, ValueError):
        return HTTPException(status_code=422, detail=str(exc))
    return HTTPException(status_code=500, detail=str(exc))


def _run(fn, *args, **kwargs) -> dict:
    try:
        return fn(*args, **kwargs)
    except Exception as e:
        raise _http_error(e) from e


def _parse_stdout(result: dict) -> dict:
    """Attach parsed JSON stdout when possible (CLI default is JSON)."""
    out = dict(result)
    raw = (result.get("stdout") or "").strip()
    if not raw:
        return out
    try:
        out["data"] = json.loads(raw)
    except json.JSONDecodeError:
        out["data"] = None
    return out


# ---------------------------------------------------------------------------
# Generic: mọi lệnh CLI
# ---------------------------------------------------------------------------


class CliRunBody(BaseModel):
    """
    Chạy bất kỳ lệnh capcut-cli.

    Ví dụ::

        {"args": ["info", "D:/drafts/my-project"]}
        {"args": ["add-video", "D:/drafts/p", "clip.mp4", "0", "5"]}
        {"args": ["doctor"], "timeout_s": 120}
    """

    args: List[str] = Field(
        ...,
        min_length=1,
        description="argv sau binary: [subcommand, ...flags]",
    )
    timeout_s: Optional[float] = Field(
        default=None,
        description="Timeout giây (mặc định CAPCUT_CLI_TIMEOUT_S / 60)",
    )
    check: bool = Field(
        default=False,
        description="False = trả stdout/stderr dù exit != 0 (dễ debug)",
    )
    cwd: Optional[str] = Field(default=None, description="Working directory")


@router.post("/run")
def cli_run(body: CliRunBody):
    """
    **Cổng chính — đưa hết CLI vào Mate.**

    Mọi lệnh trong `capcut --help` / command-reference đều gọi được qua đây.
    """
    sub = str(body.args[0]).lstrip("-")
    # allow --help style
    if sub not in CLI_ALL_COMMANDS and sub not in ("help", "h"):
        # still allow unknown subcommands (future CLI versions) — only warn in payload
        pass

    # hard reject empty tokens / shell injection style
    for a in body.args:
        if a is None or str(a) == "":
            raise HTTPException(status_code=422, detail="args không được chứa chuỗi rỗng")
        if any(c in str(a) for c in ("\n", "\r", "\x00")):
            raise HTTPException(status_code=422, detail="args chứa ký tự không hợp lệ")

    result = _run(
        run_cmd,
        body.args,
        timeout_s=body.timeout_s,
        check=body.check,
        cwd=body.cwd,
    )
    payload = _parse_stdout(result)
    payload["command"] = body.args[0] if body.args else None
    if body.args and str(body.args[0]) not in CLI_ALL_COMMANDS:
        payload["warning"] = (
            f"subcommand '{body.args[0]}' không nằm trong danh sách v0.14 đã biết; "
            "vẫn đã chạy — kiểm tra version capcut-cli"
        )
    return payload


@router.get("/commands")
def cli_commands():
    """Danh sách ~75 lệnh CLI có thể gọi qua POST /run."""
    return {
        "count": len(CLI_ALL_COMMANDS),
        "commands": CLI_ALL_COMMANDS,
        "usage": {
            "method": "POST",
            "path": "/openapi/capcut-mate/v1/cli/run",
            "body": {"args": ["<command>", "..."], "check": False},
        },
        "install": "npm i -g capcut-cli  # hoặc set CAPCUT_CLI_BIN",
    }


@router.get("/capabilities")
def cli_capabilities():
    return {
        "strategy": "Đưa hết CLI vào Mate: POST /v1/cli/run. Mate native giữ /v1/*.",
        "mate_native": [
            "create_draft",
            "save_draft",
            "get_draft",
            "add_videos",
            "add_images",
            "add_audios",
            "add_captions",
            "add_effects",
            "add_filters",
            "add_masks",
            "add_keyframes",
            "add_sticker",
            "search_sticker",
            "gen_video",
            "gen_video_status",
            "…helpers timelines/infos",
        ],
        "cli_all_via_run": True,
        "cli_command_count": len(CLI_ALL_COMMANDS),
        "cli_convenience_routes": [
            "doctor",
            "projects",
            "info",
            "lint",
            "keyframe",
            "mask",
            "transition",
            "import-srt",
            "cut",
            "detect-scenes",
            "caption",
        ],
        "logic_python_port": False,
        "note": "run = bridge Node. Port pure Python làm dần; lỗi bảo trì theo endpoint.",
        "docs": [
            "docs/FEATURE-MERGE-cli-into-mate.md",
            "docs/SO-SANH-cli-vs-mate.md",
            "capcut-cli/docs/command-reference.md",
        ],
    }


# ---------------------------------------------------------------------------
# Convenience routes (same as before)
# ---------------------------------------------------------------------------


class ProjectPathBody(BaseModel):
    project: str = Field(..., description="Đường dẫn folder draft local")


class ProjectsQuery(BaseModel):
    drafts_dir: Optional[str] = None
    query: Optional[str] = None
    names: bool = False


class KeyframeBody(BaseModel):
    project: str
    segment_id: str
    property: str
    time: Union[str, float, int]
    value: Union[str, float, int]
    easing: Optional[str] = None


class MaskBody(BaseModel):
    project: str
    segment_id: str
    slug: Optional[str] = None
    off: bool = False
    options: Optional[Dict[str, Any]] = None


class TransitionBody(BaseModel):
    project: str
    segment_id: str
    slug: str
    duration: Optional[Union[str, float, int]] = None


class ImportSrtBody(BaseModel):
    project: str
    srt_path: str


class CutBody(BaseModel):
    project: str
    start: Union[str, float, int]
    end: Union[str, float, int]
    out: str


class DetectScenesBody(BaseModel):
    video: str


class CaptionBody(BaseModel):
    project: str
    audio: Optional[str] = None
    from_segment: Optional[str] = None


class LintBody(BaseModel):
    project: str
    fix: bool = False


@router.get("/doctor")
def cli_doctor():
    return _parse_stdout(_run(cli.doctor))


@router.post("/projects")
def cli_projects(body: ProjectsQuery):
    return _parse_stdout(
        _run(
            cli.list_projects,
            body.drafts_dir,
            query=body.query,
            names=body.names,
            check=False,
        )
    )


@router.post("/info")
def cli_info(body: ProjectPathBody):
    return _parse_stdout(_run(cli.info, body.project, check=False))


@router.post("/lint")
def cli_lint(body: LintBody):
    return _parse_stdout(_run(cli.lint, body.project, fix=body.fix, check=False))


@router.post("/keyframe")
def cli_keyframe(body: KeyframeBody):
    return _parse_stdout(
        _run(
            cli.keyframe,
            body.project,
            body.segment_id,
            body.property,
            body.time,
            body.value,
            easing=body.easing,
        )
    )


@router.post("/mask")
def cli_mask(body: MaskBody):
    return _parse_stdout(
        _run(
            cli.mask,
            body.project,
            body.segment_id,
            body.slug,
            off=body.off,
            options=body.options,
        )
    )


@router.post("/transition")
def cli_transition(body: TransitionBody):
    return _parse_stdout(
        _run(
            cli.transition,
            body.project,
            body.segment_id,
            body.slug,
            duration=body.duration,
        )
    )


@router.post("/import-srt")
def cli_import_srt(body: ImportSrtBody):
    return _parse_stdout(_run(cli.import_srt, body.project, body.srt_path))


@router.post("/cut")
def cli_cut(body: CutBody):
    return _parse_stdout(
        _run(cli.cut, body.project, body.start, body.end, body.out)
    )


@router.post("/detect-scenes")
def cli_detect_scenes(body: DetectScenesBody):
    return _parse_stdout(_run(cli.detect_scenes, body.video))


@router.post("/caption")
def cli_caption(body: CaptionBody):
    if not body.audio and not body.from_segment:
        raise HTTPException(status_code=422, detail="Cần audio hoặc from_segment")
    return _parse_stdout(
        _run(
            cli.caption,
            body.project,
            audio=body.audio,
            from_segment=body.from_segment,
        )
    )
