from __future__ import annotations

from types import SimpleNamespace

from app.application.kyc.bank_verification_service import (
    _extract_readiness_verified,
    _holder_name_from_pan_draft,
    _resolve_bank_holder_names,
)


def test_holder_name_from_pan_draft() -> None:
    assert _holder_name_from_pan_draft({"fullName": "RAHUL SHARMA"}) == "RAHUL SHARMA"
    assert (
        _holder_name_from_pan_draft({"firstName": "RAHUL", "middleName": "K", "lastName": "SHARMA"})
        == "RAHUL K SHARMA"
    )


def test_resolve_bank_holder_names_returns_kyckart_for_display_only() -> None:
    pan_draft = {"fullName": "RAHUL KUMAR SHARMA"}
    pan_name, kyckart_name = _resolve_bank_holder_names(
        pan_draft,
        kyckart_holder_name="RAHUL SHARMA",
    )
    assert pan_name == "RAHUL KUMAR SHARMA"
    assert kyckart_name == "RAHUL SHARMA"


def test_resolve_bank_holder_names_leaves_kyckart_empty_when_unavailable() -> None:
    pan_draft = {"fullName": "RAHUL KUMAR SHARMA"}
    pan_name, kyckart_name = _resolve_bank_holder_names(pan_draft)
    assert pan_name == "RAHUL KUMAR SHARMA"
    assert kyckart_name == ""


def test_extract_readiness_verified_from_poa_readiness() -> None:
    journey = SimpleNamespace(kyc_already_registered=False)
    assert _extract_readiness_verified({"readiness": {"status": "verified"}}, journey) is True
    assert _extract_readiness_verified({"readiness": {"status": "failed"}}, journey) is False


def test_extract_readiness_verified_falls_back_to_journey_kra_flag() -> None:
    journey = SimpleNamespace(kyc_already_registered=True)
    assert _extract_readiness_verified({}, journey) is True

