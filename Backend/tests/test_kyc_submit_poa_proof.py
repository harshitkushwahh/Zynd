from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.application.kyc.errors import KycError
from app.application.kyc.kyc_form_service import submit_kyc_form
from app.infrastructure.persistence.models import KycJourneyState, KycOverallStatus, User, UserKycStatus, UserRole, UserStatus


@pytest.mark.asyncio
async def test_submit_kra_update_pending_poa_proof_returns_proof_redirect(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"submit-proof-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        kyc_already_registered=False,
        readiness_code="kyc_incomplete",
        poa_readiness_preverify_id="pv_1",
        pan_verification_status="verified",
        external_kyc_form_id="kycf_proof_pending",
        proof_details_status="pending",
        pan_draft_json={
            "panNumber": "EPBPS6369E",
            "firstName": "TEST",
            "lastName": "USER",
            "fullName": "TEST USER",
            "dateOfBirth": "1985-01-01",
        },
        contact_draft_json={"permanent": {"line1": "Line 1", "city": "Indore", "state": "MP", "pincode": "452001"}},
        personal_draft_json={"gender": "male", "maritalStatus": "unmarried"},
        nominee_draft_json=[],
        bank_verification_status="verified",
        bank_draft_json={"accountNumber": "1234567890", "ifsc": "SBIN0000001"},
        signature_draft_json={"dataUrl": "data:image/png;base64,abc"},
        geolocation_json={"latitude": 22.71, "longitude": 75.85},
        last_completed_step="signature",
    )
    status = UserKycStatus(user_id=user.id, overall_status=KycOverallStatus.phase2_complete)
    db_session.add(journey)
    db_session.add(status)
    await db_session.flush()

    pending_form = {
        "id": "kycf_proof_pending",
        "status": "created",
        "type": "modify",
        "proof_details": {"status": "pending", "fetch_url": "https://s.finprim.com/proof-pending"},
        "signature_provided": False,
    }

    with patch(
        "app.application.kyc.kyc_form_service.fetch_journey_kyc_form",
        new=AsyncMock(return_value=pending_form),
    ), patch(
        "app.application.kyc.kyc_form_service.ensure_kyc_form",
        new=AsyncMock(return_value=pending_form),
    ), patch(
        "app.application.kyc.kyc_form_service.patch_kyc_form",
        new=AsyncMock(return_value=pending_form),
    ), patch(
        "app.application.kyc.poa_kyc_form_service.resolve_poa_proof_server_side",
        new=AsyncMock(return_value=pending_form),
    ), patch(
        "app.application.kyc.geolocation_service.lookup_ip_geolocation",
        new=AsyncMock(return_value=None),
    ):
        result = await submit_kyc_form(
            db_session,
            user=user,
            latitude=22.71,
            longitude=75.85,
            accuracy_meters=50,
            client_ip="127.0.0.1",
        )

    assert result["nextAction"] == "proof_redirect"
    assert result["redirectUrl"] == "https://s.finprim.com/proof-pending"


@pytest.mark.asyncio
async def test_submit_does_not_403_digilocker_for_pending_poa_proof_on_journey(db_session) -> None:
    user = User(
        id=uuid4(),
        email=f"submit-no403-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        kyc_already_registered=False,
        readiness_code="kyc_incomplete",
        poa_readiness_preverify_id="pv_1",
        proof_details_status="pending",
        pan_draft_json={"panNumber": "EPBPS6369E", "fullName": "TEST USER", "dateOfBirth": "1985-01-01"},
        personal_draft_json={"gender": "male"},
        bank_verification_status="verified",
        bank_draft_json={"accountNumber": "1234567890", "ifsc": "SBIN0000001"},
        contact_draft_json={"permanent": {"line1": "Line 1", "city": "Indore", "state": "MP", "pincode": "452001"}},
        signature_draft_json={"dataUrl": "data:image/png;base64,abc"},
        last_completed_step="signature",
    )
    status = UserKycStatus(user_id=user.id, overall_status=KycOverallStatus.phase2_complete)
    db_session.add(journey)
    db_session.add(status)
    await db_session.flush()

    pending = {
        "id": "kycf_x",
        "status": "created",
        "proof_details": {"status": "pending", "fetch_url": "https://proof.example"},
    }

    with patch(
        "app.application.kyc.kyc_form_service.ensure_kyc_form",
        new=AsyncMock(return_value=pending),
    ), patch(
        "app.application.kyc.kyc_form_service.patch_kyc_form",
        new=AsyncMock(return_value=pending),
    ), patch(
        "app.application.kyc.poa_kyc_form_service.resolve_poa_proof_server_side",
        new=AsyncMock(return_value=pending),
    ), patch(
        "app.application.kyc.geolocation_service.lookup_ip_geolocation",
        new=AsyncMock(return_value=None),
    ):
        result = await submit_kyc_form(
            db_session,
            user=user,
            latitude=22.71,
            longitude=75.85,
            accuracy_meters=50,
        )

    assert result["nextAction"] == "proof_redirect"


@pytest.mark.asyncio
async def test_save_address_blocked_when_live_poa_form_proof_pending(db_session) -> None:
    from app.application.kyc.journey_state_service import save_journey_state

    user = User(
        id=uuid4(),
        email=f"addr-block-{uuid4()}@example.com",
        phone=f"+919{uuid4().int % 10_000_000_000:010d}",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    journey = KycJourneyState(
        user_id=user.id,
        kyc_already_registered=False,
        readiness_code="kyc_incomplete",
        poa_readiness_preverify_id="pv_1",
        external_kyc_form_id="kycf_live_pending",
        proof_details_status="fetched",
        pan_draft_json={"panNumber": "EPBPS6369E", "fullName": "TEST USER", "dateOfBirth": "1985-01-01"},
    )
    db_session.add(journey)
    await db_session.flush()

    live_form = {
        "id": "kycf_live_pending",
        "status": "created",
        "proof_details": {"status": "pending", "fetch_url": "https://proof.example"},
    }

    with patch(
        "app.application.kyc.kyc_form_service.fetch_journey_kyc_form",
        new=AsyncMock(return_value=live_form),
    ), patch(
        "app.application.kyc.pincode_address_service.normalize_contact_draft_pincodes",
        new=AsyncMock(side_effect=lambda draft: draft),
    ):
        with pytest.raises(KycError) as exc:
            await save_journey_state(
                db_session,
                user=user,
                payload={
                    "contactDraftJson": {
                        "permanent": {"line1": "Manual", "city": "Indore", "state": "MP", "pincode": "452001"}
                    }
                },
            )

    assert exc.value.code == "digilocker_required"
