from __future__ import annotations

from app.application.kyc.journey_state_service import _step_index, resolve_active_step_index
from app.infrastructure.persistence.models import KycJourneyState


def test_step_index_keeps_pan_active_until_digilocker_complete() -> None:
    assert (
        _step_index(
            "pan",
            digilocker_required=True,
            digilocker_complete=False,
        )
        == 0
    )
    assert (
        _step_index(
            "pan",
            digilocker_required=True,
            digilocker_complete=True,
        )
        == 1
    )
    assert (
        _step_index(
            "digilocker",
            digilocker_required=True,
            digilocker_complete=True,
        )
        == 1
    )


def test_resolve_active_step_index_for_incomplete_digilocker() -> None:
    journey = KycJourneyState(
        user_id=None,
        last_completed_step="pan",
        kyc_already_registered=False,
        readiness_code="kyc_incomplete",
        external_kyc_status="returned_failed",
    )
    assert resolve_active_step_index(journey) == 0

    journey.external_kyc_status = "returned_success"
    journey.last_completed_step = "digilocker"
    assert resolve_active_step_index(journey) == 1
