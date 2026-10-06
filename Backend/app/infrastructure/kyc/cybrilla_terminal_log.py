"""Stdout traces for Cybrilla / Finprim KYC HTTP (dev-friendly; secrets redacted)."""

from __future__ import annotations

import json
import re
from typing import Any

_PAN_PATTERN = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
_SENSITIVE_KEYS = frozenset(
    {
        "pan",
        "account_number",
        "investor_identifier",
        "mobile",
        "email",
        "date_of_birth",
    }
)


def provider_tag(*, use_poa: bool) -> str:
    return "CYBRILLA" if use_poa else "FINPRIM"


def offline_tag(*, cybrilla: bool = True) -> str:
    return "CYBRILLA-OFFLINE" if cybrilla else "FINPRIM-OFFLINE"


def _mask_token(value: str) -> str:
    cleaned = value.strip()
    if _PAN_PATTERN.match(cleaned.upper()):
        return f"****{cleaned.upper()[-4:]}"
    if cleaned.isdigit() and len(cleaned) >= 4:
        return f"****{cleaned[-4:]}"
    if len(cleaned) <= 2:
        return "****"
    return f"{cleaned[:1]}***{cleaned[-1:]}"


def _sanitize_log_value(key: str, value: Any, *, depth: int = 0) -> Any:
    if depth > 5:
        return "…"
    key_lower = str(key).lower()
    if key_lower in _SENSITIVE_KEYS and isinstance(value, str):
        return _mask_token(value)
    if key_lower == "name" and isinstance(value, str):
        return _mask_token(value)
    if isinstance(value, dict):
        if "value" in value and len(value) <= 3:
            inner = value.get("value")
            if isinstance(inner, str):
                return {"value": _mask_token(inner)}
            if isinstance(inner, dict):
                return {"value": _sanitize_log_value("value", inner, depth=depth + 1)}
        return {k: _sanitize_log_value(str(k), v, depth=depth + 1) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize_log_value(key, item, depth=depth + 1) for item in value[:5]]
    if isinstance(value, str) and len(value) > 120:
        return f"{value[:117]}…"
    return value


def _sanitize_body(body: Any) -> Any:
    if body is None:
        return None
    if isinstance(body, dict):
        return _sanitize_log_value("body", body)
    return body


def _summarize_response(body: Any) -> str:
    if not isinstance(body, dict):
        text = str(body)
        return text[:240] if len(text) > 240 else text

    parts: list[str] = []
    for key in ("id", "status", "object", "type", "reason"):
        if body.get(key) is not None:
            parts.append(f"{key}={body[key]}")

    readiness = body.get("readiness")
    if isinstance(readiness, dict):
        parts.append(
            "readiness="
            f"{readiness.get('status') or '?'}"
            f":{readiness.get('code') or '?'}"
        )

    pan_block = body.get("pan")
    if isinstance(pan_block, dict):
        parts.append(f"pan_field={pan_block.get('status') or '?'}")

    bank_accounts = body.get("bank_accounts")
    if isinstance(bank_accounts, list) and bank_accounts:
        first = bank_accounts[0]
        if isinstance(first, dict):
            parts.append(f"bank={first.get('status') or '?'}")

    proof = body.get("proof_details")
    if isinstance(proof, dict) and proof.get("status"):
        parts.append(f"proof={proof.get('status')}")

    esign = body.get("esign_details")
    if isinstance(esign, dict) and esign.get("status"):
        parts.append(f"esign={esign.get('status')}")

    if body.get("token_url"):
        parts.append("token_url=present")

    if not parts:
        compact = json.dumps(_sanitize_body(body), default=str, separators=(",", ":"))
        return compact[:320] + ("…" if len(compact) > 320 else "")
    return " | ".join(parts)


def log_fp_http(
    *,
    use_poa: bool,
    method: str,
    path: str,
    status_code: int | None,
    success: bool,
    duration_ms: int,
    error_code: str | None = None,
    request_body: Any = None,
    response_body: Any = None,
) -> None:
    tag = provider_tag(use_poa=use_poa)
    outcome = "OK" if success else "ERR"
    status = status_code if status_code is not None else "-"
    req = json.dumps(_sanitize_body(request_body), default=str, separators=(",", ":")) if request_body else "-"
    if len(req) > 280:
        req = req[:277] + "…"
    summary = _summarize_response(response_body) if response_body is not None else "-"
    err = f" | error={error_code}" if error_code else ""
    print(
        f"[{tag}] {method} {path} → {status} {outcome} {duration_ms}ms{err} | req={req} | res={summary}",
        flush=True,
    )


def log_poa_operation(operation: str, *, live: bool, **context: Any) -> None:
    tag = provider_tag(use_poa=True) if live else offline_tag(cybrilla=True)
    details = json.dumps(_sanitize_body(context), default=str, separators=(",", ":"))
    if len(details) > 320:
        details = details[:317] + "…"
    print(f"[{tag}] {operation} | {details}", flush=True)


def log_kyc_step(message: str, **context: Any) -> None:
    details = json.dumps(_sanitize_body(context), default=str, separators=(",", ":"))
    if len(details) > 400:
        details = details[:397] + "…"
    suffix = f" | {details}" if context else ""
    print(f"[KYC] {message}{suffix}", flush=True)


def log_mf_payment_step(message: str, **context: Any) -> None:
    details = json.dumps(_sanitize_body(context), default=str, separators=(",", ":"))
    if len(details) > 400:
        details = details[:397] + "…"
    suffix = f" | {details}" if context else ""
    print(f"[MF-PAY] {message}{suffix}", flush=True)
