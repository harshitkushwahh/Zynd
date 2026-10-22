from __future__ import annotations

from enum import Enum

from app.application.integrations.integration_runtime import (
    finprim_kyc_tenant_explicitly_configured,
    get_cybrilla_poa_kyc_runtime,
    get_cybrilla_runtime,
    get_finprim_digilocker_runtime,
    get_finprim_kyc_tenant_runtime,
    get_finprim_runtime,
)
from app.infrastructure.persistence.provider_log_models import ProviderLogSource


class CybrillaChannel(str, Enum):
    finprim_mf = "finprim_mf"
    finprim_kyc = "finprim_kyc"
    finprim_digilocker = "finprim_digilocker"
    finprim_kyc_tenant = "finprim_kyc_tenant"
    cybrilla_poa = "cybrilla_poa"
    cybrilla_poa_kyc_forms = "cybrilla_poa_kyc_forms"
    cybrilla_zto = "cybrilla_zto"


def is_finprim_kyc_request_path(path: str) -> bool:
    return path.startswith("/v2/kyc_requests")


def is_finprim_identity_document_path(path: str) -> bool:
    return path.startswith("/v2/identity_documents")


def is_finprim_kyc_files_path(path: str) -> bool:
    return path == "/files" or path.startswith("/files/")


def is_finprim_digilocker_path(path: str) -> bool:
    return (
        is_finprim_kyc_request_path(path)
        or is_finprim_identity_document_path(path)
        or path.startswith("/v2/esigns")
        or is_finprim_kyc_files_path(path)
    )


def is_finprim_kyc_tenant_path(path: str) -> bool:
    return (
        is_finprim_kyc_request_path(path)
        or path.startswith("/v2/esigns")
        or is_finprim_kyc_files_path(path)
    )


def use_kyc_tenant_runtime(path: str) -> bool:
    if not is_finprim_kyc_tenant_path(path):
        return False
    return finprim_kyc_tenant_explicitly_configured()


def is_poa_kyc_forms_path(path: str) -> bool:
    return path.startswith("/poa/kyc_forms")


def resolve_channel(*, use_poa: bool, path: str) -> CybrillaChannel:
    if use_poa:
        if is_poa_kyc_forms_path(path):
            return CybrillaChannel.cybrilla_poa_kyc_forms
        return CybrillaChannel.cybrilla_poa
    if use_kyc_tenant_runtime(path):
        return CybrillaChannel.finprim_kyc_tenant
    if is_finprim_digilocker_path(path):
        return CybrillaChannel.finprim_digilocker
    return CybrillaChannel.finprim_kyc


def channel_base_and_tenant(channel: CybrillaChannel) -> tuple[str, str]:
    if channel == CybrillaChannel.cybrilla_zto:
        from app.application.integrations.integration_runtime import get_zto_runtime

        runtime = get_zto_runtime()
        tenant = runtime.auth_tenant.strip() or "cybrillapoa"
        return runtime.base_url, tenant
    if channel == CybrillaChannel.finprim_mf:
        runtime = get_finprim_runtime()
        return runtime.base_url, runtime.tenant
    if channel in {CybrillaChannel.cybrilla_poa, CybrillaChannel.cybrilla_poa_kyc_forms}:
        runtime = (
            get_cybrilla_poa_kyc_runtime()
            if channel == CybrillaChannel.cybrilla_poa_kyc_forms
            else get_cybrilla_runtime()
        )
        return runtime.base_url, runtime.resolved_api_tenant
    if channel == CybrillaChannel.finprim_kyc_tenant:
        runtime = get_finprim_kyc_tenant_runtime()
        return runtime.base_url, runtime.tenant
    if channel == CybrillaChannel.finprim_digilocker:
        runtime = get_finprim_digilocker_runtime()
        return runtime.base_url, runtime.tenant
    runtime = get_finprim_runtime()
    return runtime.base_url, runtime.tenant


def channel_provider_log_source(channel: CybrillaChannel) -> ProviderLogSource:
    if channel in {
        CybrillaChannel.cybrilla_poa,
        CybrillaChannel.cybrilla_poa_kyc_forms,
        CybrillaChannel.cybrilla_zto,
    }:
        return ProviderLogSource.cybrilla
    return ProviderLogSource.fintech_primitive


def channel_uses_poa_terminal_log(channel: CybrillaChannel) -> bool:
    return channel in {
        CybrillaChannel.cybrilla_poa,
        CybrillaChannel.cybrilla_poa_kyc_forms,
        CybrillaChannel.cybrilla_zto,
    }


def fp_runtime(*, use_poa: bool, path: str = "") -> tuple[str, str]:
    """Legacy helper for tests and callers resolving base URL + x-tenant-id."""
    return channel_base_and_tenant(resolve_channel(use_poa=use_poa, path=path))
