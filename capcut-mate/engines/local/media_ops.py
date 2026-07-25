"""
Media ops on raw CapCut draft — pure Python (WAVE2 Grok A).

Ports CLI: crop, duplicate, replace-media, relink, prune, add-cover,
audio-fade, add-video, add-audio, material, segment.
No capcut-cli / Node.
"""

from __future__ import annotations

import copy
import shutil
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .inspect import find_segment

# Material buckets that hold media with a `path` field
_PATH_MATERIAL_TYPES = (
    "videos",
    "audios",
    "images",
    "stickers",
    "speeds",  # no path usually
)

_CROP_RATIOS: Dict[str, float] = {
    "1:1": 1.0,
    "16:9": 16 / 9,
    "9:16": 9 / 16,
    "4:3": 4 / 3,
    "3:4": 3 / 4,
}

_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".gif"}
_CROP_EPS = 1e-9


def _uid() -> str:
    return uuid.uuid4().hex


def _materials(draft: Dict[str, Any]) -> Dict[str, Any]:
    mats = draft.setdefault("materials", {})
    if not isinstance(mats, dict):
        raise ValueError("draft.materials phải là object")
    return mats


def _ensure_list(mats: Dict[str, Any], key: str) -> List[Any]:
    arr = mats.get(key)
    if not isinstance(arr, list):
        mats[key] = []
        arr = mats[key]
    return arr


def find_segment_hit(
    draft: Dict[str, Any], segment_id: str
) -> Tuple[Dict[str, Any], Dict[str, Any], int]:
    """Return (track, segment, segment_index)."""
    for t in draft.get("tracks") or []:
        if not isinstance(t, dict):
            continue
        segs = t.get("segments") or []
        if not isinstance(segs, list):
            continue
        for i, s in enumerate(segs):
            if isinstance(s, dict) and s.get("id") == segment_id:
                return t, s, i
    raise KeyError(f"segment_id không tồn tại: {segment_id}")


def find_material_global(
    draft: Dict[str, Any], material_id: str
) -> Optional[Tuple[str, Dict[str, Any]]]:
    mats = draft.get("materials") or {}
    if not isinstance(mats, dict):
        return None
    for mtype, arr in mats.items():
        if not isinstance(arr, list):
            continue
        for m in arr:
            if isinstance(m, dict) and m.get("id") == material_id:
                return str(mtype), m
    return None


def get_material(draft: Dict[str, Any], material_id: str) -> Dict[str, Any]:
    hit = find_material_global(draft, material_id)
    if not hit:
        raise KeyError(f"material_id không tồn tại: {material_id}")
    mtype, mat = hit
    return {"material_type": mtype, "material": mat}


def get_segment_full(draft: Dict[str, Any], segment_id: str) -> Dict[str, Any]:
    track, seg, _ = find_segment_hit(draft, segment_id)
    mid = seg.get("material_id")
    mat_info = None
    if mid:
        hit = find_material_global(draft, str(mid))
        if hit:
            mat_info = {"material_type": hit[0], "material": hit[1]}
    return {
        "segment": seg,
        "track": {
            "id": track.get("id"),
            "type": track.get("type"),
            "name": track.get("name"),
        },
        "material": mat_info,
    }


# --- crop ---


def crop_presets() -> List[str]:
    return ["free", *list(_CROP_RATIOS.keys())]


def crop_rect_for_ratio(width: float, height: float, preset: str) -> Dict[str, float]:
    if preset == "free":
        return {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}
    ratio = _CROP_RATIOS.get(preset)
    if ratio is None:
        raise ValueError(f"Unknown ratio: {preset}. Valid: {', '.join(crop_presets())}")
    if not (width > 0 and height > 0):
        raise ValueError(
            "Material không có width/height — dùng rect x,y,w,h thay vì ratio"
        )
    source = width / height
    w = 1.0 if ratio >= source else ratio / source
    h = source / ratio if ratio >= source else 1.0
    return {"x": (1 - w) / 2, "y": (1 - h) / 2, "w": w, "h": h}


