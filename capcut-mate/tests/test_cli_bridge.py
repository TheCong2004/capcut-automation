"""Unit tests for engines.cli_bridge — subprocess mocked (no Node required)."""

from __future__ import annotations

import os
import subprocess
import sys
from unittest.mock import MagicMock, patch

import pytest

# capcut-mate root on path (same pattern as other tests)
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from engines.cli_bridge import (  # noqa: E402
    CliBinaryNotFoundError,
    CliCommandFailedError,
    CliTimeoutError,
    get_cli_bin,
    import_srt,
    keyframe,
    list_projects,
    mask,
    run_cmd,
    transition,
)
from engines.cli_bridge.config import DEFAULT_CLI_BIN, get_default_timeout  # noqa: E402


# ---------------------------------------------------------------------------
# config
# ---------------------------------------------------------------------------


def test_get_cli_bin_default(monkeypatch):
    monkeypatch.delenv("CAPCUT_CLI_BIN", raising=False)
    assert get_cli_bin() == [DEFAULT_CLI_BIN]


def test_get_cli_bin_simple_path(monkeypatch):
    monkeypatch.setenv("CAPCUT_CLI_BIN", r"C:\tools\capcut.cmd")
    assert get_cli_bin() == [r"C:\tools\capcut.cmd"]


def test_get_cli_bin_npx_multiword(monkeypatch):
    monkeypatch.setenv("CAPCUT_CLI_BIN", "npx --yes capcut-cli")
    parts = get_cli_bin()
    assert parts[0] == "npx"
    assert "capcut-cli" in parts


def test_get_default_timeout_default(monkeypatch):
    monkeypatch.delenv("CAPCUT_CLI_TIMEOUT_S", raising=False)
    assert get_default_timeout() == 60.0


def test_get_default_timeout_override(monkeypatch):
    monkeypatch.setenv("CAPCUT_CLI_TIMEOUT_S", "12.5")
    assert get_default_timeout() == 12.5


# ---------------------------------------------------------------------------
# run_cmd
# ---------------------------------------------------------------------------


def _fake_completed(code=0, stdout="ok\n", stderr=""):
    m = MagicMock()
    m.returncode = code
    m.stdout = stdout
    m.stderr = stderr
    return m


@patch("engines.cli_bridge.runner.subprocess.run")
def test_run_cmd_success(mock_run, monkeypatch):
    monkeypatch.setenv("CAPCUT_CLI_BIN", "capcut")
    mock_run.return_value = _fake_completed(0, stdout='{"projects":[]}\n')

    result = run_cmd(["projects", "--names"], timeout_s=10)

    assert result["ok"] is True
    assert result["code"] == 0
    assert "projects" in result["stdout"] or result["stdout"]
    assert result["cmd"][0] == "capcut"
    assert result["cmd"][1:] == ["projects", "--names"]

    mock_run.assert_called_once()
    call_kwargs = mock_run.call_args
    assert call_kwargs[0][0] == ["capcut", "projects", "--names"]
    assert call_kwargs[1]["timeout"] == 10
    assert call_kwargs[1]["shell"] is False


@patch("engines.cli_bridge.runner.subprocess.run")
def test_run_cmd_non_zero_raises(mock_run, monkeypatch):
    monkeypatch.setenv("CAPCUT_CLI_BIN", "capcut")
    mock_run.return_value = _fake_completed(2, stdout="", stderr="segment not found")

    with pytest.raises(CliCommandFailedError) as ei:
        run_cmd(["keyframe", "p", "id", "scale", "0s", "1"])

    exc = ei.value
    assert exc.code == 2
    assert "thất bại" in str(exc) or "failed" in str(exc).lower()
    assert "segment not found" in exc.stderr


@patch("engines.cli_bridge.runner.subprocess.run")
def test_run_cmd_non_zero_check_false(mock_run, monkeypatch):
    monkeypatch.setenv("CAPCUT_CLI_BIN", "capcut")
    mock_run.return_value = _fake_completed(1, stderr="boom")

    result = run_cmd(["projects"], check=False)
    assert result["ok"] is False
    assert result["code"] == 1
    assert result["stderr"] == "boom"


@patch("engines.cli_bridge.runner.subprocess.run")
def test_run_cmd_binary_missing(mock_run, monkeypatch):
    monkeypatch.setenv("CAPCUT_CLI_BIN", "capcut-not-installed-xyz")
    mock_run.side_effect = FileNotFoundError(2, "No such file")

    with pytest.raises(CliBinaryNotFoundError) as ei:
        run_cmd(["doctor"])

    assert "Không tìm thấy" in str(ei.value) or "not found" in str(ei.value).lower()


