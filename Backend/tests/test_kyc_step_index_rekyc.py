from __future__ import annotations

from app.application.kyc.journey_state_service import _step_index


def test_step_index_rekyc_includes_signature() -> None:
    assert _step_index("bank", kyc_already_registered=True, requires_full_kyc=True) == 5
    assert _step_index("signature", kyc_already_registered=True, requires_full_kyc=True) == 6
    assert _step_index("review", kyc_already_registered=True, requires_full_kyc=True) == 6


def test_step_index_kra_verified_skips_signature() -> None:
    assert _step_index("bank", kyc_already_registered=True, requires_full_kyc=False) == 5
    assert _step_index("review", kyc_already_registered=True, requires_full_kyc=False) == 5