def _rect_to_crop_corners(x: float, y: float, w: float, h: float) -> Dict[str, float]:
    right = min(1.0, x + w)
    bottom = min(1.0, y + h)
    return {
        "lower_left_x": x,
        "lower_left_y": bottom,
        "lower_right_x": right,
        "lower_right_y": bottom,
        "upper_left_x": x,
        "upper_left_y": y,
        "upper_right_x": right,
        "upper_right_y": y,
    }


def set_crop(
    draft: Dict[str, Any],
    segment_id: str,
    *,
    ratio: Optional[str] = None,
    rect: Optional[Dict[str, float]] = None,
    reset: bool = False,
) -> Dict[str, Any]:
    track, seg, _ = find_segment_hit(draft, segment_id)
    mid = seg.get("material_id")
    if not mid:
        raise ValueError(f"Segment {segment_id} không có material_id")
    hit = find_material_global(draft, str(mid))
    if not hit or hit[0] != "videos":
        raise ValueError("crop chỉ áp dụng video/photo material (materials.videos)")
    mat = hit[1]
    mtype = mat.get("type") or "video"
    if mtype not in ("video", "photo"):
        raise ValueError(f"crop chỉ video/photo (got type={mtype})")

    if reset or (ratio == "free"):
        r = {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}
    elif rect is not None:
        r = {
            "x": float(rect["x"]),
            "y": float(rect["y"]),
            "w": float(rect["w"]),
            "h": float(rect["h"]),
        }
    elif ratio:
        w = float(mat.get("width") or 0)
        h = float(mat.get("height") or 0)
        r = crop_rect_for_ratio(w, h, ratio)
    else:
        raise ValueError("Cần ratio, rect {x,y,w,h}, hoặc reset=true")

    x, y, w, h = r["x"], r["y"], r["w"], r["h"]
    for name, value in r.items():
        if not isinstance(value, (int, float)) or value != value:  # NaN
            raise ValueError(f"Crop rect {name} không hợp lệ: {value}")
    if x < 0 or y < 0:
        raise ValueError(f"Crop x/y >= 0 (got x={x}, y={y})")
    if w <= 0 or h <= 0:
        raise ValueError(f"Crop w/h > 0 (got w={w}, h={h})")
    if x + w > 1 + _CROP_EPS or y + h > 1 + _CROP_EPS:
        raise ValueError(f"Crop phải trong frame: x+w<=1, y+h<=1 (got {x+w}, {y+h})")

    crop = _rect_to_crop_corners(x, y, w, h)
    mat["crop"] = crop
    if "crop_ratio" in mat or True:
        mat["crop_ratio"] = "free"
    return {
        "segment_id": seg.get("id"),
        "material_id": mat.get("id"),
        "rect": r,
        "crop": crop,
        "track_type": track.get("type"),
    }


# --- companions / base segment for add-video/audio ---


def _create_companions(kind: str) -> Tuple[List[str], List[Tuple[str, Dict[str, Any]]]]:
    speed = {
        "id": _uid(),
        "type": "speed",
        "speed": 1,
        "mode": 0,
        "curve_speed": None,
    }
    placeholder = {
        "id": _uid(),
        "type": "placeholder_info",
        "error_path": "",
        "error_text": "",
        "meta_type": "none",
        "res_path": "",
        "res_text": "",
    }
    scm = {
        "id": _uid(),
        "type": "none",
        "audio_channel_mapping": 0,
        "is_config_open": False,
    }
    vocal = {
        "id": _uid(),
        "type": "vocal_separation",
        "choice": 0,
        "enter_from": "",
        "final_algorithm": "",
        "production_path": "",
        "removed_sounds": [],
        "time_range": None,
    }
    materials: List[Tuple[str, Dict[str, Any]]] = [
        ("speeds", speed),
        ("placeholder_infos", placeholder),
        ("sound_channel_mappings", scm),
        ("vocal_separations", vocal),
    ]
    ids = [speed["id"], placeholder["id"], scm["id"], vocal["id"]]
    if kind in ("video", "sticker"):
        canvas = {
            "id": _uid(),
            "type": "canvas_color",
            "album_image": "",
            "blur": 0.0,
            "color": "",
            "image": "",
            "image_id": "",
            "image_name": "",
            "source_platform": 0,
            "team_id": "",
        }
        color = {
            "id": _uid(),
            "type": "material_color",
            "brightness": 0.0,
            "contrast": 0.0,
            "fade": 0.0,
            "light_sense": 0.0,
            "saturation": 0.0,
            "temperature": 0.0,
            "tint": 0.0,
        }
        materials.append(("canvases", canvas))
        materials.append(("material_colors", color))
        ids.extend([canvas["id"], color["id"]])
    return ids, materials


