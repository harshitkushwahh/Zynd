from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.application.investor.investor_provision_service import sync_investor_email_after_account_change
from app.infrastructure.persistence.investor_models import (
    InvestorEmailAddress,
    InvestorObjectSource,
    InvestorObjectSyncStatus,
    InvestorProfile,
    InvestorProfileStatus,
)
from app.infrastructure.persistence.mf_transaction_models import (
    MfInvestmentAccount,
    MfInvestmentAccountStatus,
)
from app.infrastructure.persistence.models import User


@pytest.mark.asyncio
async def test_email_change_creates_finprim_email_and_patches_existing_mfia(db_session) -> None:
    user = User(
        id=uuid4(),
        email="old@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()
    db_session.add(
        InvestorProfile(
            user_id=user.id,
            status=InvestorProfileStatus.active,
            external_profile_id="invp_8bc71abe640f4ef9a4f96a2b855cc6b5",
        )
    )
    db_session.add(
        InvestorEmailAddress(
            investor_profile_id=user.id,
            email="old@example.com",
            is_primary=True,
            source=InvestorObjectSource.user,
            sync_status=InvestorObjectSyncStatus.active,
            external_email_id="email_old",
            belongs_to="self",
        )
    )
    db_session.add(
        MfInvestmentAccount(
            user_id=user.id,
            fp_mfia_id="mfia_14bafabfbfbc423d9b54412dd577981b",
            status=MfInvestmentAccountStatus.active,
            metadata_={
                "folio_defaults_set": True,
                "folio_defaults": {
                    "communication_email_address": "email_old",
                    "payout_bank_account": "bac_1",
                    "nominee1": "relp_1",
                    "nominee1_allocation_percentage": 100,
                },
            },
        )
    )
    await db_session.flush()

    with (
        patch(
            "app.application.investor.investor_provision_service.create_email_address",
            new=AsyncMock(return_value={"id": "email_new", "raw": {"id": "email_new"}}),
        ) as create_email,
        patch(
            "app.application.mf.mf_folio_defaults_service.get_mf_investment_account",
            new=AsyncMock(
                return_value={
                    "id": "mfia_14bafabfbfbc423d9b54412dd577981b",
                    "folio_defaults": {
                        "communication_email_address": "email_old",
                        "payout_bank_account": "bac_1",
                        "nominee1": "relp_1",
                        "nominee1_allocation_percentage": 100,
                    },
                }
            ),
        ),
        patch(
            "app.application.mf.mf_folio_defaults_service.update_mf_investment_account",
            new=AsyncMock(return_value={"fp_mfia_id": "mfia_14bafabfbfbc423d9b54412dd577981b"}),
        ) as update_mfia,
        patch(
            "app.application.mf.mf_folio_defaults_service.create_mf_investment_account",
            new=AsyncMock(),
        ) as create_mfia,
    ):
        synced = await sync_investor_email_after_account_change(
            db_session,
            user_id=user.id,
            new_email="new@example.com",
        )

    assert synced is True
    create_email.assert_awaited_once()
    create_mfia.assert_not_awaited()
    update_mfia.assert_awaited_once()
    body = update_mfia.await_args.kwargs["body"]
    assert update_mfia.await_args.kwargs["fp_mfia_id"] == "mfia_14bafabfbfbc423d9b54412dd577981b"
    folio = body["folio_defaults"]
    assert folio["communication_email_address"] == "email_new"
    assert folio["payout_bank_account"] == "bac_1"
    assert folio["nominee1"] == "relp_1"
    assert folio["nominee1_allocation_percentage"] == 100
