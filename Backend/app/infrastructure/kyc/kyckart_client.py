from __future__ import annotations

from typing import Any

import httpx

from app.core.config import get_settings
from app.infrastructure.kyc.date_utils import normalize_kyc_date_of_birth
from app.infrastructure.kyc.stub_provider import stub_kyckart_bank_holder_name, stub_kyckart_pan_to_name_dob


class KyckartError(Exception):
    def __init__(self, message: str, code: str = "kyckart_error", status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


def _coalesce_mapping(*candidates: Any) -> dict[str, Any]:
    for candidate in candidates:
        if isinstance(candidate, dict) and candidate:
            return candidate
    return {}


def parse_kyckart_pan_payload(payload: dict[str, Any]) -> dict[str, Any]:
    response_block = payload.get("response")
    if isinstance(response_block, dict):
        response_code = response_block.get("code")
        if response_code not in (None, 200, "200"):
            message = str(
                response_block.get("message")
                or response_block.get("statusMessage")
                or "Could not fetch PAN holder details."
            ).strip()
            raise KyckartError(message, "kyckart_pan_failed", 400)

    data = _coalesce_mapping(
        payload.get("data"),
        isinstance(response_block, dict) and response_block.get("data"),
        isinstance(response_block, dict) and response_block,
        payload,
    )

    full_name = str(
        data.get("name")
        or data.get("fullName")
        or data.get("full_name")
        or data.get("panHolderName")
        or ""
    ).strip()
    parts = [part for part in full_name.split() if part]
    first_name = str(data.get("firstName") or data.get("first_name") or (parts[0] if parts else "")).strip()
    last_name = str(
        data.get("lastName")
        or data.get("last_name")
        or (parts[-1] if len(parts) > 1 else first_name)
    ).strip()
    category_raw = str(data.get("category") or data.get("panCategory") or "individual").lower()
    pan_category = "corporate" if "corp" in category_raw or category_raw in {"c", "firm", "company"} else "individual"
    dob = str(
        data.get("dateOfBirth")
        or data.get("dob")
        or data.get("date_of_birth")
        or data.get("birthDate")
        or ""
    ).strip()

    if not full_name and not (first_name and last_name):
        raise KyckartError("Could not fetch PAN holder name.", "kyckart_incomplete", 502)
    if not dob:
        raise KyckartError("Could not fetch date of birth for this PAN.", "kyckart_incomplete", 502)

    try:
        dob = normalize_kyc_date_of_birth(dob)
    except ValueError as exc:
        raise KyckartError(
            "Could not parse date of birth for this PAN.",
            "kyckart_incomplete",
            502,
        ) from exc

    return {
        "firstName": first_name,
        "lastName": last_name,
        "fullName": full_name or f"{first_name} {last_name}".strip(),
        "dateOfBirth": dob,
        "panCategory": pan_category,
    }


def _extract_bank_holder_name(payload: dict[str, Any]) -> str:
    candidate_keys = (
        "accountHolderName",
        "account_holder_name",
        "nameAtBank",
        "name_at_bank",
        "beneficiaryName",
        "beneficiary_name",
        "holderName",
        "holder_name",
        "name",
    )

    def walk(node: Any) -> str:
        if isinstance(node, dict):
            for key in candidate_keys:
                value = node.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
            for value in node.values():
                found = walk(value)
                if found:
                    return found
        elif isinstance(node, list):
            for item in node:
                found = walk(item)
                if found:
                    return found
        return ""

    return walk(payload)


def parse_kyckart_bank_payload(payload: dict[str, Any]) -> dict[str, Any]:
    response_block = payload.get("response")
    if isinstance(response_block, dict):
        response_code = response_block.get("code")
        if response_code not in (None, 200, "200"):
            message = str(response_block.get("message") or "Could not verify bank account.").strip()
            raise KyckartError(message, "kyckart_bank_failed", 400)

    holder_name = _extract_bank_holder_name(payload)
    if not holder_name:
        raise KyckartError(
            "Could not fetch bank account holder name.",
            "kyckart_bank_incomplete",
            502,
        )
    return {"accountHolderName": holder_name, "name": holder_name}


async def kyckart_pan_to_name_dob(pan_number: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.resolved_kyc_provider_live:
        return await stub_kyckart_pan_to_name_dob(pan_number)

    base_url = settings.kyckart_base_url.rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{base_url}/api/panCard/panToNameDob",
                headers={"x-api-key": settings.kyckart_api_key, "Content-Type": "application/json"},
                json={"panNumber": pan_number.upper()},
            )
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPError as exc:
        raise KyckartError(
            "PAN verification service is temporarily unavailable. Try again.",
            "kyckart_unavailable",
            502,
        ) from exc

    return parse_kyckart_pan_payload(payload)


async def kyckart_bank_account_holder_name(*, account_number: str, ifsc_code: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.resolved_kyc_provider_live:
        return await stub_kyckart_bank_holder_name(
            account_number=account_number,
            ifsc_code=ifsc_code,
        )

    base_url = settings.kyckart_base_url.rstrip("/")
    path = settings.kyckart_bank_verification_path.strip() or "/api/bank/pennyLessV4"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{base_url}{path}",
                headers={"x-api-key": settings.kyckart_api_key, "Content-Type": "application/json"},
                json={
                    "accountNumber": account_number,
                    "ifsc": ifsc_code.upper(),
                },
            )
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise KyckartError(
                "Bank account lookup is not enabled on your Kyckart API plan.",
                "kyckart_bank_not_configured",
                502,
            ) from exc
        raise KyckartError(
            "Bank verification service is temporarily unavailable. Try again.",
            "kyckart_unavailable",
            502,
        ) from exc
    except httpx.HTTPError as exc:
        raise KyckartError(
            "Bank verification service is temporarily unavailable. Try again.",
            "kyckart_unavailable",
            502,
        ) from exc

    return parse_kyckart_bank_payload(payload)
