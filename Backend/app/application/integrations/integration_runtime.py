from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.core.config import Settings, get_settings

IntegrationEnvironment = Literal["test", "live"]
IntegrationProvider = Literal["finprim", "cybrilla", "kyckart"]

# FinPrim sandbox host for DigiLocker (Multiplus: s.finprim.com — not api.fintechprimitives.com).
FINPRIM_DIGILOCKER_SANDBOX_BASE_URL = "https://s.finprim.com"

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
    "fp_poa_api_tenant",
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
class FinprimDigilockerRuntime:
    environment: IntegrationEnvironment
    base_url: str
    token_base_url: str
    tenant: str
    client_id: str
    client_secret: str

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
    api_tenant: str = ""

    @property
    def resolved_token_base_url(self) -> str:
        return self.token_base_url.strip() or self.base_url.strip()

    @property
    def resolved_api_tenant(self) -> str:
        """x-tenant-id on /poa/* (sandbox kyc_forms often use cybrillarta; OAuth path uses auth_tenant)."""
        clean = (self.api_tenant or self.auth_tenant or "cybrillapoa").strip()
        return clean or "cybrillapoa"

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


def get_finprim_digilocker_environment() -> IntegrationEnvironment:
    settings = get_settings()
    if settings.kyc_digilocker_sandbox:
        return "test"
    return get_provider_environment("finprim")


def _resolve_digilocker_credential(
    settings: Settings,
    field: str,
    mode: IntegrationEnvironment,
) -> str:
    """Resolve digilocker_fp_* OAuth/host fields.

    Unsuffixed DIGILOCKER_FP_CLIENT_* are sandbox-only. Production (KYC_DIGILOCKER_SANDBOX=false)
    uses FP_CLIENT_*_LIVE via runtime fallback unless DIGILOCKER_FP_*_LIVE overrides are set.
    """
    if not settings.kyc_digilocker_sandbox and mode == "live":
        live_value = str(getattr(settings, f"{field}_live", "") or "").strip()
        if live_value:
            return live_value
        if field in {"digilocker_fp_client_id", "digilocker_fp_client_secret"}:
            return ""
        return _resolve_field(settings, field, mode)

    value = _resolve_field(settings, field, mode)
    if value.strip():
        return value
    if mode == "test" and settings.kyc_digilocker_sandbox:
        legacy = str(getattr(settings, field, "") or "").strip()
        if legacy:
            return legacy
    return value


def _resolve_fp_credential_for_digilocker(
    settings: Settings,
    field: str,
    mode: IntegrationEnvironment,
) -> str:
    """Fallback to fp_* only when not in KYC_DIGILOCKER_SANDBOX mode (avoid live FP_* on sandbox)."""
    if settings.kyc_digilocker_sandbox:
        return _resolve_field(settings, field, mode)
    value = _resolve_field(settings, field, mode)
    if value.strip():
        return value
    return str(getattr(settings, field, "") or "").strip()


def _build_finprim_host_runtime(
    settings: Settings,
    mode: IntegrationEnvironment,
    *,
    sandbox: bool,
    base_field: str,
    token_field: str,
    tenant_field: str,
    client_id_field: str,
    client_secret_field: str,
    fallback: FinprimDigilockerRuntime | None = None,
) -> FinprimDigilockerRuntime:
    base_url = _resolve_digilocker_credential(settings, base_field, mode)
    if not base_url.strip():
        if sandbox:
            base_url = FINPRIM_DIGILOCKER_SANDBOX_BASE_URL
        elif fallback and fallback.base_url.strip():
            base_url = fallback.base_url
    token_base = _resolve_digilocker_credential(settings, token_field, mode) or base_url
    tenant = _resolve_digilocker_credential(settings, tenant_field, mode) or (
        fallback.tenant if fallback else ""
    )
    client_id = _resolve_digilocker_credential(settings, client_id_field, mode) or (
        fallback.client_id if fallback else ""
    )
    client_secret = _resolve_digilocker_credential(settings, client_secret_field, mode) or (
        fallback.client_secret if fallback else ""
    )
    return FinprimDigilockerRuntime(
        environment=mode,
        base_url=base_url,
        token_base_url=token_base,
        tenant=tenant,
        client_id=client_id,
        client_secret=client_secret,
    )


