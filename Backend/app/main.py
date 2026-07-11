from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.application.admin.dev_admin_seed_service import ensure_dev_admin_seed
from app.application.admin.rbac_service import ensure_rbac_seed
from app.application.compliance.retention_service import ensure_retention_seed
from app.application.security.security_config_service import ensure_security_config_seed
from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.core.redis import close_redis
from app.middleware.idempotency import IdempotencyMiddleware

load_dotenv()

# Settings are cached; ensure env is loaded before the first read.
get_settings.cache_clear()
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    import logging

    logger = logging.getLogger(__name__)
    if settings.app_env == "development" and settings.event_dispatch_mode == "outbox":
        logger.warning(
            "EVENT_DISPATCH_MODE=outbox in development — run "
            "`python -m app.jobs.run_event_worker` (and outbox relay) or set "
            "EVENT_USE_WORKER_IN_DEV=false for inline email delivery."
        )

    async with AsyncSessionLocal() as session:
        await ensure_dev_admin_seed(session)
        await ensure_rbac_seed(session)
        await ensure_security_config_seed(session)
        await ensure_retention_seed(session)
        await session.commit()
    yield
    await close_redis()


app = FastAPI(
    title=settings.app_name,
    description="ZYND Wealth Operating System — Event-first API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(IdempotencyMiddleware, path_prefix=f"{settings.api_prefix}/transactions")

app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/")
async def root() -> dict:
    return {
        "name": settings.app_name,
        "version": "0.1.0",
        "docs": "/docs",
    }