def _register_companions(draft: Dict[str, Any], companions: List[Tuple[str, Dict[str, Any]]]) -> None:
    mats = _materials(draft)
    for mtype, data in companions:
        _ensure_list(mats, mtype).append(data)


def _copy_asset(src: Path, assets_dir: Path) -> Path:
    assets_dir.mkdir(parents=True, exist_ok=True)
    dest = assets_dir / src.name
    if not dest.exists():
        shutil.copy2(src, dest)
        return dest
    # collision: keep unique name
    stem, suf = src.stem, src.suffix
    dest = assets_dir / f"{stem}.{_uid()[:8]}{suf}"
    shutil.copy2(src, dest)
    return dest


def _base_segment(
    seg_id: str,
    material_id: str,
    track_id: str,
    start_us: int,
    duration_us: int,
    companion_ids: List[str],
    render_index: int,
) -> Dict[str, Any]:
    return {
        "id": seg_id,
        "material_id": material_id,
        "raw_segment_id": track_id,
        "target_timerange": {"start": int(start_us), "duration": int(duration_us)},
        "source_timerange": {"start": 0, "duration": int(duration_us)},
        "speed": 1.0,
        "volume": 1.0,
        "visible": True,
        "reverse": False,
        "clip": {
            "alpha": 1.0,
            "rotation": 0.0,
            "scale": {"x": 1.0, "y": 1.0},
            "transform": {"x": 0.0, "y": 0.0},
            "flip": {"horizontal": False, "vertical": False},
        },
        "render_index": render_index,
        "track_render_index": 0,
        "track_attribute": 0,
        "extra_material_refs": list(companion_ids),
        "common_keyframes": [],
        "keyframe_refs": [],
        "uniform_scale": {"on": True, "value": 1.0},
    }


def _find_or_create_track(
    draft: Dict[str, Any],
    track_type: str,
    track_name: str,
) -> Dict[str, Any]:
    tracks = draft.setdefault("tracks", [])
    if not isinstance(tracks, list):
        raise ValueError("draft.tracks phải là list")
    for t in tracks:
        if isinstance(t, dict) and t.get("type") == track_type and t.get("name") == track_name:
            t.setdefault("segments", [])
            return t
    track = {
        "id": _uid(),
        "type": track_type,
        "name": track_name,
        "attribute": 0,
        "flag": 0,
        "segments": [],
        "is_default_name": False,
    }
    tracks.append(track)
    return track


