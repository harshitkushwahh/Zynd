from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.core.config import Settings, get_settings

IntegrationEnvironment = Literal["test", "live"]
IntegrationProvider = Literal["finprim", "cybrilla", "kyckart"]

FINPRIM_FIELDS = (
    "fp_base_url",
    "fp_tenant",
    "fp_client_id",
    "fp_client_secret",
    "fp_webhook_secret",
    "fp_webhook_callback_url",
    "digilocker_fp_tenant",
)
CYBRILLA_FIELDS = (
    "fp_poa_token_base_url",
    "fp_poa_client_id",
    "fp_poa_client_secret",
    "fp_poa_base_url",
    "fp_poa_auth_tenant",
)
KYCKART_FIELDS = ("kyckart_base_url", "kyckart_api_key")

PROVIDER_FIELDS: dict[IntegrationProvider, tuple[str, ...]] = {
    "finprim": FINPRIM_FIELDS,
    "cybrilla": CYBRILLA_FIELDS,
    "kyckart": KYCKART_FIELDS,
}


def resolve_integration_field(settings: Settings, field: str, mode: IntegrationEnvironment) -> str:
    """Resolve env field for a mode. Legacy unsuffixed vars apply to live only."""
    mode_value = str(getattr(settings, f"{field}_{mode}", "") or "").strip()
    if mode == "test":
        return mode_value
    legacy_value = str(getattr(settings, field, "") or "").strip()
    return mode_value or legacy_value


def _resolve_field(settings: Settings, field: str, mode: IntegrationEnvironment) -> str:
    return resolve_integration_field(settings, field, mode)


@dataclass(frozen=True)
class FinprimRuntime:
    environment: IntegrationEnvironment
    base_url: str
    tenant: str
    client_id: str
    client_secret: str
    webhook_secret: str
    webhook_callback_url: str
    digilocker_tenant: str

    @property
    def configured(self) -> bool:
        return bool(
            self.base_url.strip()
            and self.tenant.strip()
            and self.client_id.strip()
            and self.client_secret.strip()
        )


@dataclass(frozen=True)
class CybrillaRuntime:
    environment: IntegrationEnvironment
    token_base_url: str
    client_id: str
    client_secret: str
    base_url: str
    auth_tenant: str

    @property
    def resolved_token_base_url(self) -> str:
        return self.token_base_url.strip() or self.base_url.strip()

    @property
    def configured(self) -> bool:
        return bool(
            self.resolved_token_base_url
            and self.client_id.strip()
            and self.client_secret.strip()
            and self.base_url.strip()
        )


@dataclass(frozen=True)
class KyckartRuntime:
    environment: IntegrationEnvironment
    base_url: str
    api_key: str

    @property
    def configured(self) -> bool:
        return bool(self.base_url.strip() and self.api_key.strip())


def get_provider_environment(provider: IntegrationProvider) -> IntegrationEnvironment:
    from app.application.integrations.integration_config_service import get_cached_integration_environment

    return get_cached_integration_environment(provider)


def get_finprim_runtime() -> FinprimRuntime:
    settings = get_settings()
    mode = get_provider_environment("finprim")
    tenant = _resolve_field(settings, "fp_tenant", mode)
    return FinprimRuntime(
        environment=mode,
        base_url=_resolve_field(settings, "fp_base_url", mode),
        tenant=tenant,
        client_id=_resolve_field(settings, "fp_client_id", mode),
        client_secret=_resolve_field(settings, "fp_client_secret", mode),
        webhook_secret=_resolve_field(settings, "fp_webhook_secret", mode),
        webhook_callback_url=_resolve_field(settings, "fp_webhook_callback_url", mode),
        digilocker_tenant=_resolve_field(settings, "digilocker_fp_tenant", mode) or tenant,
    )


def get_cybrilla_runtime() -> CybrillaRuntime:
    settings = get_settings()
    mode = get_provider_environment("cybrilla")
    return CybrillaRuntime(
        environment=mode,
        token_base_url=_resolve_field(settings, "fp_poa_token_base_url", mode),
        client_id=_resolve_field(settings, "fp_poa_client_id", mode),
        client_secret=_resolve_field(settings, "fp_poa_client_secret", mode),
        base_url=_resolve_field(settings, "fp_poa_base_url", mode) or "https://api.cybrilla.com",
        auth_tenant=_resolve_field(settings, "fp_poa_auth_tenant", mode) or "cybrillapoa",
    )


def get_kyckart_runtime() -> KyckartRuntime:
    settings = get_settings()
    mode = get_provider_environment("kyckart")
    return KyckartRuntime(
        environment=mode,
        base_url=_resolve_field(settings, "kyckart_base_url", mode),
        api_key=_resolve_field(settings, "kyckart_api_key", mode),
    )


def is_finprim_enabled() -> bool:
    settings = get_settings()
    if not settings.fp_enabled:
        return False
    return get_finprim_runtime().configured


def is_kyckart_live() -> bool:
    settings = get_settings()
    if settings.kyc_provider_mode == "stub":
        return False
    if settings.kyc_provider_mode == "live":
        return True
    finprim = get_finprim_runtime()
    kyckart = get_kyckart_runtime()
    return bool(kyckart.configured and finprim.configured)


def is_cybrilla_poa_live() -> bool:
    settings = get_settings()
    if settings.kyc_provider_mode == "stub":
        return False
    if settings.kyc_provider_mode == "live":
        return True
    return get_cybrilla_runtime().configured


def profile_configured(settings: Settings, provider: IntegrationProvider, mode: IntegrationEnvironment) -> bool:
    if provider == "finprim":
        return bool(
            _resolve_field(settings, "fp_base_url", mode)
            and _resolve_field(settings, "fp_tenant", mode)
            and _resolve_field(settings, "fp_client_id", mode)
            and _resolve_field(settings, "fp_client_secret", mode)
        )
    if provider == "cybrilla":
        token_base = _resolve_field(settings, "fp_poa_token_base_url", mode) or _resolve_field(
            settings, "fp_poa_base_url", mode
        )
        return bool(
            token_base
            and _resolve_field(settings, "fp_poa_client_id", mode)
            and _resolve_field(settings, "fp_poa_client_secret", mode)
            and _resolve_field(settings, "fp_poa_base_url", mode)
        )
    return bool(
        _resolve_field(settings, "kyckart_base_url", mode)
        and _resolve_field(settings, "kyckart_api_key", mode)
    )


def mask_secret(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        return ""
    if len(cleaned) <= 4:
        return "••••"
    return f"••••{cleaned[-4:]}"


def invalidate_integration_clients() -> None:
    from app.infrastructure.kyc.fp_clients import invalidate_fp_tokens
    from app.infrastructure.mf.fp_oms_client import invalidate_mf_token

    invalidate_mf_token()
    invalidate_fp_tokens()
