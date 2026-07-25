"""
Grok B — motion engine tests on a real CapCut draft copy.

Pure Python only; no subprocess capcut-cli.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from engines.local.draft_io import load_raw_draft, save_raw_draft
from engines.local import motion as motion_eng
from engines.local.inspect import find_segment, list_segments

# Real draft produced by Mate create_draft (has sticker segments)
_REAL_DRAFT = (
    Path(__file__).resolve().parents[1]
    / "output"
    / "draft"
    / "2026071901005889bc937a"
)


def _require_real_draft() -> Path:
    if not _REAL_DRAFT.is_dir():
        pytest.skip(f"real draft missing: {_REAL_DRAFT}")
    content = _REAL_DRAFT / "draft_content.json"
    info = _REAL_DRAFT / "draft_info.json"
    if not content.is_file() and not info.is_file():
        pytest.skip(f"no draft json in {_REAL_DRAFT}")
    return _REAL_DRAFT


@pytest.fixture
def real_project(tmp_path: Path) -> Path:
    """Copy real draft tree so tests mutate a sandbox only."""
    src = _require_real_draft()
    dest = tmp_path / "draft_real"
    shutil.copytree(src, dest)
    return dest


@pytest.fixture
def real_segment_id(real_project: Path) -> str:
    draft, _ = load_raw_draft(str(real_project))
    segs = list_segments(draft)
    assert segs, "real draft has no segments"
    return segs[0]["id"]


def test_add_keyframe_on_real_draft(real_project: Path, real_segment_id: str):
    draft, path = load_raw_draft(str(real_project))
    kf0 = motion_eng.add_keyframe(
        draft, real_segment_id, "position_x", 0, 0.0, easing="linear"
    )
    kf1 = motion_eng.add_keyframe(
        draft, real_segment_id, "KFTypePositionX", 1_000_000, 0.25, easing="ease-out"
    )
    save_raw_draft(path, draft)

    reloaded, _ = load_raw_draft(str(real_project))
    seg = find_segment(reloaded, real_segment_id)
    assert seg is not None
    buckets = [
        b
        for b in (seg.get("common_keyframes") or [])
        if b.get("property_type") == "KFTypePositionX"
    ]
    assert len(buckets) == 1
    klist = buckets[0]["keyframe_list"]
    assert len(klist) == 2
    assert klist[0]["time_offset"] == 0
    assert klist[1]["values"] == [0.25]
    # easing applied because adjacent keyframe exists
    assert klist[1]["curveType"] == "FreeCurveInOut"
    assert klist[0]["curveType"] == "FreeCurveInOut"
    assert klist[0]["right_control"]["x"] != 0  # ease-out startRightXRatio * interval
    assert kf0["property_type"] == "KFTypePositionX"
    assert kf1["easing"] == "ease-out"


def test_keyframe_upsert_same_offset(real_project: Path, real_segment_id: str):
    draft, path = load_raw_draft(str(real_project))
    motion_eng.add_keyframe(draft, real_segment_id, "scale_x", 500_000, 1.0)
    motion_eng.add_keyframe(draft, real_segment_id, "scale_x", 500_000, 1.5)
    save_raw_draft(path, draft)

    reloaded, _ = load_raw_draft(str(real_project))
    seg = find_segment(reloaded, real_segment_id)
    bucket = next(
        b
        for b in seg["common_keyframes"]
        if b["property_type"] == "KFTypeScaleX"
    )
    assert len(bucket["keyframe_list"]) == 1
    assert bucket["keyframe_list"][0]["values"] == [1.5]


def test_keyframe_missing_segment(real_project: Path):
    draft, _ = load_raw_draft(str(real_project))
    with pytest.raises(KeyError):
        motion_eng.add_keyframe(draft, "no_such_segment_id", "position_x", 0, 0.1)


def test_keyframe_bad_property(real_project: Path, real_segment_id: str):
    draft, _ = load_raw_draft(str(real_project))
    with pytest.raises(ValueError, match="property"):
        motion_eng.add_keyframe(draft, real_segment_id, "not_a_prop", 0, 1.0)


def test_keyframe_bad_easing(real_project: Path, real_segment_id: str):
    draft, _ = load_raw_draft(str(real_project))
    with pytest.raises(ValueError, match="easing"):
        motion_eng.add_keyframe(
            draft, real_segment_id, "position_x", 0, 0.0, easing="bounce"
        )


def test_transition_real_resource_id(real_project: Path, real_segment_id: str):
    from src.pyJianYingDraft.metadata import TransitionType

    expected = TransitionType.叠化.value
    draft, path = load_raw_draft(str(real_project))
    # alias 淡入淡出 → 叠化
    tmat = motion_eng.add_transition(
        draft, real_segment_id, "淡入淡出", duration_us=500_000
    )
    save_raw_draft(path, draft)

    assert tmat["name"] == expected.name
    assert tmat["resource_id"] == expected.resource_id
    assert tmat["effect_id"] == expected.effect_id
    assert tmat["resource_id"]  # non-empty real id
    assert tmat["type"] == "transition"
    assert tmat["duration"] == 500_000

    reloaded, _ = load_raw_draft(str(real_project))
    mats = reloaded["materials"]["transitions"]
    assert any(m.get("id") == tmat["id"] for m in mats)
    seg = find_segment(reloaded, real_segment_id)
    assert tmat["id"] in (seg.get("extra_material_refs") or [])
    assert seg["transition"]["resource_id"] == expected.resource_id


def test_transition_replace_does_not_stack(real_project: Path, real_segment_id: str):
    draft, path = load_raw_draft(str(real_project))
    t1 = motion_eng.add_transition(draft, real_segment_id, "叠化", 400_000)
    t2 = motion_eng.add_transition(draft, real_segment_id, "上移", 300_000, replace=True)
    save_raw_draft(path, draft)

    reloaded, _ = load_raw_draft(str(real_project))
    mats = reloaded["materials"]["transitions"]
    assert len(mats) == 1
    assert mats[0]["id"] == t2["id"]
    assert mats[0]["name"] == "上移"
    assert mats[0]["resource_id"]
    seg = find_segment(reloaded, real_segment_id)
    refs = seg.get("extra_material_refs") or []
    assert t1["id"] not in refs
    assert t2["id"] in refs


def test_transition_unknown_name(real_project: Path, real_segment_id: str):
    draft, _ = load_raw_draft(str(real_project))
    with pytest.raises(ValueError, match="transition"):
        motion_eng.add_transition(draft, real_segment_id, "___not_a_real_transition___")


def test_save_creates_bak(real_project: Path, real_segment_id: str):
    draft, path = load_raw_draft(str(real_project))
    motion_eng.add_keyframe(draft, real_segment_id, "rotation", 0, 15.0)
    save_raw_draft(path, draft)
    bak = path.with_suffix(path.suffix + ".bak")
    assert bak.is_file()


def test_http_keyframe_and_transition(real_project: Path, real_segment_id: str):
    try:
        from fastapi.testclient import TestClient
        from main import app
    except Exception as e:  # pragma: no cover
        pytest.skip(f"TestClient unavailable: {e}")

    try:
        client = TestClient(app)
    except RuntimeError as e:
        pytest.skip(f"TestClient needs httpx: {e}")
    prefix = "/openapi/capcut-mate/v1/local"

    r = client.post(
        f"{prefix}/keyframe",
        json={
            "project": str(real_project),
            "segment_id": real_segment_id,
            "property": "position_y",
            "offset_us": 0,
            "value": -0.1,
            "easing": "linear",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    # middleware may wrap; tolerate either shape
    data = body.get("data") if isinstance(body.get("data"), dict) else body
    if "ok" in data:
        assert data["ok"] is True
    assert "keyframe" in data or (body.get("code") == 0)

    r404 = client.post(
        f"{prefix}/keyframe",
        json={
            "project": str(real_project),
            "segment_id": "missing-seg",
            "property": "position_x",
            "offset_us": 0,
            "value": 0,
        },
    )
    assert r404.status_code in (404, 200)  # some middleware maps errors to 200+code
    if r404.status_code == 200:
        assert r404.json().get("code", 0) != 0 or "không tồn tại" in json.dumps(
            r404.json(), ensure_ascii=False
        )

    r2 = client.post(
        f"{prefix}/transition",
        json={
            "project": str(real_project),
            "segment_id": real_segment_id,
            "name": "叠化",
            "duration_us": 500000,
        },
    )
    assert r2.status_code == 200, r2.text
    tbody = r2.json()
    tdata = tbody.get("data") if isinstance(tbody.get("data"), dict) else tbody
    tr = tdata.get("transition") or {}
    if tr:
        assert tr.get("resource_id")
        assert tr.get("effect_id")