def add_video(
    draft: Dict[str, Any],
    draft_json_path: Path,
    file: str,
    *,
    start_us: int = 0,
    duration_us: Optional[int] = None,
    track_name: str = "video",
    width: int = 1920,
    height: int = 1080,
    media_type: Optional[str] = None,
) -> Dict[str, Any]:
    src = Path(file).expanduser().resolve()
    if not src.is_file():
        raise FileNotFoundError(f"Không tìm thấy file video/image: {src}")

    dur = int(duration_us if duration_us is not None else 3_000_000)
    if dur <= 0:
        raise ValueError("duration_us must be > 0")
    start_us = int(start_us)
    if start_us < 0:
        raise ValueError("start_us must be >= 0")

    ext = src.suffix.lower()
    mtype = media_type or ("photo" if ext in _IMAGE_EXT else "video")

    draft_dir = draft_json_path.parent
    dest = _copy_asset(src, draft_dir / "assets" / "video")

    mats = _materials(draft)
    videos = _ensure_list(mats, "videos")
    mat_id = _uid()
    video_mat = {
        "id": mat_id,
        "path": str(dest),
        "material_name": dest.name,
        "type": mtype,
        "duration": dur,
        "width": int(width),
        "height": int(height),
        "category_id": "",
        "category_name": "local",
        "check_flag": 7,
        "crop": _rect_to_crop_corners(0, 0, 1, 1),
        "crop_ratio": "free",
        "has_audio": mtype == "video",
        "extra_type_option": 0,
        "source_platform": 0,
        "media_path": "",
        "material_url": "",
    }
    videos.append(video_mat)

    companion_ids, companion_mats = _create_companions("video")
    _register_companions(draft, companion_mats)

    track = _find_or_create_track(draft, "video", track_name)
    seg_id = _uid()
    seg = _base_segment(seg_id, mat_id, str(track.get("id")), start_us, dur, companion_ids, 14000)
    track.setdefault("segments", []).append(seg)

    end = start_us + dur
    draft["duration"] = max(int(draft.get("duration") or 0), end)

    return {
        "segment_id": seg_id,
        "material_id": mat_id,
        "track_id": track.get("id"),
        "media_path": str(dest),
        "path": str(dest),
        "type": mtype,
    }


def add_audio(
    draft: Dict[str, Any],
    draft_json_path: Path,
    file: str,
    *,
    start_us: int = 0,
    duration_us: Optional[int] = None,
    track_name: str = "audio",
    volume: float = 1.0,
) -> Dict[str, Any]:
    src = Path(file).expanduser().resolve()
    if not src.is_file():
        raise FileNotFoundError(f"Không tìm thấy file audio: {src}")

    dur = int(duration_us if duration_us is not None else 3_000_000)
    if dur <= 0:
        raise ValueError("duration_us must be > 0")
    start_us = int(start_us)
    if start_us < 0:
        raise ValueError("start_us must be >= 0")
    if volume < 0:
        raise ValueError("volume must be >= 0")

    draft_dir = draft_json_path.parent
    dest = _copy_asset(src, draft_dir / "assets" / "audio")

    mats = _materials(draft)
    audios = _ensure_list(mats, "audios")
    mat_id = _uid()
    audio_mat = {
        "id": mat_id,
        "path": str(dest),
        "name": dest.name,
        "duration": dur,
        "type": "extract_music",
        "category_id": "",
        "category_name": "local",
        "check_flag": 1,
        "wave_points": [],
        "source_platform": 0,
    }
    audios.append(audio_mat)

    companion_ids, companion_mats = _create_companions("audio")
    _register_companions(draft, companion_mats)

    track = _find_or_create_track(draft, "audio", track_name)
    seg_id = _uid()
    seg = _base_segment(seg_id, mat_id, str(track.get("id")), start_us, dur, companion_ids, 11000)
    seg["volume"] = float(volume)
    track.setdefault("segments", []).append(seg)

    end = start_us + dur
    draft["duration"] = max(int(draft.get("duration") or 0), end)

    return {
        "segment_id": seg_id,
        "material_id": mat_id,
        "track_id": track.get("id"),
        "media_path": str(dest),
        "path": str(dest),
    }


# --- duplicate ---


