"""WAVE2 Grok E — tooling / batch / describe (pure Python, no capcut-cli)."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from engines.local.draft_io import load_raw_draft, save_raw_draft
from engines.local import tool_ops as tools

router = APIRouter(prefix="/v1/local", tags=["local-python-tools"])


class ProjectBody(BaseModel):
    project: str = Field(..., min_length=1)


class LintBody(BaseModel):
    project: str = Field(..., min_length=1)
    max_chars_per_line: int = 42
    max_cue_duration_us: int = 7_000_000
    min_gap_between_captions_us: int = 0
    check_local_paths: bool = True


class RestoreBody(BaseModel):
    project: str = Field(..., min_length=1)
    step: int = Field(1, ge=1)


class RegisterBody(BaseModel):
    project: str = Field(..., min_length=1)
    apply: bool = True


class FixtureBody(BaseModel):
    project: str = Field(..., min_length=1)
    out_dir: str = Field(..., min_length=1)


class BatchBody(BaseModel):
    project: str = Field(..., min_length=1)
    ops: List[Dict[str, Any]] = Field(..., min_length=1)
    dry_run: bool = False
    stop_on_error: bool = True


class CompileBody(BaseModel):
    spec: Dict[str, Any]
    out_dir: str = Field(..., min_length=1)
    overwrite: bool = False


class DecryptBody(BaseModel):
    project: str = Field(
        ...,
        min_length=1,
        description="Path draft folder hoặc draft_content.json",
    )


class RenderBody(BaseModel):
    project: str = Field(..., min_length=1)
    out_path: Optional[str] = None
    skip: bool = False


def _http(e: Exception) -> HTTPException:
    if isinstance(e, FileNotFoundError):
        return HTTPException(status_code=404, detail=str(e))
    if isinstance(e, (ValueError, KeyError, TypeError)):
        code = 404 if isinstance(e, KeyError) else 422
        return HTTPException(status_code=code, detail=str(e))
    return HTTPException(status_code=500, detail=str(e))


@router.post("/lint")
def local_lint(body: LintBody):
    try:
        draft, path = load_raw_draft(body.project)
        opts = {
            "max_chars_per_line": body.max_chars_per_line,
            "max_cue_duration_us": body.max_cue_duration_us,
            "min_gap_between_captions_us": body.min_gap_between_captions_us,
            "check_local_paths": body.check_local_paths,
        }
        issues = tools.lint_draft(draft, opts)
        return {
            "ok": True,
            "path": str(path),
            "issues": issues,
            "summary": tools.lint_summary(issues),
        }
    except Exception as e:  # noqa: BLE001
        raise _http(e) from e


@router.post("/lint-fix")
def local_lint_fix(body: LintBody):
    try:
        draft, path = load_raw_draft(body.project)
        opts = {
            "max_chars_per_line": body.max_chars_per_line,
            "max_cue_duration_us": body.max_cue_duration_us,
            "min_gap_between_captions_us": body.min_gap_between_captions_us,
            "check_local_paths": body.check_local_paths,
        }
        result = tools.fix_draft(draft, opts)
        save_raw_draft(path, draft)
        return {"ok": True, "path": str(path), **result}
    except Exception as e:  # noqa: BLE001
        raise _http(e) from e


@router.post("/doctor")
def local_doctor():
    """Không cần project — kiểm tra env pure Python BE."""
    return tools.run_doctor()


@router.post("/restore")
def local_restore(body: RestoreBody):
    try:
        return tools.restore_from_bak(body.project, step=body.step)
    except Exception as e:  # noqa: BLE001
        raise _http(e) from e


@router.post("/register")
def local_register(body: RegisterBody):
    try:
        return tools.register_draft(body.project, apply=body.apply)
    except Exception as e:  # noqa: BLE001
        raise _http(e) from e


@router.post("/sync-timelines")
def local_sync_timelines(body: ProjectBody):
    try:
        return tools.sync_timelines(body.project)
    except Exception as e:  # noqa: BLE001
        raise _http(e) from e


@router.post("/diagnose")
def local_diagnose(body: ProjectBody):
    try:
        return tools.diagnose_project(body.project)
    except Exception as e:  # noqa: BLE001
        raise _http(e) from e


@router.post("/fixture")
def local_fixture(body: FixtureBody):
    try:
        return tools.export_fixture(body.project, body.out_dir)
    except Exception as e:  # noqa: BLE001
        raise _http(e) from e


@router.post("/batch")
def local_batch(body: BatchBody):
    try:
        return tools.run_batch(
            body.project,
            body.ops,
            dry_run=body.dry_run,
            stop_on_error=body.stop_on_error,
        )
    except Exception as e:  # noqa: BLE001
        raise _http(e) from e


@router.post("/compile")
def local_compile(body: CompileBody):
    try:
        return tools.compile_spec(
            body.spec, body.out_dir, overwrite=body.overwrite
        )
    except Exception as e:  # noqa: BLE001
        raise _http(e) from e


@router.get("/describe")
def local_describe():
    return tools.describe_local_apis()


@router.get("/port-matrix")
def local_port_matrix():
    return tools.port_matrix()


@router.post("/config")
def local_config():
    return tools.get_config()


@router.post("/render")
def local_render(body: RenderBody):
    try:
        result = tools.render_preview(
            body.project, out_path=body.out_path, skip=body.skip
        )
        if result.get("status_code_hint") == 501 and not result.get("ok"):
            # Still return 200 + body for Mate middleware; FE reads ok/skipped
            return result
        return result
    except Exception as e:  # noqa: BLE001
        raise _http(e) from e


@router.post("/decrypt")
def local_decrypt(body: DecryptBody):
    """Detect encryption only — không decrypt payload."""
    try:
        return tools.detect_encryption(body.project)
    except Exception as e:  # noqa: BLE001
        raise _http(e) from e


@router.post("/stub-skip")
def local_stub_skip():
    """501 stubs: serve / completions / export-mac — not implemented."""
    raise HTTPException(
        status_code=501,
        detail="serve/completions/export-mac: skip (WAVE2). Pure Python BE không port UI automation mac.",
    )
