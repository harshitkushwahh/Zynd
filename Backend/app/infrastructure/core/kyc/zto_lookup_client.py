from __future__ import annotations

from typing import Any

from app.core.config import Settings
from app.infrastructure.core.orchestrator import get_cybrilla_orchestrator


class OrchestratorZtoLookupClient:
    """Production Cybrilla lookup APIs via CybrillaHttpOrchestrator (cybrilla_zto channel)."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._orch = get_cybrilla_orchestrator()

    async def create_bank_lookup(
        self, *, source_ref_id: str, phone_number: str, consent: dict[str, Any]
    ) -> dict[str, Any]:
        body = {
            "source_ref_id": source_ref_id,
            "phone_number": phone_number,
            "consent": consent,
        }
        return await self._orch.request_zto("POST", "/v2/bank_account_lookups", json_body=body)

    async def get_bank_lookup(self, lookup_id: str) -> dict[str, Any]:
        return await self._orch.request_zto("GET", f"/v2/bank_account_lookups/{lookup_id}")

    async def create_customer_lookup(
        self, *, source_ref_id: str, phone_number: str, name: str, consent: dict[str, Any]
    ) -> dict[str, Any]:
        body = {
            "source_ref_id": source_ref_id,
            "phone_number": phone_number,
            "name": name,
            "consent": consent,
        }
        return await self._orch.request_zto("POST", "/v2/customer_data_lookups", json_body=body)

    async def get_customer_lookup(self, lookup_id: str) -> dict[str, Any]:
        return await self._orch.request_zto("GET", f"/v2/customer_data_lookups/{lookup_id}")
