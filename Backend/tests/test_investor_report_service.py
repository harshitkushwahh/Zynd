from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.investor_report_service import generate_investor_report
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.persistence.mf_transaction_models import MfGeneratedReportKind
from app.infrastructure.persistence.models import User


class MemoryStorage:
    def __init__(self) -> None:
        self.files: dict[tuple[str, str], bytes] = {}

    def write_bytes(self, *, bucket: str, storage_key: str, content: bytes, encrypt_at_rest: bool) -> None:
        _ = encrypt_at_rest
        self.files[(bucket, storage_key)] = content

    def read_bytes(self, *, bucket: str, storage_key: str, decrypt_at_rest: bool) -> bytes:
        _ = decrypt_at_rest
        return self.files[(bucket, storage_key)]

    def exists(self, *, bucket: str, storage_key: str) -> bool:
        return (bucket, storage_key) in self.files


async def _seed_user(db_session: AsyncSession) -> User:
    user = User(
        id=uuid4(),
        email=f"reports-{uuid4()}@example.com",
        first_name="Ada",
        last_name="Lovelace",
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.mark.asyncio
async def test_empty_finprim_payload_completes_pdf(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = await _seed_user(db_session)
    storage = MemoryStorage()
    monkeypatch.setattr(
        "app.application.mf.investor_report_service.get_document_storage",
        lambda settings=None: storage,
    )
    async def _ready(db, *, user_id):
        return 12, "mfia_test"

    monkeypatch.setattr("app.application.mf.investor_report_service._resolve_mfia", _ready)

    async def _empty_holdings(**kwargs):
        return {"folios": []}

    async def _empty_folios(**kwargs):
        return {"data": []}

    async def _empty_txns(**kwargs):
        return {"data": []}

    monkeypatch.setattr("app.application.mf.investor_report_service.get_holdings_report", _empty_holdings)
    monkeypatch.setattr("app.application.mf.investor_report_service.list_mf_folios", _empty_folios)
    monkeypatch.setattr("app.application.mf.investor_report_service.list_mf_transactions", _empty_txns)

    payload = await generate_investor_report(
        db_session,
        user=user,
        kind=MfGeneratedReportKind.account_statement,
    )
    assert payload["status"] == "completed"
    assert payload["downloadable"] is True
    assert any(content.startswith(b"%PDF") for content in storage.files.values())


@pytest.mark.asyncio
async def test_finprim_error_marks_failed(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = await _seed_user(db_session)
    storage = MemoryStorage()
    monkeypatch.setattr(
        "app.application.mf.investor_report_service.get_document_storage",
        lambda settings=None: storage,
    )

    async def _ready(db, *, user_id):
        return 12, "mfia_test"

    async def _boom(**kwargs):
        raise FpClientError("upstream unavailable")

    monkeypatch.setattr("app.application.mf.investor_report_service._resolve_mfia", _ready)
    monkeypatch.setattr("app.application.mf.investor_report_service.get_holdings_report", _boom)

    payload = await generate_investor_report(
        db_session,
        user=user,
        kind=MfGeneratedReportKind.capital_gains,
    )
    assert payload["status"] == "failed"
    assert payload["downloadable"] is False
    assert storage.files == {}
