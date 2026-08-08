from __future__ import annotations

import os
import shutil
from typing import Any

from backend.clients.omniroute_client import health as omniroute_health


VALID_STATUSES = {"ready", "degraded", "offline", "not_configured", "error"}

SERVICE_RUNTIME_STATUS: dict[str, dict[str, Any]] = {
    "capcut": {"status": "offline", "message": "Backend is not mounted"},
    "mediacrawler": {"status": "offline", "message": "Backend is not mounted"},
    "openmontage": {"status": "offline", "message": "Backend is not mounted"},
}


def set_service_runtime_status(service_id: str, status: str, message: str | None = None) -> None:
    if status not in VALID_STATUSES:
        raise ValueError(f"Unsupported service status: {status}")
    SERVICE_RUNTIME_STATUS[service_id] = {"status": status, "message": message}


def _runtime_status(service_id: str) -> dict[str, Any]:
    return SERVICE_RUNTIME_STATUS.get(
        service_id,
        {"status": "not_configured", "message": "No runtime contract configured"},
    )


def _service(
    service_id: str,
    name: str,
    category: str,
    status: str,
    capabilities: list[str],
    *,
    enabled: bool = True,
    health: dict[str, Any] | None = None,
    ui_mode: str | None = None,
) -> dict[str, Any]:
    item: dict[str, Any] = {
        "id": service_id,
        "name": name,
        "category": category,
        "status": status if status in VALID_STATUSES else "error",
        "enabled": enabled,
        "health": health or {},
        "capabilities": capabilities,
    }
    if ui_mode:
        item["uiMode"] = ui_mode
    return item


async def build_service_registry() -> list[dict[str, Any]]:
    omni_health = await omniroute_health()
    ffmpeg_path = shutil.which(os.environ.get("FFMPEG_BINARY", "ffmpeg"))
    capcut = _runtime_status("capcut")
    media_crawler = _runtime_status("mediacrawler")
    open_montage = _runtime_status("openmontage")

    return [
        _service(
            "omniroute",
            "OmniRoute",
            "ai",
            omni_health.get("status", "error"),
            ["models", "providers", "chat", "routing"],
            health=omni_health,
        ),
        _service(
            "capcut",
            "CapCut Automation",
            "output",
            capcut["status"],
            ["draft", "render", "automation"],
            health={"message": capcut.get("message")},
            ui_mode="separate",
        ),
        _service(
            "ffmpeg",
            "Media Engine",
            "media",
            "ready" if ffmpeg_path else "offline",
            ["ffmpeg", "analyze", "transcode"],
            health={"binaryAvailable": True} if ffmpeg_path else {"message": "FFmpeg binary not found"},
        ),
        _service(
            "mediacrawler",
            "MediaCrawler",
            "media",
            media_crawler["status"],
            ["crawl", "collect"],
            health={"message": media_crawler.get("message")},
        ),
        _service(
            "openmontage",
            "OpenMontage",
            "media",
            open_montage["status"],
            ["timeline", "compose"],
            health={"message": open_montage.get("message")},
        ),
        _service(
            "tts",
            "Voice Engine",
            "voice",
            "not_configured",
            ["speech"],
            health={"message": "Health contract is not configured"},
        ),
        _service(
            "playwright",
            "Playwright / CDP",
            "automation",
            "not_configured",
            ["browser", "cdp"],
            health={"message": "Health contract is not configured"},
        ),
        _service(
            "youwee",
            "Youwee",
            "media",
            "not_configured",
            ["download", "subtitles"],
            health={"message": "Embedded runtime has no gateway health contract"},
        ),
    ]
