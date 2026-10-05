from __future__ import annotations

from app.application.kyc.journey_gate_service import requires_digilocker
from app.application.kyc.kyc_flow_mode import (
    requires_address_step_digilocker,
    requires_pan_step_digilocker,
    resolve_kyc_flow_mode,
)
from app.infrastructure.persistence.models import KycJourneyState


def _journey(**kwargs: object) -> KycJourneyState:
    journey = KycJourneyState(user_id=None)
    for key, value in kwargs.items():
        setattr(journey, key, value)
    return journey


def test_j1_repeat_kra_skips_pan_step_digilocker() -> None:
    journey = _journey(
        kyc_already_registered=True,
        readiness_code="kyc_registered",
        poa_readiness_preverify_id="pv_1",
    )
    assert resolve_kyc_flow_mode(journey) == "repeat_kra"
    assert requires_pan_step_digilocker(journey) is False
    assert requires_digilocker(journey) is False


def test_j2_fresh_kyc_requires_pan_step_digilocker() -> None:
    journey = _journey(
        kyc_already_registered=False,
        readiness_code="kyc_unavailable",
        external_kyc_status=None,
    )
    assert resolve_kyc_flow_mode(journey) == "fresh_kyc"
    assert requires_pan_step_digilocker(journey) is True
    assert requires_digilocker(journey) is True


def test_j2_fresh_kyc_digilocker_not_required_after_success() -> None:
    journey = _journey(
        kyc_already_registered=False,
        readiness_code="kyc_unavailable",
        external_kyc_status="returned_success",
    )
    assert requires_digilocker(journey) is False


def test_j3_kra_update_requires_address_step_digilocker() -> None:
    journey = _journey(
        kyc_already_registered=True,
        readiness_code="kyc_incomplete",
        poa_readiness_preverify_id="pv_1",
    )
    assert resolve_kyc_flow_mode(journey) == "kra_update"
    assert requires_address_step_digilocker(journey) is True
    assert requires_pan_step_digilocker(journey) is True
    assert requires_digilocker(journey) is True


def test_j3_digilocker_not_required_after_path_a_success() -> None:
    journey = _journey(
        kyc_already_registered=True,
        readiness_code="kyc_incomplete",
        poa_readiness_preverify_id="pv_1",
        external_kyc_status="returned_success",
    )
    assert requires_digilocker(journey) is False
