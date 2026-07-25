"""WAVE2 Grok C — structure_ops pure Python tests."""

from __future__ import annotations

import json
import shutil
import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from engines.local import structure_ops as ops  # noqa: E402
from engines.local.draft_io import load_raw_draft  # noqa: E402

TEMPLATE = ROOT / "template" / "default2"
REAL_DRAFT = ROOT / "output" / "draft" / "2026071901005889bc937a"


def _draft_with_segments() -> dict:
    return {
        "id": "d1",
        "name": "t",
        "duration": 5_000_000,
        "fps": 30,
        "platform": {"app_source": "cc", "app_version": "8.7.0", "os": "windows"},
        "canvas_config": {"width": 1920, "height": 1080},
        "materials": {
            "videos": [
                {"id": "mv1", "type": "video", "path": "/a.mp4", "duration": 5_000_000},
                {"id": "mv2", "type": "video", "path": "/b.mp4", "duration": 3_000_000},
            ],
            "speeds": [{"id": "sp1", "type": "speed", "speed": 1}],
            "masks": [],
        },
        "tracks": [
            {
                "id": "tv",
                "type": "video",
                "name": "video",
                "segments": [
                    {
                        "id": "s1",
                        "material_id": "mv1",
                        "target_timerange": {"start": 0, "duration": 3_000_000},
                        "source_timerange": {"start": 0, "duration": 3_000_000},
                        "speed": 1.0,
                        "volume": 1.0,
                        "extra_material_refs": ["sp1"],
                    },
                    {
                        "id": "s2",
                        "material_id": "mv2",
                        "target_timerange": {"start": 3_000_000, "duration": 2_000_000},
                        "source_timerange": {"start": 0, "duration": 2_000_000},
                        "speed": 1.0,
                        "volume": 1.0,
                        "extra_material_refs": [],
                    },
                ],
            }
        ],
    }


def _write_project(tmp: Path, name: str, draft: dict) -> Path:
    folder = tmp / name
    folder.mkdir(parents=True)
    p = folder / "draft_content.json"
    p.write_text(json.dumps(draft), encoding="utf-8")
    return folder


# ---------------------------------------------------------------------------
# cut / concat / diff / shift-all / timeline / version
# ---------------------------------------------------------------------------


def test_cut_project_in_memory():
    d = _draft_with_segments()
    stats = ops.cut_project_in_memory(d, 1_000_000, 4_000_000)
    assert stats["kept"] == 2
    assert stats["duration_us"] == 3_000_000
    segs = d["tracks"][0]["segments"]
    assert segs[0]["target_timerange"]["start"] == 0
    # s1 was 0-3s, clipped 1-3 → duration 2s rebased to 0
    assert segs[0]["target_timerange"]["duration"] == 2_000_000


def test_cut_to_out_file(tmp_path: Path):
    proj = _write_project(tmp_path, "src", _draft_with_segments())
    out = tmp_path / "cut.json"
    result = ops.cut_to_out(str(proj), 0, 2_000_000, str(out))
    assert result["ok"] is True
    assert out.is_file()
    cut_draft = json.loads(out.read_text(encoding="utf-8"))
    assert cut_draft["duration"] == 2_000_000
    assert len(cut_draft["tracks"][0]["segments"]) == 1


def test_concat_and_diff(tmp_path: Path):
    a = _write_project(tmp_path, "a", _draft_with_segments())
    b_draft = _draft_with_segments()
    # change ids so no collision on material path only
    b_draft["tracks"][0]["segments"][0]["id"] = "bs1"
    b_draft["tracks"][0]["segments"][1]["id"] = "bs2"
    b_draft["materials"]["videos"][0]["id"] = "bmv1"
    b_draft["materials"]["videos"][1]["id"] = "bmv2"
    b_draft["tracks"][0]["segments"][0]["material_id"] = "bmv1"
    b_draft["tracks"][0]["segments"][1]["material_id"] = "bmv2"
    b = _write_project(tmp_path, "b", b_draft)

    out = tmp_path / "merged.json"
    r = ops.concat_drafts(str(a), str(b), out=str(out))
    assert r["ok"] is True
    assert r["duration_us"] == 10_000_000  # 5M + 5M
    merged = json.loads(out.read_text(encoding="utf-8"))
    assert len(merged["tracks"][0]["segments"]) == 4

    d = ops.diff_projects(str(a), str(out))
    assert d["changed"] is True
    assert len(d["segments"]["added"]) >= 1


def test_shift_all(tmp_path: Path):
    proj = _write_project(tmp_path, "sh", _draft_with_segments())
    r = ops.shift_all(str(proj), 500_000)
    assert r["shifted"] == 2
    draft, _ = load_raw_draft(str(proj))
    assert draft["tracks"][0]["segments"][0]["target_timerange"]["start"] == 500_000


def test_timeline_and_version(tmp_path: Path):
    proj = _write_project(tmp_path, "tl", _draft_with_segments())
    tl = ops.timeline_layout(str(proj), cols=40)
    assert tl["ok"] is True
    assert tl["span_us"] == 5_000_000
    assert len(tl["tracks"]) == 1
    assert len(tl["tracks"][0]["segments"]) == 2

    ver = ops.detect_version(str(proj))
    assert ver["app"] == "CapCut"
    assert ver["app_version"] == "8.7.0"


