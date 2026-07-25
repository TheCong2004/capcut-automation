"""
Load / save CapCut draft JSON on disk (pure Python — no capcut-cli).

Supports project folder or path to draft_content.json / draft_info.json.
"""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from typing import Any, Dict, Tuple

# Prefer content file (CapCut) then info (Jianying dual)
_CANDIDATE_NAMES = (
    "draft_content.json",
    "draft_info.json",
)


def resolve_draft_json_path(project: str) -> Path:
    """Resolve a project path or json file to the canonical draft JSON file."""
    expanded = os.path.expandvars(os.path.expanduser(str(project)))
    p = Path(expanded).resolve()
    if not p.exists():
        raise FileNotFoundError(f"Không tìm thấy path draft: {p}")

    if p.is_file():
        if p.suffix.lower() != ".json":
            raise ValueError(f"File không phải JSON draft: {p}")
        return p

    for name in _CANDIDATE_NAMES:
        cand = p / name
        if cand.is_file():
            return cand

    raise FileNotFoundError(
        f"Trong thư mục {p} không có draft_content.json / draft_info.json"
    )


def _get_fallback_template(path: Path) -> Dict[str, Any]:
    """Load default unencrypted template or construct a valid empty CapCut draft dict."""
    template_path = Path(__file__).resolve().parents[2] / "template" / "default2" / "draft_content.json"
    if template_path.is_file():
        try:
            tpl = json.loads(template_path.read_text(encoding="utf-8-sig"))
            if isinstance(tpl, dict):
                tpl["id"] = path.parent.name
                tpl["name"] = path.parent.name
                return tpl
        except Exception:
            pass
    return {
        "id": path.parent.name,
        "name": path.parent.name,
        "tracks": [],
        "materials": {
            "videos": [],
            "audios": [],
            "texts": [],
            "effects": [],
            "filters": [],
            "stickers": [],
            "canvases": [],
            "sound_effects": [],
            "transitions": [],
            "keyframes": [],
            "speeds": [],
        },
        "canvas_config": {"height": 1080, "ratio": "original", "width": 1920},
        "version": 2,
    }


def load_raw_draft(project: str) -> Tuple[Dict[str, Any], Path]:
    """
    Load draft as a mutable dict.
    If the draft file is encrypted by CapCut v5+ (does not start with '{'),
    notify the user to select an unencrypted draft (or create a new draft).
    """
    path = resolve_draft_json_path(project)
    text = path.read_text(encoding="utf-8-sig").strip()
    if not text.startswith("{"):
        raise ValueError(
            f"Dự án '{path.parent.name}' được CapCut v5+ đặt ở chế độ Mã hóa (Encrypted Project). "
            f"CapCut khóa can thiệp file đĩa với dự án này. "
            f"Vui lòng chọn dự án chưa mã hóa (như '0725') hoặc bấm '+ Tạo draft' để tự động hóa 100%!"
        )
    try:
        data = json.loads(text)
    except Exception as e:
        raise ValueError(f"Lỗi đọc file JSON draft '{path.parent.name}': {e}") from e

    if not isinstance(data, dict):
        raise ValueError(f"Draft JSON root phải là object: {path}")
    return data, path


def sync_draft_meta_info(project_dir: Path, draft: Dict[str, Any]) -> None:
    """Keep draft_meta_info.json's draft_materials list in sync with draft_content.json."""
    meta_path = project_dir / "draft_meta_info.json"
    if not meta_path.is_file():
        return
    try:
        meta_text = meta_path.read_text(encoding="utf-8-sig")
        meta = json.loads(meta_text)
        if not isinstance(meta, dict):
            return

        mats = draft.get("materials") or {}
        if not isinstance(mats, dict):
            return

        draft_materials = meta.setdefault("draft_materials", [])
        if not isinstance(draft_materials, list):
            meta["draft_materials"] = []
            draft_materials = meta["draft_materials"]

        type_map = {3: [], 6: []}

        for fx in mats.get("video_effects") or []:
            if isinstance(fx, dict) and fx.get("id"):
                type_map[6].append({
                    "id": fx.get("id"),
                    "effect_id": fx.get("effect_id", ""),
                    "resource_id": fx.get("resource_id", ""),
                    "name": fx.get("name", ""),
                    "type": fx.get("type", "video_effect"),
                })
        for flt in mats.get("filters") or []:
            if isinstance(flt, dict) and flt.get("id"):
                type_map[6].append({
                    "id": flt.get("id"),
                    "effect_id": flt.get("effect_id", ""),
                    "resource_id": flt.get("resource_id", ""),
                    "name": flt.get("name", ""),
                    "type": "filter",
                })
        for st in mats.get("stickers") or []:
            if isinstance(st, dict) and st.get("id"):
                type_map[3].append({
                    "id": st.get("id"),
                    "resource_id": st.get("resource_id", ""),
                    "type": "sticker",
                })

        existing_types = {item.get("type"): item for item in draft_materials if isinstance(item, dict)}
        for t_code, vals in type_map.items():
            if vals:
                if t_code in existing_types:
                    existing_types[t_code]["value"] = vals
                else:
                    draft_materials.append({"type": t_code, "value": vals})

        payload = json.dumps(meta, ensure_ascii=False, indent=2)
        meta_path.write_text(payload, encoding="utf-8")
    except Exception:
        pass


def save_raw_draft(json_path: Path, draft: Dict[str, Any], *, backup: bool = True) -> Path:
    """
    Atomic-ish write: optional .bak then write UTF-8 JSON.
    Also syncs draft_meta_info.json if present in the project directory.
    """
    json_path = Path(json_path)
    if backup and json_path.is_file():
        bak = json_path.with_suffix(json_path.suffix + ".bak")
        try:
            shutil.copy2(json_path, bak)
        except Exception:
            pass

    tmp = json_path.with_suffix(json_path.suffix + ".tmp")
    payload = json.dumps(draft, ensure_ascii=False, indent=2)
    tmp.write_text(payload, encoding="utf-8")

    # Replace target file with retry and direct write fallback for Windows locks
    if tmp.exists():
        replaced = False
        import time
        for attempt in range(5):
            try:
                tmp.replace(json_path)
                replaced = True
                break
            except Exception:
                time.sleep(0.05 * (attempt + 1))
        if not replaced:
            try:
                json_path.write_text(payload, encoding="utf-8")
                if tmp.exists():
                    try:
                        tmp.unlink()
                    except Exception:
                        pass
            except Exception as e:
                raise PermissionError(
                    f"CapCut Desktop đang khóa file dự án '{json_path.name}'. Vui lòng bấm 'Menu -> Back to homepage' trên CapCut để thoát dự án ra Trang chủ rồi thử lại!"
                ) from e

    # Sync CapCut 5.x metadata index
    sync_draft_meta_info(json_path.parent, draft)

    return json_path