def duplicate_segment(
    draft: Dict[str, Any],
    segment_id: str,
    *,
    new_track: bool = True,
    track_name: Optional[str] = None,
) -> Dict[str, Any]:
    source_track, source_seg, _ = find_segment_hit(draft, segment_id)
    tr = source_seg.get("target_timerange") or {}
    start = int(tr.get("start") or 0)
    duration = int(tr.get("duration") or 0)

    mid = source_seg.get("material_id")
    if not mid:
        raise ValueError(f"Segment {segment_id} không có material_id")
    primary = find_material_global(draft, str(mid))
    if not primary:
        raise KeyError(f"Material không tìm thấy cho segment: {segment_id}")
    primary_type, primary_mat = primary

    tracks = draft.setdefault("tracks", [])
    if not isinstance(tracks, list):
        raise ValueError("draft.tracks phải là list")

    created_track = False
    if track_name is not None and not new_track:
        target = next(
            (t for t in tracks if isinstance(t, dict) and t.get("name") == track_name),
            None,
        )
        if not target:
            raise KeyError(f"Track không tồn tại: {track_name}")
        if target.get("type") != source_track.get("type"):
            raise ValueError(
                f'Track "{track_name}" type={target.get("type")}; '
                f"cần type={source_track.get('type')}"
            )
        end = start + duration
        for s in target.get("segments") or []:
            if not isinstance(s, dict):
                continue
            st = s.get("target_timerange") or {}
            ss = int(st.get("start") or 0)
            sd = int(st.get("duration") or 0)
            if ss < end and ss + sd > start:
                raise ValueError(
                    f'Track "{track_name}" bị chiếm trong khoảng {start}-{end}us '
                    f"(segment {s.get('id')})"
                )
        track = target
    else:
        names = {t.get("name") for t in tracks if isinstance(t, dict)}
        base = f"{source_track.get('name') or source_track.get('type')}-copy"
        name = base
        n = 2
        while name in names:
            name = f"{base}-{n}"
            n += 1
        track = {
            "id": _uid(),
            "type": source_track.get("type"),
            "name": name,
            "attribute": 0,
            "flag": 0,
            "segments": [],
            "is_default_name": False,
        }
        idx = tracks.index(source_track) if source_track in tracks else len(tracks) - 1
        tracks.insert(idx + 1, track)
        created_track = True

    mats = _materials(draft)
    new_seg = copy.deepcopy(source_seg)
    new_seg["id"] = _uid()
    new_seg["raw_segment_id"] = track.get("id")

    primary_clone = copy.deepcopy(primary_mat)
    primary_clone["id"] = _uid()
    _ensure_list(mats, primary_type).append(primary_clone)
    new_seg["material_id"] = primary_clone["id"]
    cloned = [
        {
            "type": primary_type,
            "id": primary_clone["id"],
            "source_id": mid,
        }
    ]

    new_refs: List[str] = []
    for ref_id in source_seg.get("extra_material_refs") or []:
        extra = find_material_global(draft, str(ref_id))
        if not extra:
            continue
        etype, emat = extra
        clone = copy.deepcopy(emat)
        clone["id"] = _uid()
        _ensure_list(mats, etype).append(clone)
        new_refs.append(clone["id"])
        cloned.append({"type": etype, "id": clone["id"], "source_id": ref_id})
    new_seg["extra_material_refs"] = new_refs

    # re-mint keyframe ids
    if isinstance(new_seg.get("common_keyframes"), list):
        for lst in new_seg["common_keyframes"]:
            if isinstance(lst, dict):
                if isinstance(lst.get("id"), str):
                    lst["id"] = _uid()
                for kf in lst.get("keyframe_list") or []:
                    if isinstance(kf, dict) and isinstance(kf.get("id"), str):
                        kf["id"] = _uid()

    track.setdefault("segments", []).append(new_seg)

    return {
        "segment_id": new_seg["id"],
        "source_segment_id": segment_id,
        "material_id": new_seg["material_id"],
        "track_id": track.get("id"),
        "track_name": track.get("name"),
        "created_track": created_track,
        "cloned_materials": cloned,
    }


# --- replace-media ---


