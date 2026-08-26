from __future__ import annotations

from decimal import Decimal
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.application.mf.mf_order_errors import MfOrderError
from app.application.mf.mf_sip_plan_mandate_switch_service import (
    evaluate_bank_switch_eligibility,
    switch_sip_plan_mandate,
)
from app.infrastructure.persistence.investor_models import (
    InvestorBankAccount,
    InvestorBankVerificationStatus,
    InvestorObjectSource,
    InvestorObjectSyncStatus,
)
from app.infrastructure.persistence.mf_models import FundAmc, MutualFund, Product, ProductType
from app.infrastructure.persistence.mf_transaction_models import (
    MfMandate,
    MfMandateStatus,
    MfSipPlan,
    MfSipPlanStatus,
)
from app.infrastructure.persistence.models import KycJourneyState, KycOverallStatus, User, UserKycStatus


async def _seed_switch_fixture(db_session):
    user = User(
        id=uuid4(),
        email=f"sip-switch-{uuid4()}@example.com",
        phone="+919876543210",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()
    db_session.add(UserKycStatus(user_id=user.id, overall_status=KycOverallStatus.completed))
    db_session.add(
        KycJourneyState(
            user_id=user.id,
            pan_draft_json={"panNumber": "ABCDE1234F", "fullName": "Test User"},
        )
    )
    primary = InvestorBankAccount(
        investor_profile_id=user.id,
        is_primary=True,
        account_type="savings",
        account_number_last4="9725",
        ifsc_code="KKBK0005915",
        primary_account_holder_name="Test User",
        verification_status=InvestorBankVerificationStatus.verified,
        source=InvestorObjectSource.kyc,
        sync_status=InvestorObjectSyncStatus.active,
        external_bank_account_id="bac_primary",
        external_old_id=101,
    )
    secondary = InvestorBankAccount(
        investor_profile_id=user.id,
        is_primary=False,
        account_type="savings",
        account_number_last4="2169",
        ifsc_code="STCB0000065",
        primary_account_holder_name="Test User",
        verification_status=InvestorBankVerificationStatus.verified,
        source=InvestorObjectSource.user,
        sync_status=InvestorObjectSyncStatus.active,
        external_bank_account_id="bac_secondary",
        external_old_id=202,
    )
    db_session.add_all([primary, secondary])
    await db_session.flush()

    current_mandate = MfMandate(
        user_id=user.id,
        investor_bank_account_id=primary.id,
        bank_account_old_id=int(primary.external_old_id),
        status=MfMandateStatus.approved,
        mandate_limit=5000,
        idempotency_key=str(uuid4()),
        fp_mandate_id=9001,
    )
    target_mandate = MfMandate(
        user_id=user.id,
        investor_bank_account_id=secondary.id,
        bank_account_old_id=int(secondary.external_old_id),
        status=MfMandateStatus.approved,
        mandate_limit=5000,
        idempotency_key=str(uuid4()),
        fp_mandate_id=9002,
    )
    db_session.add_all([current_mandate, target_mandate])
    await db_session.flush()

    amc = FundAmc(name="Test AMC", slug=f"test-amc-{uuid4().hex[:8]}")
    db_session.add(amc)
    await db_session.flush()
    product = Product(code=f"P{uuid4().hex[:8]}", name="Test Fund", product_type=ProductType.mutual_fund)
    db_session.add(product)
    await db_session.flush()
    fund = MutualFund(
        amc_id=amc.id,
        isin_growth=f"INF{uuid4().hex[:10].upper()}",
        scheme_name="Test Scheme",
        product_id=product.id,
    )
    db_session.add(fund)
    await db_session.flush()

    plan = MfSipPlan(
        user_id=user.id,
        product_id=product.id,
        fund_id=fund.id,
        mf_mandate_id=current_mandate.id,
        amount_inr=Decimal("1000"),
        frequency="monthly",
        installment_day=10,
        number_of_installments=120,
        status=MfSipPlanStatus.active,
        fp_plan_id="mfpp_test_plan",
        idempotency_key=str(uuid4()),
    )
    db_session.add(plan)
    await db_session.flush()
    return user, primary, secondary, current_mandate, target_mandate, plan


@pytest.mark.asyncio
async def test_evaluate_bank_switch_eligibility_for_active_plan(db_session) -> None:
    _user, _primary, _secondary, current_mandate, _target_mandate, plan = await _seed_switch_fixture(db_session)

    result = await evaluate_bank_switch_eligibility(db_session, plan, mandate=current_mandate)

    assert result["eligible"] is True
    assert result["used"] is False
    assert result["in_progress"] is False


@pytest.mark.asyncio
async def test_switch_sip_plan_mandate_rejects_same_bank(db_session) -> None:
    user, primary, _secondary, current_mandate, _target_mandate, plan = await _seed_switch_fixture(db_session)

    with pytest.raises(MfOrderError) as exc:
        await switch_sip_plan_mandate(
            db_session,
            plan,
            user_id=user.id,
            bank_account_id=primary.id,
            mandate_type="upi",
            idempotency_key=str(uuid4()),
        )

    assert exc.value.code == "same_debit_bank"


@pytest.mark.asyncio
async def test_switch_sip_plan_mandate_completes_with_approved_target_mandate(db_session) -> None:
    user, _primary, secondary, current_mandate, _target_mandate, plan = await _seed_switch_fixture(db_session)

    with (
        patch(
            "app.application.mf.mf_sip_plan_mandate_switch_service.create_mf_plan_modification_instruction",
            new=AsyncMock(
                return_value={"id": "mpmi_test", "state": "created"},
            ),
        ),
        patch(
            "app.application.mf.mf_sip_plan_mandate_switch_service.get_mf_plan_modification_instruction",
            new=AsyncMock(
                return_value={"id": "mpmi_test", "state": "completed"},
            ),
        ),
        patch(
            "app.application.mf.mf_mandate_service.create_mandate",
            new=AsyncMock(return_value={"id": 9002}),
        ),
    ):
        updated = await switch_sip_plan_mandate(
            db_session,
            plan,
            user_id=user.id,
            bank_account_id=secondary.id,
            mandate_type="upi",
            idempotency_key=str(uuid4()),
        )

    assert updated.mf_mandate_id != current_mandate.id
    assert updated.metadata_["mandate_switch"]["used"] is True
    assert updated.metadata_["mandate_switch"].get("pending") is None


@pytest.mark.asyncio
async def test_switch_sip_plan_mandate_rejects_when_already_used(db_session) -> None:
    user, _primary, secondary, current_mandate, _target_mandate, plan = await _seed_switch_fixture(db_session)
    plan.metadata_ = {"mandate_switch": {"used": True}}
    await db_session.flush()

    with pytest.raises(MfOrderError) as exc:
        await switch_sip_plan_mandate(
            db_session,
            plan,
            user_id=user.id,
            bank_account_id=secondary.id,
            mandate_type="upi",
            idempotency_key=str(uuid4()),
        )

    assert exc.value.code == "bank_switch_not_eligible"
