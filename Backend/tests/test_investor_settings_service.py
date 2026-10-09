from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.application.investor.investor_provision_mapper import build_investor_profile_patch_payload
from app.application.investor.investor_settings_service import (
    add_investor_nominee,
    get_investor_settings_state,
    update_investor_profile_settings,
)
from app.application.kyc.errors import KycError
from app.infrastructure.persistence.investor_models import (
    InvestorObjectSource,
    InvestorObjectSyncStatus,
    InvestorProfile,
    InvestorProfileStatus,
    InvestorRelatedParty,
)
from app.infrastructure.persistence.mf_transaction_models import (
    MfInvestmentAccount,
    MfInvestmentAccountStatus,
)
from app.infrastructure.persistence.models import KycJourneyState, KycOverallStatus, User, UserKycStatus


def test_build_investor_profile_patch_payload_only_mutable_fields() -> None:
    payload = build_investor_profile_patch_payload(
        profile_id="invp_abc",
        income_slab="above_1lakh_upto_5lakh",
        pep_details="not_applicable",
    )
    assert payload == {
        "id": "invp_abc",
        "income_slab": "above_1lakh_upto_5lakh",
        "pep_details": "not_applicable",
    }
    assert "name" not in payload
    assert "pan" not in payload
    assert "occupation" not in payload
    assert "gender" not in payload


async def _seed_user(db_session, *, overall: KycOverallStatus) -> User:
    user = User(
        id=uuid4(),
        email=f"settings-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        password_hash="hash",
    )
    db_session.add(user)
    await db_session.flush()
    db_session.add(UserKycStatus(user_id=user.id, overall_status=overall))
    db_session.add(
        KycJourneyState(
            user_id=user.id,
            personal_draft_json={
                "gender": "male",
                "occupation": "business",
                "incomeSlab": "upto_1lakh",
                "pepExposed": "not_applicable",
                "maritalStatus": "married",
                "spouseName": "Carmela",
                "placeOfBirth": "Indore",
            },
            nominee_draft_json=[],
        )
    )
    await db_session.flush()
    return user


async def _seed_profile_and_mfia(db_session, user: User) -> None:
    db_session.add(
        InvestorProfile(
            user_id=user.id,
            status=InvestorProfileStatus.active,
            external_profile_id="invp_9abd706565144b83947f4b498bc95e98",
        )
    )
    db_session.add(
        MfInvestmentAccount(
            user_id=user.id,
            fp_mfia_id="mfia_14bafabfbfbc423d9b54412dd577981b",
            status=MfInvestmentAccountStatus.active,
            metadata_={"folio_defaults_set": True},
        )
    )
    await db_session.flush()


@pytest.mark.asyncio
async def test_settings_state_requires_completed_kyc_and_invp_mfia(db_session) -> None:
    user = await _seed_user(db_session, overall=KycOverallStatus.submitted)
    state = await get_investor_settings_state(db_session, user_id=user.id)
    assert state["can_edit_profile"] is False
    assert state["can_add_nominee"] is False

    user = await _seed_user(db_session, overall=KycOverallStatus.completed)
    await _seed_profile_and_mfia(db_session, user)
    state = await get_investor_settings_state(db_session, user_id=user.id)
    assert state["can_edit_profile"] is True
    assert state["can_add_nominee"] is True
    assert state["investor_profile_id"] == "invp_9abd706565144b83947f4b498bc95e98"


@pytest.mark.asyncio
async def test_update_investor_profile_settings_patches_finprim(db_session) -> None:
    user = await _seed_user(db_session, overall=KycOverallStatus.completed)
    await _seed_profile_and_mfia(db_session, user)

    with patch(
        "app.application.investor.investor_settings_service.patch_investor_profile",
        new=AsyncMock(return_value={"id": "invp_9abd706565144b83947f4b498bc95e98", "raw": {"income_slab": "above_1cr"}}),
    ) as patch_fp:
        state = await update_investor_profile_settings(
            db_session,
            user=user,
            income_slab="above_1cr",
            pep_details="pep_related",
            marital_status="married",
            spouse_name="Carmela Soprano",
        )

    patch_fp.assert_awaited_once()
    body = patch_fp.await_args.args[0]
    assert body["id"].startswith("invp_")
    assert body["income_slab"] == "above_1cr"
    assert body["pep_details"] == "pep_related"
    assert "name" not in body
    assert "pan" not in body
    journey = await db_session.get(KycJourneyState, user.id)
    assert journey.personal_draft_json["incomeSlab"] == "above_1cr"
    assert journey.personal_draft_json["pepExposed"] == "pep_related"
    assert state["can_edit_profile"] is True


@pytest.mark.asyncio
async def test_update_investor_profile_rejected_when_kyc_not_completed(db_session) -> None:
    user = await _seed_user(db_session, overall=KycOverallStatus.submitted)
    with pytest.raises(KycError) as exc:
        await update_investor_profile_settings(db_session, user=user, income_slab="above_1cr")
    assert exc.value.code == "kyc_not_verified"


