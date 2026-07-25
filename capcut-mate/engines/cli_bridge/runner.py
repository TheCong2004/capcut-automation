"""
Low-level subprocess runner for capcut-cli.

``run_cmd(args, timeout_s)`` prefixes ``args`` with CAPCUT_CLI_BIN and returns
a result dict ``{ok, stdout, stderr, code}``. On binary-missing, timeout, or
non-zero exit (when ``check=True``), raises bilingual exceptions.
"""

from __future__ import annotations

import logging
import subprocess
from dataclasses import dataclass
from typing import List, Optional, Sequence, Union

from .config import get_cli_bin, get_default_timeout
from .exceptions import (
    CliBinaryNotFoundError,
    CliCommandFailedError,
    CliTimeoutError,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RunResult:
    """Structured result of a capcut-cli invocation."""

    ok: bool
    stdout: str
    stderr: str
    code: int
    cmd: tuple  # immutable snapshot of full argv

    def to_dict(self) -> dict:
        """Public shape: {ok, stdout, stderr, code} (+ cmd for debugging)."""
        return {
            "ok": self.ok,
            "stdout": self.stdout,
            "stderr": self.stderr,
            "code": self.code,
            "cmd": list(self.cmd),
        }


def run_cmd(
    args: Sequence[str],
    timeout_s: Optional[float] = None,
    *,
    check: bool = True,
    cwd: Optional[str] = None,
) -> dict:
    """
    Run ``capcut <args…>`` via subprocess.

    Parameters
    ----------
    args:
        Subcommand and arguments only (e.g. ``["keyframe", project, id, …]``).
        The binary from :func:`get_cli_bin` is prepended.
    timeout_s:
        Kill the process after this many seconds. Defaults to
        ``CAPCUT_CLI_TIMEOUT_S`` / 60s.
    check:
        If True (default), raise on non-zero exit / missing binary / timeout.
        If False, still raise on missing binary and timeout, but return
        ``ok=False`` for non-zero exit.
    cwd:
        Optional working directory for the child process.

    Returns
    -------
    dict with keys: ``ok``, ``stdout``, ``stderr``, ``code``, ``cmd``.

    Raises
    ------
    CliBinaryNotFoundError
        CAPCUT_CLI_BIN / ``capcut`` not found.
    CliTimeoutError
        Process exceeded ``timeout_s``.
    CliCommandFailedError
        Non-zero exit when ``check=True``.
    ValueError
        Empty ``args``.
    """
    if not args:
        raise ValueError("run_cmd requires a non-empty args list (subcommand…)")

    cli_bin = get_cli_bin()
    full_cmd: List[str] = list(cli_bin) + [str(a) for a in args]
    timeout = get_default_timeout() if timeout_s is None else float(timeout_s)
    if timeout <= 0:
        raise ValueError("timeout_s must be > 0")

    logger.debug("cli_bridge run: %s (timeout=%ss)", full_cmd, timeout)

    try:
        completed = subprocess.run(
            full_cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            cwd=cwd,
            shell=False,
        )
    except FileNotFoundError as exc:
        # Binary itself missing (first argv component).
        raise CliBinaryNotFoundError(cli_bin, detail=str(exc)) from exc
    except subprocess.TimeoutExpired as exc:
        out = _decode_optional(exc.stdout)
        err = _decode_optional(exc.stderr)
        raise CliTimeoutError(full_cmd, timeout, stdout=out, stderr=err) from exc
    except OSError as exc:
        # e.g. WinError 193 bad executable, permission denied
        raise CliBinaryNotFoundError(cli_bin, detail=str(exc)) from exc

    stdout = completed.stdout or ""
    stderr = completed.stderr or ""
    code = int(completed.returncode)
    ok = code == 0

    result = RunResult(
        ok=ok,
        stdout=stdout,
        stderr=stderr,
        code=code,
        cmd=tuple(full_cmd),
    )

    if not ok and check:
        raise CliCommandFailedError(
            full_cmd,
            code,
            stdout=stdout,
            stderr=stderr,
        )

    return result.to_dict()


def _decode_optional(data: Union[str, bytes, None]) -> str:
    if data is None:
        return ""
    if isinstance(data, bytes):
        return data.decode("utf-8", errors="replace")
    return data
