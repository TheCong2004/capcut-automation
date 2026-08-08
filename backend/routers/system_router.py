from __future__ import annotations

from fastapi import APIRouter

from backend.services.service_registry import build_service_registry


router = APIRouter(tags=["system"])


@router.get("/api/system/health")
async def system_health():
    services = await build_service_registry()
    non_ready = [service for service in services if service["status"] != "ready"]
    return {
        "status": "degraded" if non_ready else "ready",
        "gateway": "ready",
        "services": {
            "total": len(services),
            "ready": sum(service["status"] == "ready" for service in services),
            "unhealthy": len(non_ready),
        },
    }


@router.get("/api/services")
async def services():
    return {"services": await build_service_registry()}