def finprim_kyc_tenant_explicitly_configured(settings: Settings | None = None) -> bool:
    """True when KYC_TENANT_* OAuth is intentionally set (not DigiLocker fallback only).

    Partial KYC_TENANT URLs with empty client (common misconfig) must not override
    DigiLocker credentials for /v2/kyc_requests — that causes JWT kid / host mismatch.
    """
    settings = settings or get_settings()
    if not settings.kyc_digilocker_sandbox:
        return False
    mode = get_finprim_digilocker_environment()
    client_id = resolve_integration_field(settings, "kyc_tenant_client_id", mode).strip()
    client_secret = resolve_integration_field(settings, "kyc_tenant_client_secret", mode).strip()
    if mode == "test" and (not client_id or not client_secret):
        client_id = client_id or str(settings.kyc_tenant_client_id or "").strip()
        client_secret = client_secret or str(settings.kyc_tenant_client_secret or "").strip()
    return bool(client_id and client_secret)


def get_finprim_kyc_tenant_runtime() -> FinprimDigilockerRuntime:
    """Finprim KYC REST (kyc_requests) — Multiplus KYC_TENANT_* when sandbox."""
    settings = get_settings()
    mode = get_finprim_digilocker_environment()
    sandbox = settings.kyc_digilocker_sandbox
    digilocker = get_finprim_digilocker_runtime()
    if not sandbox:
        finprim = get_finprim_runtime()
        return FinprimDigilockerRuntime(
            environment=get_provider_environment("finprim"),
            base_url=finprim.base_url,
            token_base_url=finprim.base_url,
            tenant=finprim.tenant,
            client_id=finprim.client_id,
            client_secret=finprim.client_secret,
        )
    return _build_finprim_host_runtime(
        settings,
        mode,
        sandbox=True,
        base_field="kyc_tenant_base_url",
        token_field="kyc_tenant_token_base_url",
        tenant_field="kyc_tenant_tenant",
        client_id_field="kyc_tenant_client_id",
        client_secret_field="kyc_tenant_client_secret",
        fallback=digilocker,
    )


def get_finprim_digilocker_runtime() -> FinprimDigilockerRuntime:
    settings = get_settings()
    mode = get_finprim_digilocker_environment()
    sandbox = settings.kyc_digilocker_sandbox
    fallback: FinprimDigilockerRuntime | None = None
    if not sandbox:
        finprim = get_finprim_runtime()
        fallback = FinprimDigilockerRuntime(
            environment=mode,
            base_url=_resolve_fp_credential_for_digilocker(settings, "fp_base_url", mode) or finprim.base_url,
            token_base_url=_resolve_fp_credential_for_digilocker(settings, "fp_base_url", mode) or finprim.base_url,
            tenant=_resolve_fp_credential_for_digilocker(settings, "fp_tenant", mode) or finprim.tenant,
            client_id=_resolve_fp_credential_for_digilocker(settings, "fp_client_id", mode) or finprim.client_id,
            client_secret=_resolve_fp_credential_for_digilocker(settings, "fp_client_secret", mode)
            or finprim.client_secret,
        )
    return _build_finprim_host_runtime(
        settings,
        mode,
        sandbox=sandbox,
        base_field="digilocker_fp_base_url",
        token_field="digilocker_fp_token_base_url",
        tenant_field="digilocker_fp_tenant",
        client_id_field="digilocker_fp_client_id",
        client_secret_field="digilocker_fp_client_secret",
        fallback=fallback,
    )


def is_finprim_digilocker_live() -> bool:
    settings = get_settings()
    if settings.kyc_provider_mode == "disabled":
        return False
    if not settings.fp_enabled:
        return False
    return get_finprim_digilocker_runtime().configured


def digilocker_configuration_message() -> str:
    settings = get_settings()
    mode = get_finprim_digilocker_environment()
    runtime = get_finprim_digilocker_runtime()
    missing: list[str] = []
    if not settings.fp_enabled:
        missing.append("FP_ENABLED=true")
    if not runtime.base_url.strip():
        if settings.kyc_digilocker_sandbox:
            missing.append(f"DIGILOCKER_FP_BASE_URL (default {FINPRIM_DIGILOCKER_SANDBOX_BASE_URL})")
        else:
            suffix = "_TEST" if mode == "test" else ""
            missing.append(f"DIGILOCKER_FP_BASE_URL or FP_BASE_URL{suffix}")
    if not runtime.tenant.strip():
        missing.append("DIGILOCKER_FP_TENANT" + (" or FP_TENANT_TEST" if settings.kyc_digilocker_sandbox else ""))
    if not runtime.client_id.strip():
        missing.append("DIGILOCKER_FP_CLIENT_ID" + (" (sandbox test client)" if settings.kyc_digilocker_sandbox else ""))
    if not runtime.client_secret.strip():
        missing.append("DIGILOCKER_FP_CLIENT_SECRET" + (" (sandbox test secret)" if settings.kyc_digilocker_sandbox else ""))
    if settings.kyc_digilocker_sandbox:
        prefix = "DigiLocker sandbox (KYC_DIGILOCKER_SANDBOX=true) needs "
    else:
        prefix = "DigiLocker needs "
    if missing:
        return prefix + ", ".join(missing) + "."
    return prefix + "valid FinPrim credentials."


