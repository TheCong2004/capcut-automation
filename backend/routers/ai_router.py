from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from backend.clients.omniroute_client import (
    get_models,
    health,
)


router = APIRouter(
    prefix="/api/ai",
    tags=["ai"],
)


def omniroute_error_response() -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={
            "error": {
                "code": "OMNIROUTE_UNAVAILABLE",
                "message": "OmniRoute is unavailable",
                "service": "omniroute",
            }
        },
    )


@router.get("/health")
async def ai_health():
    return await health()


@router.get("/models")
async def ai_models():
    try:
        return await get_models()

    except Exception:
        return omniroute_error_response()
