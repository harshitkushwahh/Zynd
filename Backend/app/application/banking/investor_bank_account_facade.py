"""Facade for investor bank account + POA operations (KYC and /invest bank routes)."""

from __future__ import annotations

from app.application.investor.investor_bank_account_service import (
    disable_bank_account,
    get_bank_account_preverify_status,
    list_user_bank_accounts,
    set_primary_bank_account,
    upload_bank_account_proof,
    verify_and_add_bank_account,
    verify_bank_account_manual,
)

__all__ = [
    "disable_bank_account",
    "get_bank_account_preverify_status",
    "list_user_bank_accounts",
    "set_primary_bank_account",
    "upload_bank_account_proof",
    "verify_and_add_bank_account",
    "verify_bank_account_manual",
]