def kyc_poa_partner_sandbox_enabled() -> bool:
    settings = get_settings()
    return settings.kyc_digilocker_sandbox or settings.kyc_esign_sandbox


def cybrilla_poa_kyc_uses_sandbox_partner_credentials() -> bool:
    """True when POA kyc_forms OAuth is mfdptnr_*_test_* (s.finprim.com), not live POA with sandbox DigiLocker."""
    if not kyc_poa_partner_sandbox_enabled():
        return False
    settings = get_settings()
    mode = get_cybrilla_poa_kyc_environment()
    client_id, client_secret = _resolve_cybrilla_poa_client_pair(settings, mode)
    if not client_id or not client_secret:
        return False
    return _poa_client_is_sandbox_partner(client_id)


def get_cybrilla_poa_kyc_environment() -> IntegrationEnvironment:
    """POA kyc_forms + eSign URLs follow Cybrilla test creds when KYC sandbox flags are on."""
    if kyc_poa_partner_sandbox_enabled():
        return "test"
    return get_provider_environment("cybrilla")


def get_cybrilla_runtime() -> CybrillaRuntime:
    settings = get_settings()
    mode = get_provider_environment("cybrilla")
    return _cybrilla_runtime_for_mode(settings, mode)


def _resolve_cybrilla_poa_field(settings: Settings, field: str, mode: IntegrationEnvironment) -> str:
    """Resolve FP_POA_* for POA kyc_forms; dev may reuse unsuffixed vars when *_TEST is unset."""
    value = resolve_integration_field(settings, field, mode)
    if value.strip():
        return value
    # Local Multiplus-style dev: DigiLocker sandbox + same cybrillapoa FP_POA_* as bank preverify.
    if mode == "test" and settings.app_env == "development":
        return resolve_integration_field(settings, field, "live")
    return value


def _resolve_cybrilla_poa_client_pair(
    settings: Settings,
    mode: IntegrationEnvironment,
) -> tuple[str, str]:
    """OAuth client_id + client_secret must be a matching pair (never test id + live secret)."""
    if mode == "test":
        test_id = resolve_integration_field(settings, "fp_poa_client_id", "test").strip()
        test_secret = resolve_integration_field(settings, "fp_poa_client_secret", "test").strip()
        if test_id and test_secret:
            return test_id, test_secret
        return (
            _resolve_cybrilla_poa_field(settings, "fp_poa_client_id", "live").strip(),
            _resolve_cybrilla_poa_field(settings, "fp_poa_client_secret", "live").strip(),
        )
    return (
        _resolve_cybrilla_poa_field(settings, "fp_poa_client_id", mode).strip(),
        _resolve_cybrilla_poa_field(settings, "fp_poa_client_secret", mode).strip(),
    )


def get_cybrilla_poa_kyc_runtime() -> CybrillaRuntime:
    settings = get_settings()
    mode = get_cybrilla_poa_kyc_environment()
    return _cybrilla_poa_kyc_runtime_for_mode(settings, mode)


def _cybrilla_poa_host_is_finprim_sandbox(url: str) -> bool:
    return "s.finprim.com" in (url or "").strip().lower()


def _poa_client_is_sandbox_partner(client_id: str) -> bool:
    return "_test_" in str(client_id or "").lower()


def _normalize_cybrilla_poa_kyc_hosts(
    settings: Settings,
    *,
    token_base_url: str,
    base_url: str,
    auth_tenant: str,
    client_id: str,
    mode: IntegrationEnvironment,
) -> tuple[str, str]:
    """Partner POA: live OAuth on api.fintechprimitives.com; sandbox OAuth on s.finprim.com with mfdptnr_*_test_*."""
    token_base = token_base_url.strip()
    api_base = base_url.strip()
    live_token = _resolve_cybrilla_poa_field(settings, "fp_poa_token_base_url", "live").strip()
    live_api = _resolve_cybrilla_poa_field(settings, "fp_poa_base_url", "live").strip()
    sandbox_partner = mode == "test" and _poa_client_is_sandbox_partner(client_id)

    if sandbox_partner:
        if not token_base or not _cybrilla_poa_host_is_finprim_sandbox(token_base):
            token_base = "https://s.finprim.com"
    elif _cybrilla_poa_host_is_finprim_sandbox(token_base) or not token_base:
        token_base = live_token or "https://api.fintechprimitives.com"

    if _cybrilla_poa_host_is_finprim_sandbox(api_base) or not api_base:
        api_base = live_api or "https://api.cybrilla.com"
    return token_base, api_base