@patch("engines.cli_bridge.runner.subprocess.run")
def test_run_cmd_timeout(mock_run, monkeypatch):
    monkeypatch.setenv("CAPCUT_CLI_BIN", "capcut")
    mock_run.side_effect = subprocess.TimeoutExpired(cmd=["capcut"], timeout=5)

    with pytest.raises(CliTimeoutError) as ei:
        run_cmd(["caption", "p", "--audio", "a.wav"], timeout_s=5)

    assert ei.value.timeout_s == 5
    assert "timeout" in str(ei.value).lower() or "hết thời gian" in str(ei.value)


def test_run_cmd_empty_args():
    with pytest.raises(ValueError):
        run_cmd([])


# ---------------------------------------------------------------------------
# wrappers build correct argv
# ---------------------------------------------------------------------------


@patch("engines.cli_bridge.wrappers.run_cmd")
def test_keyframe_wrapper(mock_run_cmd):
    mock_run_cmd.return_value = {"ok": True, "stdout": "", "stderr": "", "code": 0, "cmd": []}

    keyframe("proj", "seg1", "position_x", "0s", 0.5, easing="ease-in")

    mock_run_cmd.assert_called_once()
    args = mock_run_cmd.call_args[0][0]
    assert args == [
        "keyframe",
        "proj",
        "seg1",
        "position_x",
        "0s",
        "0.5",
        "--easing",
        "ease-in",
    ]


@patch("engines.cli_bridge.wrappers.run_cmd")
def test_list_projects_wrapper(mock_run_cmd):
    mock_run_cmd.return_value = {"ok": True, "stdout": "[]", "stderr": "", "code": 0, "cmd": []}

    list_projects(drafts_dir="/drafts", query="demo", names=True)

    args = mock_run_cmd.call_args[0][0]
    assert args[0] == "projects"
    assert "demo" in args
    assert args[args.index("--drafts") + 1] == "/drafts"
    assert "--names" in args


@patch("engines.cli_bridge.wrappers.run_cmd")
def test_list_projects_minimal(mock_run_cmd):
    mock_run_cmd.return_value = {"ok": True, "stdout": "", "stderr": "", "code": 0, "cmd": []}
    list_projects()
    assert mock_run_cmd.call_args[0][0] == ["projects"]


@patch("engines.cli_bridge.wrappers.run_cmd")
def test_import_srt_wrapper(mock_run_cmd):
    mock_run_cmd.return_value = {"ok": True, "stdout": "", "stderr": "", "code": 0, "cmd": []}

    import_srt("proj", "/tmp/a.srt", extra_args=["--time-offset", "1s"])

    args = mock_run_cmd.call_args[0][0]
    assert args == ["import-srt", "proj", "/tmp/a.srt", "--time-offset", "1s"]


@patch("engines.cli_bridge.wrappers.run_cmd")
def test_mask_and_transition_wrappers(mock_run_cmd):
    mock_run_cmd.return_value = {"ok": True, "stdout": "", "stderr": "", "code": 0, "cmd": []}

    mask("proj", "seg", "circle", options={"size": 0.5, "invert": True})
    args = mock_run_cmd.call_args[0][0]
    assert args[:4] == ["mask", "proj", "seg", "circle"]
    assert "--size" in args and "0.5" in args
    assert "--invert" in args

    mock_run_cmd.reset_mock()
    mask("proj", "seg", off=True)
    assert mock_run_cmd.call_args[0][0] == ["mask", "proj", "seg", "--off"]

    mock_run_cmd.reset_mock()
    transition("proj", "seg", "dissolve", duration="0.5s")
    assert mock_run_cmd.call_args[0][0] == [
        "transition",
        "proj",
        "seg",
        "dissolve",
        "--duration",
        "0.5s",
    ]


def test_mask_requires_slug():
    with pytest.raises(ValueError):
        mask("proj", "seg")


def test_exception_as_dict_bilingual():
    err = CliCommandFailedError(["capcut", "x"], 1, stderr="nope")
    d_vi = err.as_dict(lang="vi")
    d_en = err.as_dict(lang="en")
    assert d_vi["code"] == 1
    assert "thất bại" in d_vi["message"]
    assert "failed" in d_en["message"].lower()
    assert d_vi["stderr"] == "nope"
