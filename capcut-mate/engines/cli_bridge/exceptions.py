"""Bilingual (VI/EN) exceptions for the capcut-cli bridge."""

from __future__ import annotations

from typing import List, Optional, Sequence


class CliBridgeError(Exception):
    """Base error for engines.cli_bridge."""

    def __init__(
        self,
        message_vi: str,
        message_en: str,
        *,
        code: Optional[int] = None,
        cmd: Optional[Sequence[str]] = None,
        stdout: str = "",
        stderr: str = "",
    ) -> None:
        self.message_vi = message_vi
        self.message_en = message_en
        self.code = code
        self.cmd: List[str] = list(cmd) if cmd else []
        self.stdout = stdout or ""
        self.stderr = stderr or ""
        super().__init__(self._combined())

    def _combined(self) -> str:
        return f"{self.message_vi} / {self.message_en}"

    def as_dict(self, lang: str = "zh") -> dict:
        """
        Shape similar to CustomError.as_dict for future HTTP mapping.

        lang: ``vi`` | ``en`` | ``zh`` (zh falls back to vi for bridge errors).
        """
        if lang == "en":
            message = self.message_en
        else:
            message = self.message_vi
        return {
            "code": self.code if self.code is not None else -1,
            "message": message,
            "message_vi": self.message_vi,
            "message_en": self.message_en,
            "cmd": self.cmd,
            "stdout": self.stdout,
            "stderr": self.stderr,
        }


class CliBinaryNotFoundError(CliBridgeError):
    """capcut / CAPCUT_CLI_BIN not found on PATH or filesystem."""

    def __init__(
        self,
        cli_bin: Sequence[str],
        *,
        detail: str = "",
    ) -> None:
        bin_display = " ".join(cli_bin) if cli_bin else "capcut"
        extra = f" ({detail})" if detail else ""
        super().__init__(
            message_vi=(
                f"Không tìm thấy binary capcut-cli: '{bin_display}'. "
                f"Cài Node.js và capcut-cli (npm i -g capcut-cli), "
                f"hoặc set CAPCUT_CLI_BIN.{extra}"
            ),
            message_en=(
                f"capcut-cli binary not found: '{bin_display}'. "
                f"Install Node.js and capcut-cli (npm i -g capcut-cli), "
                f"or set CAPCUT_CLI_BIN.{extra}"
            ),
            code=None,
            cmd=list(cli_bin),
        )


class CliTimeoutError(CliBridgeError):
    """Subprocess exceeded timeout_s."""

    def __init__(
        self,
        cmd: Sequence[str],
        timeout_s: float,
        *,
        stdout: str = "",
        stderr: str = "",
    ) -> None:
        cmd_display = " ".join(cmd)
        super().__init__(
            message_vi=(
                f"Lệnh capcut-cli hết thời gian chờ sau {timeout_s}s: {cmd_display}"
            ),
            message_en=(
                f"capcut-cli timed out after {timeout_s}s: {cmd_display}"
            ),
            code=None,
            cmd=cmd,
            stdout=stdout,
            stderr=stderr,
        )
        self.timeout_s = timeout_s


class CliCommandFailedError(CliBridgeError):
    """Non-zero exit code from capcut-cli."""

    def __init__(
        self,
        cmd: Sequence[str],
        code: int,
        *,
        stdout: str = "",
        stderr: str = "",
    ) -> None:
        cmd_display = " ".join(cmd)
        tail = (stderr or stdout or "").strip()
        if len(tail) > 500:
            tail = tail[:500] + "…"
        detail = f" — {tail}" if tail else ""
        super().__init__(
            message_vi=(
                f"Lệnh capcut-cli thất bại (exit {code}): {cmd_display}{detail}"
            ),
            message_en=(
                f"capcut-cli failed (exit {code}): {cmd_display}{detail}"
            ),
            code=code,
            cmd=cmd,
            stdout=stdout,
            stderr=stderr,
        )