def _resolve_cybrilla_poa_api_tenant(
    settings: Settings,
    mode: IntegrationEnvironment,
    *,
    auth_tenant: str,
    client_id: str,
) -> str:
    explicit = _resolve_cybrilla_poa_field(settings, "fp_poa_api_tenant", mode).strip()
    if explicit:
        return explicit
    if mode == "test" and kyc_poa_partner_sandbox_enabled() and _poa_client_is_sandbox_partner(client_id):
        return "cybrillarta"
    return auth_tenant


def _cybrilla_poa_kyc_runtime_for_mode(
    settings: Settings,
    mode: IntegrationEnvironment,
) -> CybrillaRuntime:
    auth_tenant = _resolve_cybrilla_poa_field(settings, "fp_poa_auth_tenant", mode) or "cybrillapoa"
    client_id, client_secret = _resolve_cybrilla_poa_client_pair(settings, mode)
    token_base_url, base_url = _normalize_cybrilla_poa_kyc_hosts(
        settings,
        token_base_url=_resolve_cybrilla_poa_field(settings, "fp_poa_token_base_url", mode),
        base_url=_resolve_cybrilla_poa_field(settings, "fp_poa_base_url", mode),
        auth_tenant=auth_tenant,
        client_id=client_id,
        mode=mode,
    )
    api_tenant = _resolve_cybrilla_poa_api_tenant(
        settings, mode, auth_tenant=auth_tenant, client_id=client_id
    )
    return CybrillaRuntime(
        environment=mode,
        token_base_url=token_base_url,
        client_id=client_id,
        client_secret=client_secret,
        base_url=base_url,
        auth_tenant=auth_tenant,
        api_tenant=api_tenant,
    )


def _cybrilla_runtime_for_mode(settings: Settings, mode: IntegrationEnvironment) -> CybrillaRuntime:
    auth_tenant = _resolve_field(settings, "fp_poa_auth_tenant", mode) or "cybrillapoa"
    return CybrillaRuntime(
        environment=mode,
        token_base_url=_resolve_field(settings, "fp_poa_token_base_url", mode),
        client_id=_resolve_field(settings, "fp_poa_client_id", mode),
        client_secret=_resolve_field(settings, "fp_poa_client_secret", mode),
        base_url=_resolve_field(settings, "fp_poa_base_url", mode) or "https://api.cybrilla.com",
        auth_tenant=auth_tenant,
        api_tenant=_resolve_field(settings, "fp_poa_api_tenant", mode) or auth_tenant,
    )


def is_poa_kyc_provider_unavailable_error(exc: BaseException) -> bool:
    from app.infrastructure.kyc.fp_clients import FpClientError

    if not isinstance(exc, FpClientError):
        return False
    return exc.code in {"kyc_form_provider_unavailable", "poa_kyc_not_configured"}


def is_cybrilla_poa_kyc_live() -> bool:
    settings = get_settings()
    if settings.kyc_provider_mode == "disabled":
        return False
    return get_cybrilla_poa_kyc_runtime().configured


def cybrilla_poa_kyc_configuration_message() -> str:
    settings = get_settings()
    mode = get_cybrilla_poa_kyc_environment()
    runtime = get_cybrilla_poa_kyc_runtime()
    missing: list[str] = []
    if not runtime.resolved_token_base_url.strip() and not runtime.base_url.strip():
        missing.append(f"FP_POA_BASE_URL{('_TEST' if mode == 'test' else '')}")
    if not runtime.client_id.strip():
        missing.append(f"FP_POA_CLIENT_ID{('_TEST' if mode == 'test' else '')}")
    if not runtime.client_secret.strip():
        missing.append(f"FP_POA_CLIENT_SECRET{('_TEST' if mode == 'test' else '')}")
    if kyc_poa_partner_sandbox_enabled():
        prefix = "KYC sandbox (KYC_DIGILOCKER_SANDBOX / KYC_ESIGN_SANDBOX) needs POA test credentials: "
    else:
        prefix = "Cybrilla POA KYC forms need "
    if missing:
        return prefix + ", ".join(missing) + "."
    return prefix + "valid FP_POA_* credentials."


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
    if settings.kyc_provider_mode == "disabled":
        return False
    finprim = get_finprim_runtime()
    kyckart = get_kyckart_runtime()
    configured = bool(kyckart.configured and finprim.configured)
    if settings.kyc_provider_mode == "live":
        return configured
    return configured


def is_cybrilla_poa_live() -> bool:
    settings = get_settings()
    if settings.kyc_provider_mode == "disabled":
        return False
    configured = get_cybrilla_runtime().configured
    if settings.kyc_provider_mode == "live":
        return configured
    return configured


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
