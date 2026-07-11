from __future__ import annotations

from types import SimpleNamespace

from app.application.kyc.bank_verification_service import (
    _extract_readiness_verified,
    _holder_name_from_pan_draft,
)


def test_holder_name_from_pan_draft() -> None:
    assert _holder_name_from_pan_draft({"fullName": "RAHUL SHARMA"}) == "RAHUL SHARMA"
    assert (
        _holder_name_from_pan_draft({"firstName": "RAHUL", "middleName": "K", "lastName": "SHARMA"})
        == "RAHUL K SHARMA"
    )


def test_extract_readiness_verified_from_poa_readiness() -> None:
    journey = SimpleNamespace(kyc_already_registered=False)
    assert _extract_readiness_verified({"readiness": {"status": "verified"}}, journey) is True
    assert _extract_readiness_verified({"readiness": {"status": "failed"}}, journey) is False


def test_extract_readiness_verified_falls_back_to_journey_kra_flag() -> None:
    journey = SimpleNamespace(kyc_already_registered=True)
    assert _extract_readiness_verified({}, journey) is True

