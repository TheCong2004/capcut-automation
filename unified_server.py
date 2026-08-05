"""
ArtCraft Unified Python Backend Server
Merges CapCutMate, OpenMontage, and MediaCrawler into a single FastAPI process on port 30000.
"""

from __future__ import annotations

import importlib.util
import os
import sys
import traceback
from pathlib import Path
from typing import Any, Dict

import httpx
import uvicorn
from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

PROJECT_ROOT = Path(__file__).resolve().parent

app = FastAPI(title="ArtCraft Unified Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SERVICES_STATUS: Dict[str, Dict[str, Any]] = {
    "unified_server": {"status": "ready"},
    "llm": {"status": "unavailable", "message": None},
    "capcut_mate": {"status": "unavailable", "message": None},
    "open_montage": {"status": "unavailable", "message": None},
    "media_crawler": {"status": "unavailable", "message": None},
}


def load_module_from_file(module_name: str, file_path: Path):
    """Dynamically loads a Python module from an absolute path under a custom module name."""
    spec = importlib.util.spec_from_file_location(module_name, str(file_path))
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not create module spec for {module_name} at {file_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


# 1. Include CapCutMate (MANDATORY BACKEND)
try:
    capcut_dir = PROJECT_ROOT / "capcut-mate"
    if str(capcut_dir) not in sys.path:
        sys.path.insert(0, str(capcut_dir))

    capcut_main_file = capcut_dir / "main.py"
    capcut_main = load_module_from_file("capcut_mate_main", capcut_main_file)

    app.include_router(capcut_main.app.router)
    SERVICES_STATUS["capcut_mate"] = {"status": "ready", "message": None}
    print("[UnifiedBE] Successfully mounted CapCutMate backend.")
except Exception as err:
    print(f"[CRITICAL][UnifiedBE] Mandatory backend CapCutMate failed to load: {err}", file=sys.stderr)
    traceback.print_exc()
    SERVICES_STATUS["capcut_mate"] = {"status": "unavailable", "message": str(err)}
    # Fail fast on mandatory component failure as specified in requirements
    sys.exit(1)

# 2. Mount OpenMontage (OPTIONAL)
try:
    openmontage_dir = PROJECT_ROOT / "OpenMontage"
    if str(openmontage_dir) not in sys.path:
        sys.path.insert(0, str(openmontage_dir))

    import asyncio
    from backlot.server import app as openmontage_app, _watch_projects
    from lib.paths import PROJECTS_DIR

    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)

    openmontage_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.mount("/openmontage", openmontage_app)
    app.mount("/api/openmontage", openmontage_app)

    @app.on_event("startup")
    async def _start_openmontage_watcher():
        asyncio.create_task(_watch_projects())

    SERVICES_STATUS["open_montage"] = {"status": "ready", "message": None}
    print("[UnifiedBE] Successfully mounted OpenMontage backend.")
except Exception as err:
    print(f"[UnifiedBE] Optional backend OpenMontage failed to load: {err}")
    SERVICES_STATUS["open_montage"] = {"status": "unavailable", "message": str(err)}

# 3. MediaCrawler Routers & Config Endpoints (OPTIONAL)
try:
    mediacrawler_dir = PROJECT_ROOT / "MediaCrawler-be"
    if str(mediacrawler_dir) not in sys.path:
        sys.path.insert(0, str(mediacrawler_dir))

    from api.routers import crawler_router, data_router, websocket_router
    from api.main import get_platforms, get_config_options, check_environment, app as mediacrawler_app

    app.include_router(crawler_router, prefix="/api")
    app.include_router(data_router, prefix="/api")
    app.include_router(websocket_router, prefix="/api")

    app.add_api_route("/api/config/platforms", get_platforms, methods=["GET"])
    app.add_api_route("/api/config/options", get_config_options, methods=["GET"])
    app.add_api_route("/api/env/check", check_environment, methods=["GET"])

    app.mount("/mediacrawler", mediacrawler_app)
    SERVICES_STATUS["media_crawler"] = {"status": "ready", "message": None}
    print("[UnifiedBE] Successfully mounted MediaCrawler backend.")
except Exception as err:
    print(f"[UnifiedBE] Optional backend MediaCrawler failed to load: {err}")
    SERVICES_STATUS["media_crawler"] = {"status": "unavailable", "message": str(err)}


# 4. Proxy FreeLLMAPI Node server (port 3001) through unified port 30000
try:
    _freellm_client = httpx.AsyncClient(base_url="http://127.0.0.1:3001", timeout=60.0)

    @app.api_route("/freellmapi_proxy/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    @app.api_route("/v1/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    @app.api_route("/api/keys{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    @app.api_route("/api/health{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    @app.api_route("/api/fallback{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    @app.api_route("/api/analytics{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    @app.api_route("/api/settings{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    async def proxy_freellmapi(request: Request, path: str = ""):
        url = request.url.path
        if url.startswith("/freellmapi_proxy/"):
            url = "/" + url[len("/freellmapi_proxy/"):]
        headers = {k: v for k, v in request.headers.items() if k.lower() != "host"}
        content = await request.body()
        try:
            resp = await _freellm_client.request(
                method=request.method,
                url=url,
                headers=headers,
                params=request.query_params,
                content=content,
            )
            return Response(content=resp.content, status_code=resp.status_code, headers=dict(resp.headers))
        except Exception as p_err:
            return Response(content=f'{{"error": "{p_err}"}}', status_code=502, media_type="application/json")
except Exception as err:
    print(f"[UnifiedBE] Failed to setup FreeLLMAPI proxy: {err}")


# Health & Readiness Endpoints
@app.get("/api/unified/health")
async def unified_health():
    # Perform active probe for LLM service
    llm_base_url = os.environ.get("LLM_BASE_URL", "http://127.0.0.1:20128")
    llm_ready = False
    llm_msg = None
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.get(f"{llm_base_url.rstrip('/')}/v1/models")
            if res.status_code < 500:
                llm_ready = True
            else:
                llm_msg = f"HTTP {res.status_code}"
    except Exception as e:
        llm_msg = str(e)

    SERVICES_STATUS["llm"] = {
        "status": "ready" if llm_ready else "unavailable",
        "message": llm_msg,
    }

    # System health status
    is_capcut_ready = SERVICES_STATUS["capcut_mate"]["status"] == "ready"
    if is_capcut_ready and llm_ready:
        overall_status = "healthy"
    elif is_capcut_ready or llm_ready:
        overall_status = "degraded"
    else:
        overall_status = "unhealthy"

    return {
        "status": overall_status,
        "services": {
            "unified_server": SERVICES_STATUS["unified_server"],
            "llm": SERVICES_STATUS["llm"],
            "capcut_mate": SERVICES_STATUS["capcut_mate"],
        },
    }


@app.get("/api/unified/readiness")
async def unified_readiness():
    health_resp = await unified_health()
    services = health_resp["services"]

    # Mandatory readiness check: unified_server and capcut_mate must be ready
    capcut_status = services["capcut_mate"]["status"]
    if capcut_status != "ready":
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "not_ready",
                "reason": f"Mandatory dependency capcut_mate is unavailable: {services['capcut_mate']['message']}",
                "services": services,
            },
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "status": "ready",
            "services": services,
        },
    )


if __name__ == "__main__":
    port = int(os.environ.get("UNIFIED_SERVER_PORT", os.environ.get("BE_PORT", "30000")))
    app_host = os.environ.get("APP_HOST", "0.0.0.0")
    uvicorn.run(app, host=app_host, port=port)