def replace_media(
    draft: Dict[str, Any],
    draft_json_path: Path,
    segment_id: str,
    new_file: str,
    *,
    retime: bool = False,
    dry_run: bool = False,
) -> Dict[str, Any]:
    src = Path(new_file).expanduser().resolve()
    if not src.is_file():
        raise FileNotFoundError(f"File thay thế không tồn tại: {src}")

    _, seg, _ = find_segment_hit(draft, segment_id)
    mid = seg.get("material_id")
    if not mid:
        raise ValueError(f"Segment {segment_id} không có material_id")
    found = find_material_global(draft, str(mid))
    if not found:
        raise KeyError(f"Material {mid} không tồn tại")
    mtype, mat = found

    old_path = str(mat.get("path") or "")
    old_duration = mat.get("duration") if isinstance(mat.get("duration"), (int, float)) else None

    kind = "audio" if mtype == "audios" else "video"
    draft_dir = draft_json_path.parent
    dest = draft_dir / "assets" / kind / src.name
    if not dry_run:
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.resolve() != src and not dest.exists():
            shutil.copy2(src, dest)
        elif dest.resolve() != src and dest.exists():
            dest = _copy_asset(src, dest.parent)

    new_path = str(dest if not dry_run else src)
    if not dry_run:
        mat["path"] = new_path
        if "material_name" in mat:
            mat["material_name"] = Path(new_path).name
        if "name" in mat:
            mat["name"] = Path(new_path).name

    source = seg.get("source_timerange") if isinstance(seg.get("source_timerange"), dict) else None
    source_used = 0
    if source:
        source_used = int(source.get("start") or 0) + int(source.get("duration") or 0)

    retimed = False
    warning = None
    # Without ffprobe we keep duration unless retime with explicit new duration unavailable
    if retime and source is not None and isinstance(mat.get("duration"), (int, float)):
        # keep material duration; reset source to full material duration if present
        md = int(mat["duration"])
        source["start"] = 0
        source["duration"] = md
        retimed = True
    elif isinstance(mat.get("duration"), (int, float)) and int(mat["duration"]) < source_used:
        warning = (
            f"Material duration {mat['duration']}us < source used {source_used}us — "
            "có thể freeze; thử retime=true"
        )

    shared = 0
    for t in draft.get("tracks") or []:
        if not isinstance(t, dict):
            continue
        for s in t.get("segments") or []:
            if isinstance(s, dict) and s.get("material_id") == mid and s.get("id") != segment_id:
                shared += 1

    return {
        "ok": True,
        "segment_id": segment_id,
        "material_id": mid,
        "material_type": mtype,
        "old_path": old_path,
        "new_path": new_path if not dry_run else str(src),
        "shared_with_segments": shared,
        "old_duration_us": old_duration,
        "retimed": retimed,
        "warning": warning,
        "dry_run": dry_run,
    }


# --- relink ---


def relink_materials(
    draft: Dict[str, Any],
    *,
    directory: Optional[str] = None,
    from_prefix: Optional[str] = None,
    to_prefix: Optional[str] = None,
) -> Dict[str, Any]:
    if not directory and not (from_prefix is not None and to_prefix is not None):
        raise ValueError("Cần dir hoặc (from + to) prefix")

    dir_index: Dict[str, str] = {}
    if directory:
        d = Path(directory).expanduser().resolve()
        if not d.is_dir():
            raise FileNotFoundError(f"--dir không tồn tại: {d}")
        for f in d.iterdir():
            if f.is_file():
                dir_index[f.name] = str(f)

    changes: List[Dict[str, str]] = []
    missing = 0
    present = 0
    mats = draft.get("materials") or {}
    if not isinstance(mats, dict):
        raise ValueError("draft.materials phải là object")

    for arr in mats.values():
        if not isinstance(arr, list):
            continue
        for m in arr:
            if not isinstance(m, dict):
                continue
            path = m.get("path")
            if not isinstance(path, str) or not path:
                continue
            p = path
            changed = False
            if from_prefix is not None and to_prefix is not None and p.startswith(from_prefix):
                p = to_prefix + p[len(from_prefix) :]
                changed = True
            if not Path(p).exists() and directory:
                hit = dir_index.get(Path(p).name)
                if hit:
                    p = hit
                    changed = True
            if changed and p != path:
                changes.append({"id": str(m.get("id") or ""), "from": path, "to": p})
                m["path"] = p
            if Path(p).exists():
                present += 1
            else:
                missing += 1

    return {
        "ok": True,
        "relinked": len(changes),
        "still_missing": missing,
        "present": present,
        "changes": changes,
    }


