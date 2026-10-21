from __future__ import annotations

from uuid import uuid4

import pytest

from app.application.kyc.finprim_identity_service import backfill_fathers_name_from_stored_identity_document
from app.application.kyc.journey_state_service import reset_kyc_journey_drafts, save_journey_state
from app.domain.consent.keys import KYC_NOMINATION_OPT_OUT
from app.infrastructure.persistence.models import KycStepStatus, User


@pytest.mark.asyncio
async def test_reset_kyc_journey_drafts_clears_all_progress(db_session) -> None:
    user = User(email=f"reset-{uuid4()}@example.com", first_name="Test", last_name="User")
    db_session.add(user)
    await db_session.flush()

    await save_journey_state(
        db_session,
        user=user,
        payload={
            "panDraftJson": {
                "panNumber": "ABCDE1234F",
                "fullName": "Test User",
                "dateOfBirth": "1990-01-01",
            },
            "panVerificationStatus": "verified",
            "externalIdentityDocumentId": "id-doc-reset-test",
            "externalKycStatus": "returned_success",
        },
    )
    await save_journey_state(
        db_session,
        user=user,
        payload={
            "contactDraftJson": {"line1": "1 Main St", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001"},
            "bankDraftJson": {"ifscCode": "HDFC0000001", "accountNumber": "1234567890"},
            "bankVerificationStatus": "verified",
            "lastCompletedStep": "bank",
        },
    )

    journey, status = await reset_kyc_journey_drafts(db_session, user=user)

    assert journey.last_completed_step is None
    assert journey.pan_draft_json is None
    assert journey.contact_draft_json is None
    assert journey.bank_draft_json is None
    assert journey.bank_verification_status is None
    assert journey.pan_verification_status is None
    assert status.pan_step_status == KycStepStatus.pending
    assert status.bank_step_status == KycStepStatus.pending
    assert status.review_step_status == KycStepStatus.pending


@pytest.mark.asyncio
async def test_reset_kyc_journey_drafts_clears_partner_state_and_consent(db_session, monkeypatch) -> None:
    user = User(email=f"reset-full-{uuid4()}@example.com", first_name="Test", last_name="User")
    db_session.add(user)
    await db_session.flush()

    await save_journey_state(
        db_session,
        user=user,
        payload={
            "panDraftJson": {"panNumber": "ABCDE1234F", "fullName": "Test User", "dateOfBirth": "1990-01-01"},
            "personalDraftJson": {"gender": "male", "fathersName": "Old Father"},
            "nomineeDraftJson": [{"name": "Nominee One", "relationship": "spouse", "sharePercent": 100}],
            "lastCompletedStep": "nominee",
        },
    )

    from app.application.kyc import journey_state_service
    from app.application.kyc.journey_state_service import get_or_create_journey

    revoked: list[str] = []

    async def fake_consent_active(*_args, **_kwargs) -> bool:
        return True

    async def fake_record_revocation(_db, *, user, definition_key, context):  # noqa: ANN001
        revoked.append(definition_key)
        return None

    monkeypatch.setattr(journey_state_service, "user_revocable_consent_active", fake_consent_active)
    monkeypatch.setattr(journey_state_service, "record_revocation", fake_record_revocation)

    journey = await get_or_create_journey(db_session, user.id)
    journey.kyc_partner_external_refs_json = [{"kind": "kyc_form", "external_id": "form_test"}]
    journey.external_identity_document_json = {"fetch": {"status": "successful"}}
    await db_session.flush()

    journey, _ = await reset_kyc_journey_drafts(db_session, user=user)
    await db_session.refresh(journey)

    assert journey.personal_draft_json is None
    assert journey.nominee_draft_json is None
    assert journey.external_identity_document_json is None
    assert journey.kyc_partner_external_refs_json is None
    assert revoked == [KYC_NOMINATION_OPT_OUT]


@pytest.mark.asyncio
async def test_reset_kyc_journey_drafts_prevents_identity_backfill(db_session) -> None:
    user = User(email=f"reset-id-{uuid4()}@example.com", first_name="Test", last_name="User")
    db_session.add(user)
    await db_session.flush()

    await save_journey_state(
        db_session,
        user=user,
        payload={
            "panDraftJson": {"panNumber": "ABCDE1234F", "fullName": "Test User", "dateOfBirth": "1990-01-01"},
            "externalIdentityDocumentJson": {
                "fetch": {"status": "successful"},
                "data": {"care_of": "S/O Prefill Father", "name": "Test User"},
            },
            "personalDraftJson": {"fathersName": "Prefill Father"},
        },
    )

    journey, _ = await reset_kyc_journey_drafts(db_session, user=user)
    await db_session.refresh(journey)

    assert journey.personal_draft_json is None
    assert journey.external_identity_document_json is None

    changed = await backfill_fathers_name_from_stored_identity_document(db_session, journey=journey)
    assert changed is False
    assert journey.personal_draft_json is None
