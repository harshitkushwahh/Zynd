from __future__ import annotations

from types import SimpleNamespace

from app.application.kyc.kyc_partner_refs import (
    append_kyc_partner_ref,
    find_reusable_kyc_form_id_for_pan,
    is_partner_kyc_form_id,
    record_kyc_form_partner_ref,
)


def test_is_partner_kyc_form_id() -> None:
    assert is_partner_kyc_form_id("kycf_live_abc")
    assert not is_partner_kyc_form_id("esign_abc")


def test_append_kyc_partner_ref_dedupes_same_kind_and_id() -> None:
    journey = SimpleNamespace(kyc_partner_external_refs_json=None)
    append_kyc_partner_ref(journey, kind="kyc_form", external_id="kycf_abc", status="created", pan="ABCDE1234F")
    append_kyc_partner_ref(journey, kind="kyc_form", external_id="kycf_abc", status="awaiting_esign", pan="ABCDE1234F")
    assert len(journey.kyc_partner_external_refs_json) == 1
    assert journey.kyc_partner_external_refs_json[0]["status"] == "awaiting_esign"


def test_find_reusable_kyc_form_id_for_pan_skips_terminal() -> None:
    journey = SimpleNamespace(
        kyc_partner_external_refs_json=[
            {"kind": "kyc_form", "external_id": "kycf_old", "pan": "ABCDE1234F", "status": "failed"},
            {"kind": "kyc_form", "external_id": "kycf_active", "pan": "ABCDE1234F", "status": "awaiting_esign"},
        ]
    )
    assert find_reusable_kyc_form_id_for_pan(journey, "ABCDE1234F") == "kycf_active"


def test_find_reusable_skips_non_partner_form_ids() -> None:
    journey = SimpleNamespace(
        kyc_partner_external_refs_json=[
            {"kind": "kyc_form", "external_id": "local_form_legacy", "pan": "ABCDE1234F", "status": "created"},
            {"kind": "kyc_form", "external_id": "kycf_live", "pan": "ABCDE1234F", "status": "created"},
        ]
    )
    assert find_reusable_kyc_form_id_for_pan(journey, "ABCDE1234F") == "kycf_live"


def test_record_kyc_form_partner_ref() -> None:
    journey = SimpleNamespace(kyc_partner_external_refs_json=None, pan_draft_json={"panNumber": "ABCDE1234F"})
    record_kyc_form_partner_ref(
        journey,
        {"id": "kycf_live_1", "status": "created", "type": "fresh", "pan": "ABCDE1234F"},
    )
    assert journey.kyc_partner_external_refs_json[0]["external_id"] == "kycf_live_1"