@pytest.mark.asyncio
async def test_add_investor_nominee_creates_related_party_and_links_mfia(db_session) -> None:
    user = await _seed_user(db_session, overall=KycOverallStatus.completed)
    await _seed_profile_and_mfia(db_session, user)
    nominee = {
        "id": "nom_1",
        "type": "individual",
        "core": {
            "fullName": "Ram Sharma",
            "relationship": "son",
            "sourceOfWealth": "salary",
            "dateOfBirth": "2002-02-29",
            "sharePercent": "100",
        },
        "identity": {"documentType": "pan", "documentNumber": "ASFPJ2398R"},
        "contact": {"email": "ram@gmail.com", "mobile": "9092390923"},
        "address": {
            "line1": "213 JP Nagar",
            "line2": "",
            "city": "Bengaluru",
            "pincode": "560102",
            "country": "in",
        },
    }

    with (
        patch(
            "app.application.investor.investor_provision_service.create_related_party",
            new=AsyncMock(return_value={"id": "relp_3c1f0c0b0f15474e90baf9f32692c6eb", "raw": {"id": "relp_test"}}),
        ),
        patch(
            "app.application.investor.investor_provision_service.patch_related_party",
            new=AsyncMock(return_value={"id": "relp_3c1f0c0b0f15474e90baf9f32692c6eb", "raw": {}}),
        ),
        patch(
            "app.application.mf.mf_folio_defaults_service.get_mf_investment_account",
            new=AsyncMock(return_value={"folio_defaults": {}}),
        ),
        patch(
            "app.application.mf.mf_folio_defaults_service.update_mf_investment_account",
            new=AsyncMock(return_value={"id": "mfia_14bafabfbfbc423d9b54412dd577981b"}),
        ) as update_mfia,
    ):
        state = await add_investor_nominee(db_session, user=user, nominee=nominee)

    update_mfia.assert_awaited_once()
    folio_defaults = update_mfia.await_args.kwargs["body"]["folio_defaults"]
    assert folio_defaults["nominee1"] == "relp_3c1f0c0b0f15474e90baf9f32692c6eb"
    assert folio_defaults["nominee1_allocation_percentage"] == 100
    assert state["nominee_count"] == 1
    assert state["can_add_nominee"] is True


@pytest.mark.asyncio
async def test_add_investor_nominees_requires_full_allocation(db_session) -> None:
    user = await _seed_user(db_session, overall=KycOverallStatus.completed)
    await _seed_profile_and_mfia(db_session, user)
    first = {
        "id": "nom_1",
        "type": "individual",
        "core": {
            "fullName": "Ram Sharma",
            "relationship": "son",
            "sourceOfWealth": "salary",
            "dateOfBirth": "2002-02-29",
            "sharePercent": "50",
        },
        "identity": {"documentType": "pan", "documentNumber": "ASFPJ2398R"},
        "contact": {"email": "ram@gmail.com", "mobile": "9092390923"},
        "address": {"line1": "213 JP Nagar", "line2": "", "city": "Bengaluru", "pincode": "560102", "country": "in"},
    }

    with pytest.raises(KycError) as exc:
        await add_investor_nominee(db_session, user=user, nominee=first)
    assert exc.value.code == "nominee_share_invalid"

    second = {
        **first,
        "id": "nom_2",
        "core": {**first["core"], "fullName": "Sita Sharma", "sharePercent": "50"},
    }
    with (
        patch(
            "app.application.investor.investor_provision_service.create_related_party",
            new=AsyncMock(
                side_effect=[
                    {"id": "relp_a", "raw": {"id": "relp_a"}},
                    {"id": "relp_b", "raw": {"id": "relp_b"}},
                ]
            ),
        ),
        patch(
            "app.application.investor.investor_provision_service.patch_related_party",
            new=AsyncMock(return_value={"id": "relp_a", "raw": {}}),
        ),
        patch(
            "app.application.mf.mf_folio_defaults_service.get_mf_investment_account",
            new=AsyncMock(return_value={"folio_defaults": {}}),
        ),
        patch(
            "app.application.mf.mf_folio_defaults_service.update_mf_investment_account",
            new=AsyncMock(return_value={"id": "mfia_14bafabfbfbc423d9b54412dd577981b"}),
        ) as update_mfia,
    ):
        state = await add_investor_nominee(db_session, user=user, nominees=[first, second])

    folio_defaults = update_mfia.await_args.kwargs["body"]["folio_defaults"]
    assert folio_defaults["nominee1"] == "relp_a"
    assert folio_defaults["nominee2"] == "relp_b"
    assert folio_defaults["nominee3"] is None
    assert folio_defaults["nominee1_allocation_percentage"] == 50
    assert folio_defaults["nominee2_allocation_percentage"] == 50
    assert state["nominee_count"] == 2


def _nominee_draft(*, nominee_id: str, name: str, share: str) -> dict:
    return {
        "id": nominee_id,
        "type": "individual",
        "core": {
            "fullName": name,
            "relationship": "son",
            "sourceOfWealth": "salary",
            "dateOfBirth": "2002-02-29",
            "sharePercent": share,
        },
        "identity": {"documentType": "pan", "documentNumber": "ASFPJ2398R"},
        "contact": {"email": "ram@gmail.com", "mobile": "9092390923"},
        "address": {"line1": "213 JP Nagar", "line2": "", "city": "Bengaluru", "pincode": "560102", "country": "in"},
    }


