from __future__ import annotations

import time
from typing import Any

import httpx

from app.application.integrations.provider_log_recorder import record_provider_api_log
from app.application.integrations.integration_runtime import get_kyckart_runtime, is_kyckart_live
from app.core.config import get_settings
from app.infrastructure.kyc.date_utils import normalize_kyc_date_of_birth
from app.infrastructure.kyc.stub_provider import stub_kyckart_bank_holder_name, stub_kyckart_pan_to_name_dob
from app.infrastructure.persistence.provider_log_models import ProviderLogSource


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
    explicit_last = str(data.get("lastName") or data.get("last_name") or "").strip()
    if explicit_last:
        last_name = explicit_last
    elif len(parts) > 1:
        last_name = parts[-1]
    else:
        last_name = ""
    if (
        first_name
        and last_name
        and first_name.upper() == last_name.upper()
        and len(parts) <= 1
    ):
        last_name = ""
    category_raw = str(data.get("category") or data.get("panCategory") or "individual").lower()
    pan_category = "corporate" if "corp" in category_raw or category_raw in {"c", "firm", "company"} else "individual"
    dob = str(
        data.get("dateOfBirth")
        or data.get("dob")
        or data.get("date_of_birth")
        or data.get("birthDate")
        or ""
    ).strip()

    if not full_name and not first_name:
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


def _looks_like_bank_error_message(value: str) -> bool:
    lowered = value.strip().lower()
    if not lowered:
        return True
    error_markers = (
        "not a valid",
        "invalid account",
        "invalid ifsc",
        "could not",
        "couldn't",
        "failed",
        "offline",
        "blocked",
        "unavailable",
        "does not exist",
        "doesn't exist",
        "not found",
        "no name",
    )
    return any(marker in lowered for marker in error_markers)


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
                if isinstance(value, str):
                    cleaned = value.strip()
                    if cleaned and not _looks_like_bank_error_message(cleaned):
                        return cleaned
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
    data = _coalesce_mapping(
        payload.get("data"),
        isinstance(response_block, dict) and response_block.get("data"),
        payload,
    )
    if isinstance(response_block, dict):
        response_code = response_block.get("code")
        if response_code not in (None, 200, "200"):
            message = str(response_block.get("message") or "Could not verify bank account.").strip()
            raise KyckartError(message, "kyckart_bank_failed", 400)

    account_exists = data.get("account_exists")
    if account_exists is False or str(account_exists).strip().lower() == "false":
        message = str(data.get("message") or "Could not verify bank account.").strip()
        raise KyckartError(message, "kyckart_bank_failed", 400)

    holder_name = _extract_bank_holder_name(data) or _extract_bank_holder_name(payload)
    if not holder_name:
        raise KyckartError(
            "Could not fetch bank account holder name.",
            "kyckart_bank_incomplete",
            502,
        )
    return {"accountHolderName": holder_name, "name": holder_name}


async def _run_logged_kyckart_request(
    *,
    method: str,
    path: str,
    request_body: dict[str, Any],
    runner,
) -> dict[str, Any]:
    started = time.perf_counter()
    status_code: int | None = None
    success = False
    error_code: str | None = None
    response_body: Any = None
    try:
        response = await runner()
        status_code = response.status_code
        response.raise_for_status()
        response_body = response.json()
        success = True
        return response_body
    except KyckartError as exc:
        status_code = exc.status_code
        error_code = exc.code
        raise
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code
        error_code = "kyckart_http_error"
        raise
    except httpx.HTTPError:
        error_code = "kyckart_unavailable"
        raise
    finally:
        await record_provider_api_log(
            source=ProviderLogSource.kyckart,
            method=method,
            path=path,
            status_code=status_code,
            success=success,
            duration_ms=int((time.perf_counter() - started) * 1000),
            error_code=error_code,
            request_body=request_body,
            response_body=response_body,
        )


async def kyckart_pan_to_name_dob(pan_number: str) -> dict[str, Any]:
    if not is_kyckart_live():
        return await stub_kyckart_pan_to_name_dob(pan_number)

    runtime = get_kyckart_runtime()
    base_url = runtime.base_url.rstrip("/")
    path = "/api/panCard/panToNameDob"
    body = {"panNumber": pan_number.upper()}

    async def runner() -> httpx.Response:
        async with httpx.AsyncClient(timeout=30.0) as client:
            return await client.post(
                f"{base_url}{path}",
                headers={"x-api-key": runtime.api_key, "Content-Type": "application/json"},
                json=body,
            )

    try:
        payload = await _run_logged_kyckart_request(
            method="POST",
            path=path,
            request_body=body,
            runner=runner,
        )
    except httpx.HTTPError as exc:
        raise KyckartError(
            "PAN verification service is temporarily unavailable. Try again.",
            "kyckart_unavailable",
            502,
        ) from exc

    return parse_kyckart_pan_payload(payload)


async def kyckart_bank_account_holder_name(*, account_number: str, ifsc_code: str) -> dict[str, Any]:
    if not is_kyckart_live():
        return await stub_kyckart_bank_holder_name(
            account_number=account_number,
            ifsc_code=ifsc_code,
        )

    settings = get_settings()
    runtime = get_kyckart_runtime()
    base_url = runtime.base_url.rstrip("/")
    path = settings.kyckart_bank_verification_path.strip() or "/api/bank/pennyLessV4"
    body = {
        "accountNumber": account_number,
        "ifsc": ifsc_code.upper(),
    }

    async def runner() -> httpx.Response:
        async with httpx.AsyncClient(timeout=30.0) as client:
            return await client.post(
                f"{base_url}{path}",
                headers={"x-api-key": runtime.api_key, "Content-Type": "application/json"},
                json=body,
            )

    try:
        payload = await _run_logged_kyckart_request(
            method="POST",
            path=path,
            request_body=body,
            runner=runner,
        )
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
