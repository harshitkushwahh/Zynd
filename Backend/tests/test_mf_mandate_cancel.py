from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.application.mf.mf_mandate_service import cancel_user_mandate, refresh_mandate_status_from_fp
from app.application.mf.mf_order_errors import MfOrderError
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.persistence.mf_transaction_models import MfMandate, MfMandateStatus
from app.infrastructure.persistence.models import User


@pytest.mark.asyncio
async def test_cancel_user_mandate_marks_cancelled_when_fp_already_cancelled(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"mandate-cancel-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()

    mandate = MfMandate(
        user_id=user.id,
        bank_account_old_id=101,
        status=MfMandateStatus.approved,
        mandate_limit=5000,
        idempotency_key=str(uuid4()),
        fp_mandate_id=626,
    )
    db_session.add(mandate)
    await db_session.flush()

    with patch(
        "app.application.mf.mf_mandate_service.get_mandate",
        new=AsyncMock(return_value={"id": 626, "mandate_status": "CANCELLED"}),
    ), patch(
        "app.application.mf.mf_mandate_service.cancel_mandate",
        new=AsyncMock(),
    ) as cancel_mock:
        result = await cancel_user_mandate(db_session, mandate)

    assert result.status == MfMandateStatus.cancelled
    cancel_mock.assert_not_called()


@pytest.mark.asyncio
async def test_cancel_user_mandate_treats_cybrillapoa_error_as_cancelled(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"mandate-cybrilla-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()

    mandate = MfMandate(
        user_id=user.id,
        bank_account_old_id=101,
        status=MfMandateStatus.approved,
        mandate_limit=5000,
        idempotency_key=str(uuid4()),
        fp_mandate_id=627,
    )
    db_session.add(mandate)
    await db_session.flush()

    with patch(
        "app.application.mf.mf_mandate_service.get_mandate",
        new=AsyncMock(return_value={"id": 627, "mandate_status": "APPROVED"}),
    ), patch(
        "app.application.mf.mf_mandate_service.cancel_mandate",
        new=AsyncMock(
            side_effect=FpClientError(
                "Operation not allowed for CYBRILLAPOA provider",
                "fp_client_error",
                400,
            )
        ),
    ):
        result = await cancel_user_mandate(db_session, mandate)

    assert result.status == MfMandateStatus.cancelled


@pytest.mark.asyncio
async def test_refresh_mandate_status_from_fp_updates_approved_to_cancelled(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"mandate-sync-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()

    mandate = MfMandate(
        user_id=user.id,
        bank_account_old_id=101,
        status=MfMandateStatus.approved,
        mandate_limit=5000,
        idempotency_key=str(uuid4()),
        fp_mandate_id=638,
    )
    db_session.add(mandate)
    await db_session.flush()

    with patch(
        "app.application.mf.mf_mandate_service.get_mandate",
        new=AsyncMock(return_value={"id": 638, "mandate_status": "CANCELLED"}),
    ):
        changed = await refresh_mandate_status_from_fp(db_session, mandate, force=True)

    assert changed is True
    assert mandate.status == MfMandateStatus.cancelled


@pytest.mark.asyncio
async def test_cancel_user_mandate_raises_when_fp_rejects_and_still_active(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"mandate-reject-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()

    mandate = MfMandate(
        user_id=user.id,
        bank_account_old_id=101,
        status=MfMandateStatus.approved,
        mandate_limit=5000,
        idempotency_key=str(uuid4()),
        fp_mandate_id=628,
    )
    db_session.add(mandate)
    await db_session.flush()

    with patch(
        "app.application.mf.mf_mandate_service.get_mandate",
        new=AsyncMock(return_value={"id": 628, "mandate_status": "APPROVED"}),
    ), patch(
        "app.application.mf.mf_mandate_service.cancel_mandate",
        new=AsyncMock(
            side_effect=FpClientError("Mandate cannot be cancelled right now", "fp_client_error", 409)
        ),
    ):
        with pytest.raises(MfOrderError):
            await cancel_user_mandate(db_session, mandate)
