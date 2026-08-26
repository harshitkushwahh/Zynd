from contextlib import asynccontextmanager

from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.exception_handlers import register_domain_exception_handlers
from app.api.v1.router import api_router
from app.application.admin.dev_admin_seed_service import ensure_dev_admin_seed
from app.application.compliance.retention_service import ensure_retention_seed
from app.application.risk_profile.risk_profile_seed_service import ensure_risk_profile_seed
from app.application.goals.goal_template_seed_service import ensure_goal_template_seed
from app.application.integrations.integration_config_service import (
    ensure_integration_config_seed,
    refresh_integration_environment_cache,
)
from app.application.security.security_config_service import ensure_security_config_seed
from app.core.config import get_settings
from app.core.logging_config import configure_logging
from app.core.database import AsyncSessionLocal
from app.core.redis import close_redis
from app.core.startup import (
    distributor_branches_table_exists,
    refresh_database_pool,
    run_dev_migrations,
)
from app.middleware.idempotency import IdempotencyMiddleware

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_BACKEND_ROOT / ".env")

# Settings are cached; ensure env is loaded before the first read.
configure_logging()
get_settings.cache_clear()
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    import logging

    from app.infrastructure.notifications.email_service import smtp_configured

    logger = logging.getLogger(__name__)

    # Re-read .env on each process start (uvicorn --reload does not watch .env).
    load_dotenv(_BACKEND_ROOT / ".env", override=True)
    get_settings.cache_clear()
    runtime_settings = get_settings()

    if runtime_settings.debug and runtime_settings.app_env == "development":
        if not smtp_configured():
            dev_email_msg = (
                "DEV: SMTP disabled — password reset links print as [DEV PASSWORD RESET] "
                "in this terminal."
            )
            logger.warning(dev_email_msg)
            print(dev_email_msg, flush=True)
        logger.info(
            "DEV auth: forgot-password skips Turnstile; DEV_SKIP_RATE_LIMITS=%s",
            runtime_settings.dev_skip_rate_limits,
        )

    if runtime_settings.app_env == "development" and runtime_settings.event_dispatch_mode == "outbox":
        logger.warning(
            "EVENT_DISPATCH_MODE=outbox in development — run "
            "`python -m app.jobs.run_event_worker` (and outbox relay) or set "
            "EVENT_USE_WORKER_IN_DEV=false for inline email delivery."
        )
    if runtime_settings.sms_provider == "twilio":
        if not runtime_settings.twilio_from_number and not runtime_settings.twilio_messaging_service_sid:
            logger.error(
                "SMS_PROVIDER=twilio but TWILIO_FROM_NUMBER and TWILIO_MESSAGING_SERVICE_SID "
                "are both empty. Load Backend/.env and restart, or quote the number: "
                'TWILIO_FROM_NUMBER="+91..."'
            )
        elif runtime_settings.debug:
            logger.info(
                "Twilio SMS enabled (from=%s, messaging_service=%s)",
                runtime_settings.twilio_from_number or "—",
                runtime_settings.twilio_messaging_service_sid or "—",
            )

    if runtime_settings.app_env == "development":
        run_dev_migrations(runtime_settings)
        await refresh_database_pool()

    async with AsyncSessionLocal() as session:
        await ensure_dev_admin_seed(session)
        await ensure_security_config_seed(session)
        await ensure_risk_profile_seed(session)
        await ensure_goal_template_seed(session)
        await ensure_integration_config_seed(session)
        await ensure_retention_seed(session)
        await refresh_integration_environment_cache(session)
        await session.commit()

    from app.application.mf.mf_pipeline_orchestrator_service import initialize_pipeline_orchestrator

    await initialize_pipeline_orchestrator()
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
register_domain_exception_handlers(app)

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
