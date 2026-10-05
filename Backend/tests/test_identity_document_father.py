from __future__ import annotations

import pytest

from app.application.kyc.identity_document_father import (
    normalize_fathers_name_value,
    resolve_fathers_name_from_care_of,
    resolve_fathers_name_from_identity_data,
    strip_kyc_father_name_prefixes,
)
from app.application.kyc.master_data import map_identity_document_to_drafts


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("S/o Ramesh Kumar", "Ramesh Kumar"),
        ("S/O Rajesh Kushwah", "Rajesh Kushwah"),
        ("s/o: Rajesh Kushwah", "Rajesh Kushwah"),
        ("S / O Rajesh Kushwah", "Rajesh Kushwah"),
        ("S.O. Rajesh Kushwah", "Rajesh Kushwah"),
        ("S O Rajesh Kushwah", "Rajesh Kushwah"),
        ("SO Rajesh Kushwah", "Rajesh Kushwah"),
        ("SO: Rajesh Kushwah", "Rajesh Kushwah"),
        ("so of Rajesh Kushwah", "Rajesh Kushwah"),
        ("Son of Rajesh Kushwah", "Rajesh Kushwah"),
        ("D/o Anita Devi", "Anita Devi"),
        ("D/O Anita Devi", "Anita Devi"),
        ("W/o Lakshmi Devi", "Lakshmi Devi"),
        ("C/o Ramesh Kumar", "Ramesh Kumar"),
        ("C/O: Ramesh Kumar", "Ramesh Kumar"),
        ("H/o Rajesh Kumar", "Rajesh Kumar"),
        ("Husband of Rajesh Kumar", "Rajesh Kumar"),
        ("Care of S/o Nested Name", "Nested Name"),
    ],
)
def test_strip_kyc_father_name_prefix_variants(raw: str, expected: str) -> None:
    assert strip_kyc_father_name_prefixes(raw) == expected
    assert normalize_fathers_name_value(raw) == expected


def test_resolve_fathers_name_from_care_of_strips_son_of_prefix() -> None:
    assert resolve_fathers_name_from_identity_data({"care_of": "S/o Ramesh Kumar"}) == "Ramesh Kumar"


def test_resolve_fathers_name_prefers_explicit_father_name() -> None:
    assert (
        resolve_fathers_name_from_identity_data(
            {"father_name": "Rajesh Gupta", "care_of": "S/o Someone Else"}
        )
        == "Rajesh Gupta"
    )


def test_resolve_fathers_name_from_care_of_helper() -> None:
    assert resolve_fathers_name_from_care_of("C/o Anita Devi") == "Anita Devi"


def test_map_identity_document_to_drafts_includes_fathers_name_from_care_of() -> None:
    mapped = map_identity_document_to_drafts(
        {
            "data": {
                "line_1": "12 MG Road",
                "city": "Bengaluru",
                "pincode": "560001",
                "state_name": "Karnataka",
                "care_of": "S/o Ramesh Kumar",
            },
            "fetch": {"status": "successful"},
        }
    )
    assert mapped["fathersName"] == "Ramesh Kumar"
    assert mapped["careOf"] == "S/o Ramesh Kumar"
