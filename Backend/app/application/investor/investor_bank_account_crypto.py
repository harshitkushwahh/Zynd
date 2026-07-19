"""Encrypt/decrypt full bank account numbers stored on investor_bank_accounts rows."""

from __future__ import annotations

from app.infrastructure.persistence.investor_models import InvestorBankAccount
from app.infrastructure.security.field_encryption import PIIFieldType, decrypt_field, encrypt_field


def encrypt_account_number(account_number: str) -> tuple[str, int]:
    ciphertext, version = encrypt_field(account_number.strip(), PIIFieldType.bank_account)
    return ciphertext, version


def decrypt_account_number(*, ciphertext: str, key_version: int) -> str:
    return decrypt_field(ciphertext, PIIFieldType.bank_account, key_version)


def read_account_number(bank_row: InvestorBankAccount) -> str | None:
    if not bank_row.account_number_ciphertext or bank_row.account_number_key_version is None:
        return None
    return decrypt_account_number(
        ciphertext=bank_row.account_number_ciphertext,
        key_version=bank_row.account_number_key_version,
    )


__all__ = [
    "decrypt_account_number",
    "encrypt_account_number",
    "read_account_number",
]
