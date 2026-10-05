from __future__ import annotations

import pytest

from app.application.kyc.errors import KycError
from app.application.kyc.personal_draft import (
    is_married_status,
    normalize_personal_draft,
    validate_personal_draft,
)


def test_normalize_personal_draft_keeps_spouse_name_when_married() -> None:
    draft = normalize_personal_draft(
        {
            "maritalStatus": "married",
            "spouseName": "  Anita Gupta  ",
        }
    )
    assert draft["spouseName"] == "Anita Gupta"


def test_normalize_personal_draft_clears_spouse_name_when_not_married() -> None:
    draft = normalize_personal_draft(
        {
            "maritalStatus": "unmarried",
            "spouseName": "Anita Gupta",
        }
    )
    assert draft["spouseName"] == ""


def test_validate_personal_draft_requires_spouse_name_when_married() -> None:
    with pytest.raises(KycError) as exc:
        validate_personal_draft({"maritalStatus": "married", "spouseName": ""})
    assert exc.value.code == "spouse_name_required"


def test_validate_personal_draft_allows_empty_spouse_when_unmarried() -> None:
    validate_personal_draft({"maritalStatus": "unmarried", "spouseName": ""})


def test_is_married_status() -> None:
    assert is_married_status("married") is True
    assert is_married_status("unmarried") is False


def test_validate_rejects_unmarried_when_marital_locked() -> None:
    with pytest.raises(KycError) as exc:
        validate_personal_draft(
            {"maritalStatus": "unmarried", "spouseName": ""},
            journey_marital_locked=True,
        )
    assert exc.value.code == "marital_status_locked"


def test_normalize_preserves_married_when_locked() -> None:
    draft = normalize_personal_draft(
        {
            "maritalStatus": "unmarried",
            "spouseName": "Anita Gupta",
            "maritalStatusLocked": True,
        }
    )
    assert draft["maritalStatus"] == "married"
    assert draft["spouseName"] == "Anita Gupta"
