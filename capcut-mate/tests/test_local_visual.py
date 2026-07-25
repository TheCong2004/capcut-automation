"""Grok C — engines.local.visual harden tests (pure Python, real draft)."""

from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from engines.local import visual  # noqa: E402
from engines.local.draft_io import load_raw_draft, save_raw_draft  # noqa: E402
from engines.local.inspect import find_segment, list_segments  # noqa: E402

REAL_DRAFT = ROOT / "output" / "draft" / "2026071901005889bc937a"


def _minimal_draft(seg_id: str = "seg-video-1") -> dict:
    return {
        "id": "test-draft",
        "canvas_config": {"width": 1920, "height": 1080, "ratio": "16:9"},
        "materials": {
            "videos": [
                {
                    "id": "mat-v1",
                    "type": "video",
                    "width": 1920,
                    "height": 1080,
                    "path": "/tmp/x.mp4",
                }
            ],
            "masks": [],
            "speeds": [],
        },
        "tracks": [
            {
                "id": "trk-v",
                "type": "video",
                "name": "video",
                "segments": [
                    {
                        "id": seg_id,
                        "material_id": "mat-v1",
                        "target_timerange": {"start": 0, "duration": 3_000_000},
                        "extra_material_refs": [],
                        "clip": {
                            "alpha": 1.0,
                            "flip": {"horizontal": False, "vertical": False},
                            "rotation": 0.0,
                            "scale": {"x": 1.0, "y": 1.0},
                            "transform": {"x": 0.0, "y": 0.0},
                        },
                    }
                ],
            }
        ],
    }


# ---------------------------------------------------------------------------
# Unit: mask geometry / materials schema
# ---------------------------------------------------------------------------


def test_set_mask_writes_materials_and_refs():
    draft = _minimal_draft()
    m = visual.set_mask(draft, "seg-video-1", name="圆形", width=512, height=512, feather=10)

    assert m["type"] == "mask"
    assert m["name"] == "圆形"
    assert m["resource_type"] == "circle"
    assert m["resource_id"] == "6791700663249146381"
    assert m["config"]["feather"] == pytest.approx(0.1)
    # size = 512/1080
    assert m["config"]["height"] == pytest.approx(512 / 1080)
    assert m["config"]["centerX"] == 0.0

    masks = draft["materials"]["masks"]
    assert len(masks) == 1
    assert masks[0]["id"] == m["id"]

    seg = find_segment(draft, "seg-video-1")
    assert m["id"] in seg["extra_material_refs"]
    assert "mask" not in seg  # no legacy field


def test_set_mask_rectangle_geometry():
    draft = _minimal_draft()
    m = visual.set_mask(
        draft,
        "seg-video-1",
        name="rectangle",
        width=800,
        height=600,
        round_corner=25,
        center_x=100,
        center_y=-50,
        rotation=15,
        invert=True,
    )
    assert m["name"] == "矩形"
    assert m["resource_type"] == "rectangle"
    assert m["config"]["width"] == pytest.approx(800 / 1920)
    assert m["config"]["height"] == pytest.approx(600 / 1080)
    assert m["config"]["roundCorner"] == pytest.approx(0.25)
    assert m["config"]["invert"] is True
    assert m["config"]["rotation"] == 15.0
    # center in half-material units: 100/(1920/2)
    assert m["config"]["centerX"] == pytest.approx(100 / 960)
    assert m["config"]["centerY"] == pytest.approx(-50 / 540)


def test_set_mask_en_aliases():
    draft = _minimal_draft()
    for alias, cn in (("circle", "圆形"), ("heart", "爱心"), ("star", "星形"), ("linear", "线性")):
        d = _minimal_draft(f"s-{alias}")
        # rebuild one segment id
        d["tracks"][0]["segments"][0]["id"] = f"s-{alias}"
        m = visual.set_mask(d, f"s-{alias}", name=alias)
        assert m["name"] == cn


def test_set_mask_off_removes():
    draft = _minimal_draft()
    m = visual.set_mask(draft, "seg-video-1", name="圆形")
    mid = m["id"]
    out = visual.set_mask(draft, "seg-video-1", off=True)
    assert out["off"] is True
    assert mid in out["removed_ids"]
    assert draft["materials"]["masks"] == []
    seg = find_segment(draft, "seg-video-1")
    assert mid not in (seg.get("extra_material_refs") or [])


def test_set_mask_replace_existing():
    draft = _minimal_draft()
    m1 = visual.set_mask(draft, "seg-video-1", name="圆形")
    m2 = visual.set_mask(draft, "seg-video-1", name="矩形", width=400, height=400)
    assert m1["id"] != m2["id"]
    assert len(draft["materials"]["masks"]) == 1
    assert draft["materials"]["masks"][0]["id"] == m2["id"]
    seg = find_segment(draft, "seg-video-1")
    assert m1["id"] not in seg["extra_material_refs"]
    assert m2["id"] in seg["extra_material_refs"]


def test_set_mask_unknown_type():
    draft = _minimal_draft()
    with pytest.raises(ValueError, match="Unsupported|không hỗ trợ"):
        visual.set_mask(draft, "seg-video-1", name="nope-shape")


