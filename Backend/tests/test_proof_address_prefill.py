from app.application.kyc.proof_address_prefill import contact_draft_from_kyc_form


def test_contact_draft_from_kyc_form_address() -> None:
    draft = contact_draft_from_kyc_form(
        {
            "proof_details": {"status": "fetched"},
            "address": {
                "line_1": "12 MG Road",
                "city": "Bengaluru",
                "pincode": "560001",
                "state": "Karnataka",
                "country": "in",
            },
        }
    )
    assert draft is not None
    assert draft["permanent"]["line1"] == "12 MG Road"
    assert draft["permanent"]["pincode"] == "560001"
    assert draft["permanent"]["country"] == "India"
    assert draft["sameAsPermanent"] is True


def test_contact_draft_falls_back_to_proof_details_address() -> None:
    draft = contact_draft_from_kyc_form(
        {
            "proof_details": {
                "status": "successful",
                "address": {"line1": "1 Residency Road", "pincode": "400001"},
            }
        }
    )
    assert draft is not None
    assert draft["permanent"]["line1"] == "1 Residency Road"
