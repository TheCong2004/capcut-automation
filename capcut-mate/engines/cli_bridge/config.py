"""
Configuration for the capcut-cli subprocess bridge.

Environment
-----------
CAPCUT_CLI_BIN
    Path or command used to invoke capcut-cli.
    Default: ``capcut`` (global npm install).
    Examples:
      - ``capcut``
      - ``C:\\Users\\me\\AppData\\Roaming\\npm\\capcut.cmd``
      - ``npx --yes capcut-cli``
      - ``node /path/to/capcut-cli/dist/index.js``

CAPCUT_CLI_TIMEOUT_S
    Default subprocess timeout in seconds (default: 60).
"""

from __future__ import annotations

import os
import shlex
from typing import List

DEFAULT_CLI_BIN = "capcut"
DEFAULT_TIMEOUT_S = 60.0

_ENV_BIN = "CAPCUT_CLI_BIN"
_ENV_TIMEOUT = "CAPCUT_CLI_TIMEOUT_S"


def get_cli_bin() -> List[str]:
    """
    Resolve CAPCUT_CLI_BIN into an argv prefix for subprocess.

    Multi-word values (e.g. ``npx --yes capcut-cli``) are split safely
    for the current OS.
    """
    raw = os.getenv(_ENV_BIN, DEFAULT_CLI_BIN)
    if raw is None or not str(raw).strip():
        return [DEFAULT_CLI_BIN]

    text = str(raw).strip()
    # Windows: posix=False keeps backslashes; Unix: posix=True handles quotes.
    posix = os.name != "nt"
    parts = shlex.split(text, posix=posix)
    return parts if parts else [DEFAULT_CLI_BIN]


def get_default_timeout() -> float:
    """Return default timeout in seconds from env or DEFAULT_TIMEOUT_S."""
    raw = os.getenv(_ENV_TIMEOUT)
    if raw is None or not str(raw).strip():
        return DEFAULT_TIMEOUT_S
    try:
        value = float(str(raw).strip())
    except ValueError as exc:
        raise ValueError(
            f"CAPCUT_CLI_TIMEOUT_S must be a number, got {raw!r}"
        ) from exc
    if value <= 0:
        raise ValueError("CAPCUT_CLI_TIMEOUT_S must be > 0")
    return value
