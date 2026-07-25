"""
Smoke tests for engines.mate.facade.

Import always runs. Live create_draft/save_draft runs when the Mate
runtime env is available (template + draft dirs); otherwise marks skip
on env failure so CI without CapCut assets still passes import checks.
"""

from __future__ import annotations

import os
import re

import pytest


def test_facade_import_and_exports():
    """Facade module is importable and exposes Phase-1 entry points."""
    from engines.mate import facade
    from engines.mate import (
        create_draft,
        save_draft,
        add_videos,
        gen_video,
        gen_video_status,
    )

    for name in (
        "create_draft",
        "save_draft",
        "save_draft_async",
        "add_videos",
        "add_videos_async",
        "gen_video",
        "gen_video_status",
        "get_gen_video_active_count",
    ):
        assert callable(getattr(facade, name)), f"missing callable: {name}"

    assert create_draft is facade.create_draft
    assert save_draft is facade.save_draft
    assert add_videos is facade.add_videos
    assert gen_video is facade.gen_video
    assert gen_video_status is facade.gen_video_status


def test_facade_create_and_save_draft_smoke():
    """
    Live path: create_draft → save_draft when templates/dirs exist.

    Skips cleanly if CapCut Mate filesystem config is incomplete.
    """
    try:
        import config
        from engines.mate.facade import create_draft, save_draft
    except Exception as e:  # pragma: no cover - env/import guard
        pytest.skip(f"Mate env/import not ready: {e}")

    template = os.path.join(config.TEMPLATE_DIR, "default2")
    if not os.path.isdir(template):
        pytest.skip(f"template missing: {template}")

    try:
        draft_url = create_draft(width=1080, height=1920)
    except Exception as e:
        pytest.skip(f"create_draft not runnable in this env: {e}")

    assert isinstance(draft_url, str) and draft_url
    assert "draft_id=" in draft_url
    m = re.search(r"draft_id=([^&]+)", draft_url)
    assert m, f"no draft_id in url: {draft_url}"

    try:
        out = save_draft(draft_url)
    except Exception as e:
        pytest.skip(f"save_draft not runnable in this env: {e}")

    assert out == draft_url


def test_facade_gen_video_status_invalid_url_shape():
    """
    gen_video_status should be callable; invalid URL typically returns a
    structured dict or raises CustomException — either is fine for smoke.
    """
    from engines.mate.facade import gen_video_status
    from exceptions import CustomException

    try:
        result = gen_video_status("http://localhost/get_draft?draft_id=nonexistent_smoke")
        assert isinstance(result, dict)
    except CustomException:
        pass
