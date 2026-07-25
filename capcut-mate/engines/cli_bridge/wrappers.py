"""
Thin wrappers around selected capcut-cli commands (Phase 2 stubs).

No HTTP / FastAPI here — pure Python call sites for services or future routers.

CLI reference (subset)::

    capcut keyframe <project> <id> <property> <time> <value> [--easing <name>]
    capcut mask <project> <id> <slug> [options] | --off
    capcut transition <project> <id> <slug> [--duration <time>]
    capcut projects [query] [--drafts <path>] [--names]
    capcut import-srt <project> <srt-or-> [options]
"""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence, Union

from .runner import run_cmd

# Types accepted for time/value CLI tokens (stringified for argv).
_Scalar = Union[str, int, float]


def keyframe(
    project: str,
    segment_id: str,
    property: str,  # noqa: A002 — matches CLI flag name "property"
    time: _Scalar,
    value: _Scalar,
    *,
    easing: Optional[str] = None,
    timeout_s: Optional[float] = None,
    check: bool = True,
) -> dict:
    """
    Add one keyframe on a segment.

    Maps to::

        capcut keyframe <project> <segment_id> <property> <time> <value> [--easing …]
    """
    args = [
        "keyframe",
        project,
        segment_id,
        property,
        str(time),
        str(value),
    ]
    if easing:
        args.extend(["--easing", str(easing)])
    return run_cmd(args, timeout_s=timeout_s, check=check)


def list_projects(
    drafts_dir: Optional[str] = None,
    *,
    query: Optional[str] = None,
    names: bool = False,
    timeout_s: Optional[float] = None,
    check: bool = True,
) -> dict:
    """
    List CapCut / JianYing draft folders on disk.

    Maps to::

        capcut projects [query] [--drafts <path>] [--names]
    """
    args: list[str] = ["projects"]
    if query:
        args.append(str(query))
    if drafts_dir:
        args.extend(["--drafts", str(drafts_dir)])
    if names:
        args.append("--names")
    return run_cmd(args, timeout_s=timeout_s, check=check)


def import_srt(
    project: str,
    srt_path: str,
    *,
    timeout_s: Optional[float] = None,
    check: bool = True,
    extra_args: Optional[Sequence[str]] = None,
) -> dict:
    """
    Import an SRT file as text segments.

    Maps to::

        capcut import-srt <project> <srt_path> [options…]
    """
    args: list[str] = ["import-srt", project, srt_path]
    if extra_args:
        args.extend(str(a) for a in extra_args)
    return run_cmd(args, timeout_s=timeout_s, check=check)


def mask(
    project: str,
    segment_id: str,
    slug: Optional[str] = None,
    *,
    off: bool = False,
    timeout_s: Optional[float] = None,
    check: bool = True,
    options: Optional[Mapping[str, Any]] = None,
) -> dict:
    """
    Apply or remove a mask on a segment.

    Maps to::

        capcut mask <project> <id> <slug> [options]
        capcut mask <project> <id> --off
    """
    args: list[str] = ["mask", project, segment_id]
    if off:
        args.append("--off")
    else:
        if not slug:
            raise ValueError("mask() requires slug unless off=True")
        args.append(str(slug))
        if options:
            args.extend(_options_to_argv(options))
    return run_cmd(args, timeout_s=timeout_s, check=check)


def transition(
    project: str,
    segment_id: str,
    slug: str,
    *,
    duration: Optional[_Scalar] = None,
    timeout_s: Optional[float] = None,
    check: bool = True,
) -> dict:
    """
    Add a transition on a segment (first of the pair).

    Maps to::

        capcut transition <project> <id> <slug> [--duration <time>]
    """
    args: list[str] = ["transition", project, segment_id, slug]
    if duration is not None:
        args.extend(["--duration", str(duration)])
    return run_cmd(args, timeout_s=timeout_s, check=check)


def info(project: str, *, timeout_s: Optional[float] = None, check: bool = True) -> dict:
    """``capcut info <project>``."""
    return run_cmd(["info", project], timeout_s=timeout_s, check=check)


def lint(
    project: str,
    *,
    fix: bool = False,
    timeout_s: Optional[float] = None,
    check: bool = False,
) -> dict:
    """``capcut lint <project> [--fix]``. check=False so lint exit 1 is returned."""
    args = ["lint", project]
    if fix:
        args.append("--fix")
    return run_cmd(args, timeout_s=timeout_s, check=check)


def doctor(*, timeout_s: Optional[float] = None, check: bool = False) -> dict:
    """``capcut doctor``."""
    return run_cmd(["doctor"], timeout_s=timeout_s, check=check)


def cut(
    project: str,
    start: _Scalar,
    end: _Scalar,
    out: str,
    *,
    timeout_s: Optional[float] = None,
    check: bool = True,
) -> dict:
    """``capcut cut <project> <start> <end> --out <path>``."""
    return run_cmd(
        ["cut", project, str(start), str(end), "--out", out],
        timeout_s=timeout_s,
        check=check,
    )


def detect_scenes(
    video: str,
    *,
    timeout_s: Optional[float] = None,
    check: bool = True,
    extra_args: Optional[Sequence[str]] = None,
) -> dict:
    """``capcut detect-scenes <video>``."""
    args: list[str] = ["detect-scenes", video]
    if extra_args:
        args.extend(str(a) for a in extra_args)
    return run_cmd(args, timeout_s=timeout_s, check=check)


def caption(
    project: str,
    *,
    audio: Optional[str] = None,
    from_segment: Optional[str] = None,
    timeout_s: Optional[float] = None,
    check: bool = True,
    extra_args: Optional[Sequence[str]] = None,
) -> dict:
    """``capcut caption <project> (--audio | --from-segment)``."""
    args: list[str] = ["caption", project]
    if audio:
        args.extend(["--audio", audio])
    if from_segment:
        args.extend(["--from-segment", from_segment])
    if extra_args:
        args.extend(str(a) for a in extra_args)
    return run_cmd(args, timeout_s=timeout_s, check=check)


def _options_to_argv(options: Mapping[str, Any]) -> list[str]:
    """
    Convert a mapping of CLI options to argv tokens.

    Keys may be ``center_x`` or ``--center-x``; values ``True`` emit a flag only.
    """
    out: list[str] = []
    for key, val in options.items():
        flag = key if str(key).startswith("-") else "--" + str(key).replace("_", "-")
        if val is True:
            out.append(flag)
        elif val is False or val is None:
            continue
        else:
            out.extend([flag, str(val)])
    return out