# --- prune ---


def prune_materials(draft: Dict[str, Any]) -> Dict[str, Any]:
    referenced: set[str] = set()
    for t in draft.get("tracks") or []:
        if not isinstance(t, dict):
            continue
        for s in t.get("segments") or []:
            if not isinstance(s, dict):
                continue
            if s.get("material_id"):
                referenced.add(str(s["material_id"]))
            for ref in s.get("extra_material_refs") or []:
                referenced.add(str(ref))

    mats = draft.get("materials") or {}
    if not isinstance(mats, dict):
        raise ValueError("draft.materials phải là object")

    by_type: Dict[str, Dict[str, int]] = {}
    removed_total = 0
    for mtype, arr in list(mats.items()):
        if not isinstance(arr, list):
            continue
        before = len(arr)
        kept = [
            m
            for m in arr
            if not isinstance(m, dict)
            or not isinstance(m.get("id"), str)
            or m["id"] in referenced
        ]
        removed = before - len(kept)
        if removed > 0:
            mats[mtype] = kept
        by_type[mtype] = {"removed": removed, "kept": len(kept)}
        removed_total += removed

    return {"ok": True, "removed": removed_total, "by_type": by_type}


# --- cover ---


def add_cover(
    draft: Dict[str, Any],
    image: str,
    *,
    time_ms: int = 0,
) -> Dict[str, Any]:
    path = Path(image).expanduser().resolve()
    if not path.is_file():
        raise FileNotFoundError(f"Cover image không tồn tại: {path}")
    cover = {
        "path": str(path),
        "type": "image",
        "time": int(time_ms),
        "time_ms": int(time_ms),
        "custom_cover_id": _uid(),
    }
    draft["cover"] = cover
    return {"cover_path": str(path), "time_ms": int(time_ms)}


# --- audio-fade ---


def set_audio_fade(
    draft: Dict[str, Any],
    segment_id: str,
    *,
    fade_in_s: float = 0.0,
    fade_out_s: float = 0.0,
) -> Dict[str, Any]:
    fade_in_us = int(float(fade_in_s) * 1_000_000)
    fade_out_us = int(float(fade_out_s) * 1_000_000)
    if fade_in_us <= 0 and fade_out_us <= 0:
        raise ValueError("audio-fade cần fade_in_s hoặc fade_out_s > 0")

    track, seg, _ = find_segment_hit(draft, segment_id)
    if track.get("type") != "audio":
        raise ValueError(
            f"audio-fade chỉ cho segment audio (track type: {track.get('type')})"
        )

    mats = _materials(draft)
    fades = _ensure_list(mats, "audio_fades")
    fade_ids = {f.get("id") for f in fades if isinstance(f, dict)}

    refs = list(seg.get("extra_material_refs") or [])
    seg["extra_material_refs"] = [r for r in refs if r not in fade_ids]

    fade_id = _uid()
    fades.append(
        {
            "id": fade_id,
            "fade_in_duration": fade_in_us,
            "fade_out_duration": fade_out_us,
            "fade_type": 0,
            "type": "audio_fade",
        }
    )
    seg.setdefault("extra_material_refs", []).append(fade_id)

    return {
        "segment_id": segment_id,
        "fade_id": fade_id,
        "fade_in_us": fade_in_us,
        "fade_out_us": fade_out_us,
    }
