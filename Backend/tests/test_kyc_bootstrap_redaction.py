from __future__ import annotations

from app.application.kyc.bootstrap_redaction import (
    mask_account_number_display,
    mask_pan_display,
    redact_bank_draft,
    redact_bootstrap_drafts,
    redact_nominee_draft,
    redact_pan_draft,
)


def test_mask_pan_display() -> None:
    assert mask_pan_display("MWYPK9380B") == "•••• •••• 380B"


def test_mask_account_number_display() -> None:
    assert mask_account_number_display("123456789012") == "•••• 9012"


def test_redact_pan_draft_strips_full_number() -> None:
    redacted = redact_pan_draft(
        {
            "panNumber": "MWYPK9380B",
            "firstName": "HARSHIT",
            "lastName": "KUSHWAH",
        }
    )
    assert redacted is not None
    assert "panNumber" not in redacted
    assert redacted["panLast4"] == "380B"
    assert redacted["panMasked"] == "•••• •••• 380B"
    assert redacted["firstName"] == "HARSHIT"


def test_redact_bank_draft_strips_full_account_number() -> None:
    redacted = redact_bank_draft(
        {
            "accountNumber": "73773738281234",
            "ifscCode": "HDFC0001234",
            "bankName": "HDFC Bank",
        }
    )
    assert redacted is not None
    assert "accountNumber" not in redacted
    assert redacted["accountNumberLast4"] == "1234"
    assert redacted["accountNumberMasked"] == "•••• 1234"
    assert redacted["ifscCode"] == "HDFC0001234"


def test_redact_nominee_draft_masks_identity_and_guardian() -> None:
    redacted = redact_nominee_draft(
        [
            {
                "core": {"fullName": "Nominee One"},
                "identity": {"documentType": "aadhaar", "documentNumber": "123456789012"},
                "guardian": {
                    "name": "Guardian",
                    "documentType": "pan",
                    "documentNumber": "ABCDE1234F",
                    "mobile": "9876543210",
                },
            }
        ]
    )
    assert isinstance(redacted, list)
    entry = redacted[0]
    assert "documentNumber" not in entry["identity"]
    assert entry["identity"]["documentNumberLast4"] == "9012"
    assert entry["identity"]["documentNumberMasked"] == "•••• 9012"
    assert "documentNumber" not in entry["guardian"]
    assert entry["guardian"]["documentNumberLast4"] == "234F"
    assert "mobile" not in entry["guardian"]
    assert entry["guardian"]["mobileMasked"] == "•••• ••3210"


def test_redact_bootstrap_drafts() -> None:
    payload = redact_bootstrap_drafts(
        {
            "panDraft": {"panNumber": "MWYPK9380B", "firstName": "A"},
            "bankDraft": {"accountNumber": "1234567890", "ifscCode": "X"},
            "nomineeDraft": None,
            "contactDraft": {"permanent": {"city": "Indore"}},
        }
    )
    assert "panNumber" not in (payload["panDraft"] or {})
    assert "accountNumber" not in (payload["bankDraft"] or {})
    assert payload["contactDraft"]["permanent"]["city"] == "Indore"