def test_set_mask_missing_segment():
    draft = _minimal_draft()
    with pytest.raises(KeyError):
        visual.set_mask(draft, "missing", name="圆形")


def test_round_corner_only_rectangle():
    draft = _minimal_draft()
    with pytest.raises(ValueError, match="rectangle"):
        visual.set_mask(draft, "seg-video-1", name="圆形", round_corner=10)


# ---------------------------------------------------------------------------
# Transform
# ---------------------------------------------------------------------------


def test_set_transform_clip():
    draft = _minimal_draft()
    clip = visual.set_transform(
        draft,
        "seg-video-1",
        scale_x=1.2,
        scale_y=0.8,
        transform_x=0.1,
        transform_y=-0.2,
        rotation=45,
        alpha=0.9,
    )
    assert clip["scale"] == {"x": 1.2, "y": 0.8}
    assert clip["transform"] == {"x": 0.1, "y": -0.2}
    assert clip["rotation"] == 45.0
    assert clip["alpha"] == 0.9


def test_set_transform_requires_field():
    draft = _minimal_draft()
    with pytest.raises(ValueError, match="at least one"):
        visual.set_transform(draft, "seg-video-1")


def test_set_transform_invalid_scale():
    draft = _minimal_draft()
    with pytest.raises(ValueError, match="scale_x"):
        visual.set_transform(draft, "seg-video-1", scale_x=0)


# ---------------------------------------------------------------------------
# Real CapCut draft folder (copy → mutate → assert → discard)
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not REAL_DRAFT.is_dir(), reason="real draft fixture missing")
def test_real_draft_mask_and_transform():
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp) / "draft"
        shutil.copytree(REAL_DRAFT, work)

        draft, path = load_raw_draft(str(work))
        segs = list_segments(draft)
        assert segs, "expected segments in real draft"
        seg_id = segs[0]["id"]
        before_refs = list(find_segment(draft, seg_id).get("extra_material_refs") or [])

        mask = visual.set_mask(
            draft,
            seg_id,
            name="circle",
            width=400,
            height=400,
            feather=20,
            center_x=0,
            center_y=0,
        )
        clip = visual.set_transform(
            draft,
            seg_id,
            scale_x=1.15,
            scale_y=1.15,
            rotation=5.0,
        )
        save_raw_draft(path, draft, backup=False)

        # Reload from disk
        draft2, _ = load_raw_draft(str(work))
        seg2 = find_segment(draft2, seg_id)
        assert seg2 is not None
        assert mask["id"] in (seg2.get("extra_material_refs") or [])
        for r in before_refs:
            assert r in seg2["extra_material_refs"]

        masks = (draft2.get("materials") or {}).get("masks") or []
        assert any(isinstance(m, dict) and m.get("id") == mask["id"] for m in masks)
        got = next(m for m in masks if m["id"] == mask["id"])
        assert got["type"] == "mask"
        assert got["resource_id"]
        assert "config" in got
        assert got["config"]["feather"] == pytest.approx(0.2)

        assert seg2["clip"]["scale"]["x"] == pytest.approx(1.15)
        assert seg2["clip"]["rotation"] == pytest.approx(5.0)
        assert clip["scale"]["x"] == pytest.approx(1.15)

        # off
        visual.set_mask(draft2, seg_id, off=True)
        save_raw_draft(path, draft2, backup=False)
        draft3, _ = load_raw_draft(str(work))
        seg3 = find_segment(draft3, seg_id)
        assert mask["id"] not in (seg3.get("extra_material_refs") or [])
        masks3 = (draft3.get("materials") or {}).get("masks") or []
        assert not any(isinstance(m, dict) and m.get("id") == mask["id"] for m in masks3)


# ---------------------------------------------------------------------------
# Router smoke (optional FastAPI TestClient)
# ---------------------------------------------------------------------------


def test_router_mask_422_and_404():
    """Call router handlers directly (no httpx / TestClient required)."""
    from fastapi import HTTPException

    from src.router.local_visual import (
        MaskBody,
        TransformBody,
        local_mask,
        local_transform,
    )

    with tempfile.TemporaryDirectory() as tmp:
        d = _minimal_draft()
        p = Path(tmp) / "draft_content.json"
        p.write_text(json.dumps(d), encoding="utf-8")

        with pytest.raises(HTTPException) as ei:
            local_mask(
                MaskBody(project=str(p), segment_id="seg-video-1", name="not-a-mask")
            )
        assert ei.value.status_code == 422

        with pytest.raises(HTTPException) as ei:
            local_mask(MaskBody(project=str(p), segment_id="nope", name="圆形"))
        assert ei.value.status_code == 404

        body = local_mask(
            MaskBody(
                project=str(p),
                segment_id="seg-video-1",
                name="圆形",
                width=256,
                height=256,
                feather=5,
            )
        )
        assert body["ok"] is True
        assert body["mask"]["resource_type"] == "circle"

        tbody = local_transform(
            TransformBody(project=str(p), segment_id="seg-video-1", scale_x=1.5)
        )
        assert tbody["ok"] is True
        assert tbody["clip"]["scale"]["x"] == 1.5
