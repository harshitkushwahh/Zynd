"""Redact sensitive KYC draft fields before returning them in bootstrap/read APIs."""

from __future__ import annotations

import copy
from typing import Any


def _pan_last4(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip().upper()
    if len(normalized) < 4:
        return None
    return normalized[-4:]


def _account_last4(value: str | None) -> str | None:
    if not value:
        return None
    digits = "".join(char for char in value if char.isdigit())
    if len(digits) < 4:
        return None
    return digits[-4:]


def _document_last4(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip()
    if len(normalized) < 4:
        return None
    return normalized[-4:]


def mask_pan_display(pan_number: str | None) -> str | None:
    last4 = _pan_last4(pan_number)
    if not last4:
        return None
    return f"•••• •••• {last4}"


def mask_account_number_display(account_number: str | None) -> str | None:
    last4 = _account_last4(account_number)
    if not last4:
        return None
    return f"•••• {last4}"


def mask_document_number_display(document_number: str | None) -> str | None:
    last4 = _document_last4(document_number)
    if not last4:
        return None
    return f"•••• {last4}"


def _mask_mobile_display(mobile: str | None) -> str | None:
    if not mobile:
        return None
    digits = "".join(char for char in mobile if char.isdigit())
    if len(digits) < 4:
        return None
    return f"•••• ••{digits[-4:]}"


def redact_pan_draft(pan_draft: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(pan_draft, dict):
        return None
    payload = copy.deepcopy(pan_draft)
    pan_number = str(payload.pop("panNumber", "") or "").strip() or None
    if pan_number:
        payload["panLast4"] = _pan_last4(pan_number)
        masked = mask_pan_display(pan_number)
        if masked:
            payload["panMasked"] = masked
    return payload


def redact_bank_draft(bank_draft: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(bank_draft, dict):
        return None
    payload = copy.deepcopy(bank_draft)
    account_number = str(payload.pop("accountNumber", "") or "").strip() or None
    if account_number:
        payload["accountNumberLast4"] = _account_last4(account_number)
        masked = mask_account_number_display(account_number)
        if masked:
            payload["accountNumberMasked"] = masked
    return payload


def _redact_nominee_identity(identity: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(identity, dict):
        return None
    payload = copy.deepcopy(identity)
    document_number = str(payload.pop("documentNumber", "") or "").strip() or None
    if document_number:
        payload["documentNumberLast4"] = _document_last4(document_number)
        masked = mask_document_number_display(document_number)
        if masked:
            payload["documentNumberMasked"] = masked
    return payload


def _redact_nominee_guardian(guardian: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(guardian, dict):
        return None
    payload = copy.deepcopy(guardian)
    document_number = str(payload.pop("documentNumber", "") or "").strip() or None
    if document_number:
        payload["documentNumberLast4"] = _document_last4(document_number)
        masked = mask_document_number_display(document_number)
        if masked:
            payload["documentNumberMasked"] = masked
    mobile = str(payload.get("mobile") or "").strip() or None
    if mobile:
        mobile_masked = _mask_mobile_display(mobile)
        if mobile_masked:
            payload["mobileMasked"] = mobile_masked
        payload.pop("mobile", None)
    return payload


def redact_nominee_draft(nominee_draft: list[dict[str, Any]] | dict[str, Any] | None) -> Any:
    if nominee_draft is None:
        return None
    if isinstance(nominee_draft, dict):
        return _redact_nominee_entry(nominee_draft)
    if not isinstance(nominee_draft, list):
        return nominee_draft
    return [_redact_nominee_entry(entry) for entry in nominee_draft if isinstance(entry, dict)]


def _redact_nominee_entry(entry: dict[str, Any]) -> dict[str, Any]:
    payload = copy.deepcopy(entry)
    identity = payload.get("identity")
    if isinstance(identity, dict):
        payload["identity"] = _redact_nominee_identity(identity)
    guardian = payload.get("guardian")
    if isinstance(guardian, dict):
        payload["guardian"] = _redact_nominee_guardian(guardian)
    return payload


def redact_bootstrap_drafts(payload: dict[str, Any]) -> dict[str, Any]:
    redacted = dict(payload)
    redacted["panDraft"] = redact_pan_draft(payload.get("panDraft"))
    redacted["bankDraft"] = redact_bank_draft(payload.get("bankDraft"))
    redacted["nomineeDraft"] = redact_nominee_draft(payload.get("nomineeDraft"))
    return redacted
