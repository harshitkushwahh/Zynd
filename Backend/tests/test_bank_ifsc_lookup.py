from __future__ import annotations

from app.application.kyc.bank_ifsc_lookup import format_ifsc_branch_label, normalize_ifsc_lookup_payload


def test_format_ifsc_branch_label_from_finprim_payload() -> None:
    branch = format_ifsc_branch_label(
        {
            "branch_name": "gudivada",
            "city": "gudivada",
            "district": "KRISHNA",
            "state": "ANDHRA PRADESH",
        }
    )
    assert branch == "gudivada, KRISHNA, ANDHRA PRADESH"


def test_format_ifsc_branch_label_dedupes_repeated_place_names() -> None:
    branch = format_ifsc_branch_label(
        {
            "branch_name": "BHIWANI",
            "city": "BHIWANI",
            "district": "BHIWANI",
            "state": "HARYANA",
        }
    )
    assert branch == "BHIWANI, HARYANA"


def test_normalize_ifsc_lookup_payload_resolves_icici_bank_name() -> None:
    payload = normalize_ifsc_lookup_payload(
        "ICIC0000611",
        {
            "ifsc_code": "ICIC0000611",
            "bank_name": "ICICI",
            "branch_name": "gudivada",
            "city": "gudivada",
            "district": "KRISHNA",
            "state": "ANDHRA PRADESH",
        },
    )
    assert payload["ifsc_code"] == "ICIC0000611"
    assert payload["bank_name"] == "ICICI Bank"
    assert payload["branch_name"] == "gudivada"
    assert "gudivada" in payload["branch"]
