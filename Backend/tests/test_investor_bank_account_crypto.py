from __future__ import annotations

from app.application.investor.investor_bank_account_crypto import (
    decrypt_account_number,
    encrypt_account_number,
    read_account_number,
)
from app.infrastructure.persistence.investor_models import InvestorBankAccount


def test_encrypt_decrypt_account_number_roundtrip() -> None:
    ciphertext, key_version = encrypt_account_number("123456789012")
    assert ciphertext
    assert key_version > 0
    assert decrypt_account_number(ciphertext=ciphertext, key_version=key_version) == "123456789012"


def test_read_account_number_from_row() -> None:
    ciphertext, key_version = encrypt_account_number("9876543210")
    row = InvestorBankAccount(
        account_number_ciphertext=ciphertext,
        account_number_key_version=key_version,
        investor_profile_id=None,  # type: ignore[arg-type]
        account_type="savings",
        account_number_last4="3210",
        ifsc_code="HDFC0001234",
        primary_account_holder_name="Test User",
    )
    assert read_account_number(row) == "9876543210"


def test_read_account_number_returns_none_when_missing() -> None:
    row = InvestorBankAccount(
        investor_profile_id=None,  # type: ignore[arg-type]
        account_type="savings",
        account_number_last4="3210",
        ifsc_code="HDFC0001234",
        primary_account_holder_name="Test User",
    )
    assert read_account_number(row) is None
