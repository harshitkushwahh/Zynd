from __future__ import annotations

from typing import Any, Protocol

from app.application.integrations.integration_runtime import is_zto_production_live
from app.application.kyc.zto.sandbox import SandboxZtoLookupClient
from app.core.config import Settings, get_settings
from app.infrastructure.core.kyc.zto_lookup_client import OrchestratorZtoLookupClient


class ZtoLookupClient(Protocol):
    async def create_bank_lookup(
        self, *, source_ref_id: str, phone_number: str, consent: dict[str, Any]
    ) -> dict[str, Any]: ...

    async def get_bank_lookup(self, lookup_id: str) -> dict[str, Any]: ...

    async def create_customer_lookup(
        self, *, source_ref_id: str, phone_number: str, name: str, consent: dict[str, Any]
    ) -> dict[str, Any]: ...

    async def get_customer_lookup(self, lookup_id: str) -> dict[str, Any]: ...


def get_zto_lookup_client(settings: Settings | None = None) -> ZtoLookupClient:
    settings = settings or get_settings()
    if settings.zto_mode == "sandbox":
        return SandboxZtoLookupClient()
    if not is_zto_production_live():
        raise NotImplementedError(
            "ZTO_MODE=production requires ZTO_ENABLED, ZTO_CLIENT_ID, ZTO_CLIENT_SECRET, "
            "ZTO_TOKEN_BASE_URL (or ZTO_API_BASE_URL), and ZTO_AUTH_TENANT."
        )
    return OrchestratorZtoLookupClient(settings)