async def _seed_related_party(
    db_session,
    user: User,
    *,
    local_id: str,
    name: str,
    related_party_id: str,
    share: int,
) -> None:
    db_session.add(
        InvestorRelatedParty(
            investor_profile_id=user.id,
            source=InvestorObjectSource.user,
            sync_status=InvestorObjectSyncStatus.active,
            local_nominee_id=local_id,
            name=name,
            party_relationship="son",
            share_percent=share,
            external_related_party_id=related_party_id,
        )
    )
    await db_session.flush()


@pytest.mark.asyncio
async def test_add_investor_nominee_resplits_existing_100_to_two(db_session) -> None:
    user = await _seed_user(db_session, overall=KycOverallStatus.completed)
    await _seed_profile_and_mfia(db_session, user)
    first = _nominee_draft(nominee_id="nom_1", name="Ram Sharma", share="100")
    journey = await db_session.get(KycJourneyState, user.id)
    journey.nominee_draft_json = [first]
    await _seed_related_party(
        db_session,
        user,
        local_id="nom_1",
        name="Ram Sharma",
        related_party_id="relp_existing123",
        share=100,
    )
    second = _nominee_draft(nominee_id="nom_2", name="Sita Sharma", share="50")
    first_split = _nominee_draft(nominee_id="nom_1", name="Ram Sharma", share="50")

    with (
        patch(
            "app.application.investor.investor_provision_service.create_related_party",
            new=AsyncMock(return_value={"id": "relp_new456", "raw": {"id": "relp_new456"}}),
        ) as create_relp,
        patch(
            "app.application.investor.investor_provision_service.patch_related_party",
            new=AsyncMock(return_value={"id": "relp_new456", "raw": {}}),
        ),
        patch(
            "app.application.mf.mf_folio_defaults_service.get_mf_investment_account",
            new=AsyncMock(return_value={"folio_defaults": {}}),
        ),
        patch(
            "app.application.mf.mf_folio_defaults_service.update_mf_investment_account",
            new=AsyncMock(return_value={"id": "mfia_14bafabfbfbc423d9b54412dd577981b"}),
        ) as update_mfia,
    ):
        state = await add_investor_nominee(
            db_session,
            user=user,
            nominees=[first_split, second],
        )

    create_relp.assert_awaited_once()
    folio_defaults = update_mfia.await_args.kwargs["body"]["folio_defaults"]
    assert folio_defaults["nominee1"] == "relp_existing123"
    assert folio_defaults["nominee1_allocation_percentage"] == 50
    assert folio_defaults["nominee2"] == "relp_new456"
    assert folio_defaults["nominee2_allocation_percentage"] == 50
    assert folio_defaults["nominee3"] is None
    assert folio_defaults["nominee3_allocation_percentage"] is None
    assert state["nominee_count"] == 2


@pytest.mark.asyncio
async def test_add_investor_nominee_clears_unused_slot_when_collapsing_to_one(db_session) -> None:
    user = await _seed_user(db_session, overall=KycOverallStatus.completed)
    await _seed_profile_and_mfia(db_session, user)
    first = _nominee_draft(nominee_id="nom_1", name="Ram Sharma", share="50")
    second = _nominee_draft(nominee_id="nom_2", name="Sita Sharma", share="50")
    journey = await db_session.get(KycJourneyState, user.id)
    journey.nominee_draft_json = [first, second]
    await _seed_related_party(
        db_session, user, local_id="nom_1", name="Ram Sharma", related_party_id="relp_existing123", share=50
    )
    await _seed_related_party(
        db_session, user, local_id="nom_2", name="Sita Sharma", related_party_id="relp_new456", share=50
    )
    remaining = _nominee_draft(nominee_id="nom_1", name="Ram Sharma", share="100")

    with (
        patch(
            "app.application.investor.investor_provision_service.create_related_party",
            new=AsyncMock(),
        ) as create_relp,
        patch(
            "app.application.mf.mf_folio_defaults_service.get_mf_investment_account",
            new=AsyncMock(return_value={"folio_defaults": {}}),
        ),
        patch(
            "app.application.mf.mf_folio_defaults_service.update_mf_investment_account",
            new=AsyncMock(return_value={"id": "mfia_14bafabfbfbc423d9b54412dd577981b"}),
        ) as update_mfia,
    ):
        state = await add_investor_nominee(db_session, user=user, nominees=[remaining])

    create_relp.assert_not_awaited()
    folio_defaults = update_mfia.await_args.kwargs["body"]["folio_defaults"]
    assert folio_defaults["nominee1"] == "relp_existing123"
    assert folio_defaults["nominee1_allocation_percentage"] == 100
    assert folio_defaults["nominee2"] is None
    assert folio_defaults["nominee2_allocation_percentage"] is None
    assert folio_defaults["nominee3"] is None
    assert state["nominee_count"] == 1
    journey = await db_session.get(KycJourneyState, user.id)
    assert journey.nominee_draft_json == [remaining]
