from app.application.investor.indian_bank_display import (
    format_bank_account_label,
    resolve_bank_display_name,
)


def test_resolve_bank_display_name_prefers_stored_name() -> None:
    assert resolve_bank_display_name("HDFC Bank", "HDFC0001234") == "HDFC Bank"


def test_resolve_bank_display_name_uses_ifsc_when_name_missing() -> None:
    assert resolve_bank_display_name(None, "KKBK0000591") == "Kotak Mahindra Bank"


def test_resolve_bank_display_name_ignores_generic_bank_placeholder() -> None:
    assert resolve_bank_display_name("Bank", "HDFC0001234") == "HDFC Bank"


def test_format_bank_account_label_includes_last4() -> None:
    assert (
        format_bank_account_label(bank_name="Bank", last4="9725", ifsc_code="KKBK0000591")
        == "Kotak Mahindra Bank ....9725"
    )
