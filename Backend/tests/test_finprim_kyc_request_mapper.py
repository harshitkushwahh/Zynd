from __future__ import annotations

from types import SimpleNamespace

from app.application.kyc.finprim_kyc_request_mapper import build_finprim_kyc_request_patch


def _journey(**kwargs: object) -> SimpleNamespace:
    base = {
        "external_identity_document_id": "iddoc_test",
        "pan_draft_json": {
            "panNumber": "ABCDE1234F",
            "firstName": "Asha",
            "lastName": "Patel",
            "dateOfBirth": "1990-01-01",
        },
        "personal_draft_json": {
            "gender": "female",
            "maritalStatus": "single",
            "occupation": "private_sector",
            "incomeSlab": "below_1l",
            "pepExposed": "not_applicable",
            "nationality": "India",
            "fathersName": "Rajesh Gupta",
        },
        "contact_draft_json": {"permanent": {"city": "Bengaluru"}},
        "bank_draft_json": {
            "accountNumber": "1234567890",
            "ifscCode": "SBIN0001234",
            "accountType": "Savings",
        },
        "geolocation_json": {"latitude": 12.97, "longitude": 77.59},
    }
    base.update(kwargs)
    return SimpleNamespace(**base)


def test_build_finprim_kyc_request_patch_includes_proof_bank_and_signature() -> None:
    body = build_finprim_kyc_request_patch(
        user_email="user@example.com",
        user_phone="+917378438349",
        journey=_journey(),
        signature_file_id="file_sig123",
    )
    assert body["identity_proof"] == "iddoc_test"
    assert body["address"]["proof"] == "iddoc_test"
    assert body["signature"] == "file_sig123"
    assert body["email"] == "user@example.com"
    assert body["bank_account"] == {
        "account_number": "1234567890",
        "ifsc_code": "SBIN0001234",
    }
    assert "account_type" not in body["bank_account"]
    assert body["pep_details"] == "not_applicable"
    assert body["occupation_type"] == "private_sector"
    assert body["residential_status"] == "resident_individual"
    assert body["father_name"] == "Rajesh Gupta"


def test_finprim_pep_and_occupation_mapping_from_poa_values() -> None:
    journey = _journey(
        personal_draft_json={
            "gender": "male",
            "maritalStatus": "single",
            "occupation": "public_sector",
            "incomeSlab": "below_1l",
            "pepExposed": "pep_related",
            "nationality": "India",
        },
    )
    body = build_finprim_kyc_request_patch(
        user_email="user@example.com",
        user_phone=None,
        journey=journey,
    )
    assert body["pep_details"] == "pep_related"
    assert body["occupation_type"] == "public_sector"
