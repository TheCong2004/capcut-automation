"""
ArtCraft Unified Python Backend Server
Merges CapCutMate, OpenMontage, and MediaCrawler into a single FastAPI process on port 30000.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

PROJECT_ROOT = Path(__file__).resolve().parent

# Ensure sub-project paths are in sys.path
for sub_dir in ["capcut-mate", "OpenMontage", "MediaCrawler-be"]:
    sub_path = str(PROJECT_ROOT / sub_dir)
    if sub_path not in sys.path:
        sys.path.insert(0, sub_path)

app = FastAPI(title="ArtCraft Unified Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Include CapCutMate
try:
    import main as capcut_main
    app.include_router(capcut_main.app.router)
except Exception as err:
    print(f"[UnifiedBE] Failed to include CapCutMate: {err}")

# 2. Mount OpenMontage
try:
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
except Exception as err:
    print(f"[UnifiedBE] Failed to mount OpenMontage: {err}")

# 3. MediaCrawler Routers & Config Endpoints
try:
    from api.routers import crawler_router, data_router, websocket_router
    from api.main import get_platforms, get_config_options, check_environment, app as mediacrawler_app

    app.include_router(crawler_router, prefix="/api")
    app.include_router(data_router, prefix="/api")
    app.include_router(websocket_router, prefix="/api")

    app.add_api_route("/api/config/platforms", get_platforms, methods=["GET"])
    app.add_api_route("/api/config/options", get_config_options, methods=["GET"])
    app.add_api_route("/api/env/check", check_environment, methods=["GET"])

    app.mount("/mediacrawler", mediacrawler_app)
except Exception as err:
    print(f"[UnifiedBE] Failed to mount MediaCrawler: {err}")


# 4. Proxy FreeLLMAPI Node server (port 3001) through unified port 30000
try:
    import httpx
    from fastapi import Request, Response

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
    print(f"[UnifiedBE] Failed to mount FreeLLMAPI proxy: {err}")


@app.get("/api/unified/health")
async def unified_health():
    return {"status": "ok", "unified": True}


if __name__ == "__main__":
    port = int(os.environ.get("BE_PORT", "30000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
