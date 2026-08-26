from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_order_service import get_or_create_mf_investment_account
from app.infrastructure.persistence.mf_transaction_models import MfInvestmentAccountStatus
from app.infrastructure.persistence.models import User


@pytest.mark.asyncio
async def test_get_or_create_mf_investment_account_is_idempotent(db_session: AsyncSession) -> None:
    user = User(
        id=uuid4(),
        email=f"mfia-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()

    first = await get_or_create_mf_investment_account(db_session, user_id=user.id)
    second = await get_or_create_mf_investment_account(db_session, user_id=user.id)

    assert first.id == second.id
    assert first.user_id == user.id
    assert first.status == MfInvestmentAccountStatus.pending
