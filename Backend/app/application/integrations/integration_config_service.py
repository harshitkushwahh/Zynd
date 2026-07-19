from __future__ import annotations

import json
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.integrations.integration_runtime import (
    IntegrationProvider,
    get_cybrilla_runtime,
    get_finprim_runtime,
    get_kyckart_runtime,
    invalidate_integration_clients,
    mask_secret,
    profile_configured,
    resolve_integration_field,
)
from app.core.config import get_settings
from app.core.redis import get_redis
from app.infrastructure.persistence.models import SecurityConfig

IntegrationEnvironment = Literal["test", "live"]

CACHE_TTL_SECONDS = 300
INTEGRATION_PROVIDERS: tuple[IntegrationProvider, ...] = ("finprim", "cybrilla", "kyckart")

DEFAULT_INTEGRATION_CONFIG: dict[str, str] = {
    "integrations.finprim.environment": "live",
    "integrations.cybrilla.environment": "live",
    "integrations.kyckart.environment": "live",
}

_provider_mode_cache: dict[str, IntegrationEnvironment] = {
    provider: "live" for provider in INTEGRATION_PROVIDERS
}


def _config_key(provider: IntegrationProvider) -> str:
    return f"integrations.{provider}.environment"


def get_cached_integration_environment(provider: IntegrationProvider) -> IntegrationEnvironment:
    mode = _provider_mode_cache.get(provider, "test")
    return mode if mode in {"test", "live"} else "test"


def _set_cached_integration_environment(provider: IntegrationProvider, mode: IntegrationEnvironment) -> None:
    _provider_mode_cache[provider] = mode


async def ensure_integration_config_seed(db: AsyncSession) -> None:
    for key, value in DEFAULT_INTEGRATION_CONFIG.items():
        result = await db.execute(select(SecurityConfig).where(SecurityConfig.key == key))
        if result.scalar_one_or_none() is None:
            db.add(SecurityConfig(key=key, value={"value": value}))
    await db.flush()


async def get_integration_config_value(
    db: AsyncSession,
    key: str,
    default: str = "test",
) -> str:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    cache_key = f"integration_config:{key}"
    cached = await redis.get(cache_key)
    if cached:
        payload = json.loads(cached)
        value = str(payload.get("value", default))
        return value if value in {"test", "live"} else default

    result = await db.execute(
        select(SecurityConfig).where(SecurityConfig.key == key, SecurityConfig.is_active.is_(True))
    )
    row = result.scalar_one_or_none()
    if not row:
        fallback = DEFAULT_INTEGRATION_CONFIG.get(key, default)
        await redis.setex(cache_key, CACHE_TTL_SECONDS, json.dumps({"value": fallback}))
        return fallback

    raw = row.value.get("value", row.value) if isinstance(row.value, dict) else row.value
    value = str(raw)
    if value not in {"test", "live"}:
        value = default
    await redis.setex(cache_key, CACHE_TTL_SECONDS, json.dumps({"value": value}))
    return value


async def invalidate_integration_config_cache(key: str | None = None) -> None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    if key:
        await redis.delete(f"integration_config:{key}")
        return
    for config_key in DEFAULT_INTEGRATION_CONFIG:
        await redis.delete(f"integration_config:{config_key}")


async def refresh_integration_environment_cache(db: AsyncSession) -> None:
    for provider in INTEGRATION_PROVIDERS:
        mode = await get_integration_config_value(db, _config_key(provider), "test")
        typed_mode: IntegrationEnvironment = mode if mode in {"test", "live"} else "test"
        _set_cached_integration_environment(provider, typed_mode)


async def set_integration_environment(
    db: AsyncSession,
    *,
    provider: IntegrationProvider,
    environment: IntegrationEnvironment,
) -> dict[str, Any]:
    if environment not in {"test", "live"}:
        raise ValueError("environment must be test or live")

    key = _config_key(provider)
    result = await db.execute(select(SecurityConfig).where(SecurityConfig.key == key))
    row = result.scalar_one_or_none()
    if row is None:
        row = SecurityConfig(key=key, value={"value": environment})
        db.add(row)
    else:
        row.value = {"value": environment}

    await db.flush()
    await invalidate_integration_config_cache(key)
    _set_cached_integration_environment(provider, environment)
    invalidate_integration_clients()
    return await build_provider_status(provider)


def _profile_preview(settings, provider: IntegrationProvider, mode: IntegrationEnvironment) -> dict[str, Any]:
    if provider == "finprim":
        return {
            "configured": profile_configured(settings, provider, mode),
            "base_url": resolve_integration_field(settings, "fp_base_url", mode),
            "tenant": resolve_integration_field(settings, "fp_tenant", mode),
            "client_id_masked": mask_secret(resolve_integration_field(settings, "fp_client_id", mode)),
            "client_secret_masked": mask_secret(
                resolve_integration_field(settings, "fp_client_secret", mode)
            ),
            "webhook_secret_masked": mask_secret(
                resolve_integration_field(settings, "fp_webhook_secret", mode)
            ),
        }
    if provider == "cybrilla":
        token_base = resolve_integration_field(
            settings, "fp_poa_token_base_url", mode
        ) or resolve_integration_field(settings, "fp_poa_base_url", mode)
        auth_tenant = resolve_integration_field(settings, "fp_poa_auth_tenant", mode)
        return {
            "configured": profile_configured(settings, provider, mode),
            "base_url": resolve_integration_field(settings, "fp_poa_base_url", mode),
            "token_base_url": token_base,
            "tenant": auth_tenant or ("cybrillapoa" if profile_configured(settings, provider, mode) else ""),
            "client_id_masked": mask_secret(resolve_integration_field(settings, "fp_poa_client_id", mode)),
            "client_secret_masked": mask_secret(
                resolve_integration_field(settings, "fp_poa_client_secret", mode)
            ),
        }
    return {
        "configured": profile_configured(settings, provider, mode),
        "base_url": resolve_integration_field(settings, "kyckart_base_url", mode),
        "api_key_masked": mask_secret(resolve_integration_field(settings, "kyckart_api_key", mode)),
    }


async def build_provider_status(provider: IntegrationProvider) -> dict[str, Any]:
    settings = get_settings()
    active_environment = get_cached_integration_environment(provider)
    runtime = {
        "finprim": get_finprim_runtime,
        "cybrilla": get_cybrilla_runtime,
        "kyckart": get_kyckart_runtime,
    }[provider]()

    notes: list[str] = []
    if provider == "finprim" and not settings.fp_enabled:
        notes.append("FP_ENABLED is false — FinPrim calls use stub responses until enabled in .env.")

    return {
        "id": provider,
        "active_environment": active_environment,
        "active_configured": runtime.configured,
        "profiles": {
            "test": _profile_preview(settings, provider, "test"),
            "live": _profile_preview(settings, provider, "live"),
        },
        "notes": notes,
    }


async def list_integration_statuses(db: AsyncSession) -> list[dict[str, Any]]:
    await refresh_integration_environment_cache(db)
    return [await build_provider_status(provider) for provider in INTEGRATION_PROVIDERS]