def test_list_projects(tmp_path: Path):
    _write_project(tmp_path, "p1", _draft_with_segments())
    _write_project(tmp_path, "p2", _draft_with_segments())
    r = ops.list_projects(str(tmp_path), names=True)
    assert r["count"] == 2
    folders = {p["folder"] for p in r["projects"]}
    assert folders == {"p1", "p2"}


# ---------------------------------------------------------------------------
# init / quickstart
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not TEMPLATE.is_dir(), reason="template/default2 missing")
def test_init_draft(tmp_path: Path):
    r = ops.init_draft("wave2-init-test", drafts_dir=str(tmp_path))
    assert r["ok"] is True
    assert Path(r["draft_path"]).is_dir()
    assert Path(r["file_path"]).is_file()
    draft, _ = load_raw_draft(r["draft_path"])
    assert draft["name"] == "wave2-init-test"
    assert draft["id"]

    with pytest.raises(ops.StructureError):
        ops.init_draft("wave2-init-test", drafts_dir=str(tmp_path))


@pytest.mark.skipif(not TEMPLATE.is_dir(), reason="template/default2 missing")
def test_quickstart_with_fake_video(tmp_path: Path):
    # tiny "media" file — duration falls back to 5s without ffprobe
    vid = tmp_path / "clip.bin"
    vid.write_bytes(b"\x00" * 64)
    r = ops.quickstart(
        "qs-test",
        video=str(vid),
        drafts_dir=str(tmp_path / "drafts"),
        duration_us=2_000_000,
    )
    assert r["ok"] is True
    assert r["added"]["video"] is True
    draft, _ = load_raw_draft(r["draft_path"])
    assert draft["duration"] == 2_000_000
    videos = draft["materials"]["videos"]
    assert len(videos) == 1
    segs = draft["tracks"][0]["segments"]
    assert len(segs) == 1
    assert segs[0]["target_timerange"]["duration"] == 2_000_000


# ---------------------------------------------------------------------------
# detect-scenes pure parsers + ffmpeg missing → FfmpegNotFoundError
# ---------------------------------------------------------------------------


def test_parse_scene_cuts_and_merge():
    stderr = """
Duration: 00:00:10.00, start: 0.000000
[Parsed_metadata_1 @ 0x1] frame:0  pts:1  pts_time:1.500
[Parsed_metadata_1 @ 0x1] lavfi.scene_score=0.450000
[Parsed_metadata_1 @ 0x1] frame:1  pts:2  pts_time:2.000
[Parsed_metadata_1 @ 0x1] lavfi.scene_score=0.800000
[Parsed_metadata_1 @ 0x1] frame:2  pts:3  pts_time:5.000
[Parsed_metadata_1 @ 0x1] lavfi.scene_score=0.500000
"""
    cuts = ops.parse_scene_cuts(stderr)
    assert len(cuts) == 3
    assert ops.parse_ffmpeg_duration(stderr) == pytest.approx(10.0)
    merged = ops.merge_close_cuts(cuts, min_gap=1.0)
    # 1.5 and 2.0 merge → keep score 0.8 at 2.0
    assert len(merged) == 2
    segs = ops.build_scene_segments(merged, 10.0)
    assert segs[0]["start"] == 0
    assert segs[-1]["end"] == 10.0


def test_detect_scenes_ffmpeg_missing():
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        f.write(b"not-really-video")
        path = f.name
    try:
        with pytest.raises(ops.FfmpegNotFoundError):
            ops.detect_scenes(path, ffmpeg_cmd="ffmpeg-definitely-not-installed-xyz")
    finally:
        Path(path).unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# real draft cut/timeline (if present)
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not REAL_DRAFT.is_dir(), reason="real draft missing")
def test_real_draft_timeline_and_cut(tmp_path: Path):
    work = tmp_path / "real"
    shutil.copytree(REAL_DRAFT, work)
    tl = ops.timeline_layout(str(work))
    assert tl["ok"] is True
    ver = ops.detect_version(str(work))
    assert ver["ok"] is True

    out = tmp_path / "real-cut.json"
    # cut first 1s even if empty segments — should still write
    r = ops.cut_to_out(str(work), 0, 1_000_000, str(out))
    assert r["ok"] is True
    assert out.is_file()


# ---------------------------------------------------------------------------
# router error mapping
# ---------------------------------------------------------------------------


def test_router_handlers(tmp_path: Path):
    from fastapi import HTTPException

    from src.router.local_structure_ops import (
        CutBody,
        DetectScenesBody,
        InitBody,
        ProjectsBody,
        local_cut,
        local_detect_scenes,
        local_init,
        local_projects,
    )

    proj = _write_project(tmp_path, "r", _draft_with_segments())
    out = tmp_path / "c.json"
    body = local_cut(
        CutBody(project=str(proj), start_us=0, end_us=1_000_000, out=str(out))
    )
    assert body["ok"] is True

    pr = local_projects(ProjectsBody(drafts_dir=str(tmp_path)))
    assert pr["count"] >= 1

    if TEMPLATE.is_dir():
        ini = local_init(InitBody(name="router-init", drafts_dir=str(tmp_path / "ini")))
        assert ini["ok"] is True

    # ffmpeg missing → 503
    vf = tmp_path / "v.mp4"
    vf.write_bytes(b"x")
    with pytest.raises(HTTPException) as ei:
        local_detect_scenes(
            DetectScenesBody(
                video=str(vf),
                ffmpeg_cmd="no-such-ffmpeg-binary-wave2",
            )
        )
    assert ei.value.status_code == 503
