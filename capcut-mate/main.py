import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import CORS_ORIGIN_REGEX, CORS_ORIGINS, HOST, PORT
from src.router import v1_router
from src.router.local_draft import router as local_draft_router
from src.router.local_srt import router as local_srt_router
from src.router.local_motion import router as local_motion_router
from src.router.local_visual import router as local_visual_router
from src.router.local_content import router as local_content_router
from src.router.local_tool_ops import router as local_tool_ops_router
from src.utils.logger import logger
from src.middlewares import PrepareMiddleware, ResponseMiddleware, TraceContextMiddleware

from src.router.local_media_ops import router as local_media_ops_router
from src.router.local_fx_ops import router as local_fx_ops_router
from src.router.local_structure_ops import router as local_structure_ops_router
from src.router.local_caption_ops import router as local_caption_ops_router

_wave2_optional = [
    local_media_ops_router,
    local_fx_ops_router,
    local_structure_ops_router,
    local_caption_ops_router,
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    from src.utils.deferred_delete import deferred_delete_background_loop
    from src.utils.draft_cleanup import draft_cleanup_background_loop

    cleanup_task = asyncio.create_task(draft_cleanup_background_loop())
    deferred_delete_task = asyncio.create_task(deferred_delete_background_loop())
    try:
        yield
    finally:
        for bg_task in (cleanup_task, deferred_delete_task):
            bg_task.cancel()
            with suppress(asyncio.CancelledError):
                await bg_task


# 1. 创建 FastAPI 应用
app: FastAPI = FastAPI(title="CapCut Mate API", version="1.0", lifespan=lifespan)


@app.get("/health", tags=["health"])
async def health():
    """Smoke + engine flags — single project, pure Python."""
    return {
        "status": "ok",
        "be": "capcut-mate",
        "engines": {
            "mate": True,
            "local": True,
            "cli_bridge": False,
        },
        "capcut_cli_required": False,
        "api_prefix": "/openapi/capcut-mate/v1",
        "local_prefix": "/openapi/capcut-mate/v1/local",
    }


# 2. 注册路由
# Chỉ capcut-mate: Python native + local draft engine (KHÔNG phụ thuộc capcut-cli)
app.include_router(router=v1_router, prefix="/openapi/capcut-mate", tags=["capcut-mate"])
# Local pure-Python engines (port từ CLI — không Node)
_LOCAL_ROUTERS = [
    local_draft_router,
    local_srt_router,
    local_motion_router,
    local_visual_router,
    local_content_router,
    local_tool_ops_router,  # WAVE2 E tooling/batch
]
for _r in _wave2_optional:
    if _r is not None:
        _LOCAL_ROUTERS.append(_r)
for _r in _LOCAL_ROUTERS:
    app.include_router(router=_r, prefix="/openapi/capcut-mate", tags=["local-python"])

# 3. 添加中间件（最后注册的 chạy outermost trước）
# CORS: browser Vite :5173 gọi :30000 — không có CORS sẽ bị chặn
app.add_middleware(middleware_class=PrepareMiddleware)
app.add_middleware(middleware_class=ResponseMiddleware)
app.add_middleware(middleware_class=TraceContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. 打印所有路由
for r in app.routes:
    # 1. 取 HTTP 方法列表
    methods = getattr(r, "methods", None) or [getattr(r, "method", "WS")]
    # 2. 安全地取路径
    path = getattr(r, "path", "<unknown>")
    # 3. 安全地取函数名
    name = getattr(r, "name", "<unnamed>")
    logger.info("Route: %s %s -> %s", ",".join(sorted(methods)), path, name)

logger.info("CapCut Mate API (single project, pure Python — no capcut-cli)")

# 5. 启动
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT, log_config=None, log_level="info")
