from __future__ import annotations

import pytest

from app.application.kyc.zto.constants import FETCH_SUCCESS, FETCH_TIMEOUT
from app.application.kyc.zto.flow_service import _poll_lookup
from app.core.config import Settings


class _FakeZtoClient:
    def __init__(self, statuses: list[str]) -> None:
        self._statuses = list(statuses)
        self.calls = 0

    async def get_bank_lookup(self, lookup_id: str) -> dict:
        self.calls += 1
        idx = min(self.calls - 1, len(self._statuses) - 1)
        return {"id": lookup_id, "status": self._statuses[idx]}


@pytest.mark.asyncio
async def test_poll_lookup_treats_successful_as_terminal_success() -> None:
    settings = Settings(zto_max_poll_attempts=5, zto_poll_interval_ms=0)
    client = _FakeZtoClient(["pending", "pending", "successful"])
    status, body = await _poll_lookup(
        client,
        kind="bank",
        create_response={"id": "bal_test", "status": "pending"},
        settings=settings,
    )
    assert status == FETCH_SUCCESS
    assert body["status"] == "successful"
    assert client.calls == 3


@pytest.mark.asyncio
async def test_poll_lookup_times_out_when_stays_pending() -> None:
    settings = Settings(zto_max_poll_attempts=2, zto_poll_interval_ms=0)
    client = _FakeZtoClient(["pending", "pending", "pending"])
    status, _ = await _poll_lookup(
        client,
        kind="bank",
        create_response={"id": "bal_test", "status": "pending"},
        settings=settings,
    )
    assert status == FETCH_TIMEOUT
    assert client.calls == 2
