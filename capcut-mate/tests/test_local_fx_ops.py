"""WAVE2 Grok B — fx_ops pure Python tests (no capcut-cli)."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from engines.local import fx_ops
from engines.local.draft_io import load_raw_draft, save_raw_draft

_REAL = (
    Path(__file__).resolve().parents[1]
    / "output"
    / "draft"
    / "2026071901005889bc937a"
)


def _minimal_draft() -> dict:
    """Self-contained draft: video + text segments."""
    vid_mat = "vmat001"
    txt_mat = "tmat001"
    vseg = "vseg001"
    tseg = "tseg001"
    return {
        "id": "fx-test",
        "duration": 5_000_000,
        "canvas_config": {"width": 1080, "height": 1920},
        "materials": {
            "videos": [
                {
                    "id": vid_mat,
                    "type": "video",
                    "path": "",
                    "width": 1080,
                    "height": 1920,
                    "duration": 5_000_000,
                }
            ],
            "texts": [
                {
                    "id": txt_mat,
                    "type": "text",
                    "content": json.dumps(
                        {
                            "text": "Hello FX",
                            "styles": [
                                {
                                    "range": [0, 16],
                                    "size": 15,
                                    "fill": {
                                        "content": {
                                            "solid": {"color": [1, 1, 1], "alpha": 1}
                                        }
                                    },
                                }
                            ],
                        },
                        ensure_ascii=False,
                    ),
                }
            ],
            "canvases": [],
            "chromas": [],
            "mix_modes": [],
            "material_animations": [],
            "filters": [],
            "video_effects": [],
            "audio_effects": [],
            "stickers": [],
            "transitions": [],
        },
        "tracks": [
            {
                "id": "trk_v",
                "type": "video",
                "name": "main",
                "segments": [
                    {
                        "id": vseg,
                        "material_id": vid_mat,
                        "target_timerange": {"start": 0, "duration": 5_000_000},
                        "source_timerange": {"start": 0, "duration": 5_000_000},
                        "extra_material_refs": [],
                        "common_keyframes": [],
                        "clip": {
                            "alpha": 1.0,
                            "scale": {"x": 1, "y": 1},
                            "transform": {"x": 0, "y": 0},
                            "rotation": 0,
                        },
                    }
                ],
            },
            {
                "id": "trk_t",
                "type": "text",
                "name": "text",
                "segments": [
                    {
                        "id": tseg,
                        "material_id": txt_mat,
                        "target_timerange": {"start": 0, "duration": 3_000_000},
                        "extra_material_refs": [],
                        "common_keyframes": [],
                    }
                ],
            },
        ],
    }


@pytest.fixture
def draft_path(tmp_path: Path) -> Path:
    d = tmp_path / "proj"
    d.mkdir()
    p = d / "draft_content.json"
    p.write_text(json.dumps(_minimal_draft(), ensure_ascii=False), encoding="utf-8")
    return d


@pytest.fixture
def real_copy(tmp_path: Path) -> Path:
    if not _REAL.is_dir():
        pytest.skip("real draft missing")
    dest = tmp_path / "real"
    shutil.copytree(_REAL, dest)
    return dest


def test_bg_blur_and_off(draft_path: Path):
    draft, path = load_raw_draft(str(draft_path))
    r = fx_ops.set_bg_blur(draft, "vseg001", 2)
    assert r["blur"] == 0.375
    assert r["canvas_id"]
    assert r["canvas_id"] in draft["tracks"][0]["segments"][0]["extra_material_refs"]
    canvases = draft["materials"]["canvases"]
    assert any(c.get("type") == "canvas_blur" for c in canvases)

    r2 = fx_ops.set_bg_blur(draft, "vseg001", "off")
    assert r2["off"] is True
    assert not draft["tracks"][0]["segments"][0]["extra_material_refs"]
    save_raw_draft(path, draft)
    assert path.with_suffix(path.suffix + ".bak").is_file() or path.is_file()


def test_chroma(draft_path: Path):
    draft, _ = load_raw_draft(str(draft_path))
    r = fx_ops.set_chroma(draft, "vseg001", color="#00FF00", intensity=0.6)
    assert r["material_id"]
    assert draft["materials"]["chromas"][0]["intensity"] == 0.6
    with pytest.raises(ValueError, match="video"):
        fx_ops.set_chroma(draft, "tseg001", color="#FF0000")


def test_mix_mode(draft_path: Path):
    draft, _ = load_raw_draft(str(draft_path))
    r = fx_ops.set_mix_mode(draft, "vseg001", "multiply")
    assert r["mix_mode"] == "正片叠底"
    assert r["resource_id"]
    r2 = fx_ops.set_mix_mode(draft, "vseg001", "normal")
    assert r2.get("cleared")


def test_text_and_image_anim(draft_path: Path):
    draft, _ = load_raw_draft(str(draft_path))
    tr = fx_ops.add_text_anim(
        draft, "tseg001", intro="fade-in", outro="fade-out"
    )
    assert len(tr["added"]) == 2
    assert all(a["resource_id"] for a in tr["added"])
    container = next(
        m
        for m in draft["materials"]["material_animations"]
        if m["id"] == tr["material_id"]
    )
    types = {a["type"] for a in container["animations"]}
    assert types == {"in", "out"}

    ir = fx_ops.add_image_anim(draft, "vseg001", intro="渐显", outro="渐隐")
    assert len(ir["added"]) == 2
    assert ir["added"][0]["resource_id"]


def test_text_style_and_bubble(draft_path: Path):
    draft, _ = load_raw_draft(str(draft_path))
    r = fx_ops.set_text_style(
        draft, "tseg001", alpha=0.9, shadow=True, shadow_color="#000000"
    )
    assert "alpha" in r["applied"] and "shadow" in r["applied"]
    text = draft["materials"]["texts"][0]
    assert text["text_alpha"] == 0.9
    assert text["has_shadow"] is True

    b = fx_ops.set_bubble_text(draft, "tseg001", slug="cloud")
    assert b["resource_id"]
    assert any(f.get("type") == "text_shape" for f in draft["materials"]["filters"])


def test_add_sfx_filter_effect_sticker(draft_path: Path):
    draft, path = load_raw_draft(str(draft_path))
    s = fx_ops.add_sfx(draft, name="回声", start_us=0, duration_us=500_000)
    assert s["resource_id"]
    assert any(t.get("type") == "audio" for t in draft["tracks"])

    f = fx_ops.add_filter(draft, name="复古工业", intensity=0.8)
    assert f["resource_id"] and f["intensity"] == 0.8

    e = fx_ops.add_effect(draft, name="抖动")
    assert e["type"] == "video_effect" and e["resource_id"]

    st = fx_ops.add_sticker(
        draft, resource_id="sticker_res_demo", start_us=0, duration_us=2_000_000, scale=0.5
    )
    assert st["segment_id"]
    save_raw_draft(path, draft)

    reloaded, _ = load_raw_draft(str(draft_path))
    assert reloaded["materials"]["audio_effects"]
    assert reloaded["materials"]["stickers"]


def test_enums_summary_and_category():
    s = fx_ops.list_enums(None)
    assert "filters" in s["counts"]
    assert s["counts"]["filters"] > 100
    f = fx_ops.list_enums("filters", limit=5)
    assert len(f["items"]) == 5
    assert f["items"][0]["resource_id"]
    b = fx_ops.list_enums("bubbles")
    assert any(i["slug"] == "cloud" for i in b["items"])
    with pytest.raises(ValueError):
        fx_ops.list_enums("not-a-category")


def test_missing_segment(draft_path: Path):
    draft, _ = load_raw_draft(str(draft_path))
    with pytest.raises(KeyError):
        fx_ops.set_bg_blur(draft, "nope", 1)


def test_on_real_draft_sticker_segment(real_copy: Path):
    draft, path = load_raw_draft(str(real_copy))
    segs = []
    for t in draft.get("tracks") or []:
        for s in t.get("segments") or []:
            segs.append(s["id"])
    if not segs:
        pytest.skip("no segments")
    sid = segs[0]
    r = fx_ops.add_image_anim(draft, sid, intro="渐显")
    assert r["added"][0]["resource_id"]
    fx_ops.set_bg_blur(draft, sid, 1)
    save_raw_draft(path, draft)
    reloaded, _ = load_raw_draft(str(real_copy))
    assert reloaded["materials"].get("material_animations") or reloaded["materials"].get(
        "canvases"
    )
