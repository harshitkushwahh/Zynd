from __future__ import annotations

import asyncio
from typing import Any

from app.application.integrations.integration_runtime import (
    digilocker_configuration_message,
    get_finprim_digilocker_runtime,
    is_finprim_digilocker_live,
)
from app.core.config import get_settings
from app.infrastructure.core.channels import (
    CybrillaChannel,
    fp_runtime as _fp_runtime,
    use_kyc_tenant_runtime as _use_kyc_tenant_runtime,
)
from app.infrastructure.core.errors import (
    FpClientError,
    parse_fp_error_message as _parse_fp_error_message,
    raise_for_fp_response as _raise_for_fp_response,
)
from app.infrastructure.core.orchestrator import get_cybrilla_orchestrator
from app.infrastructure.core.tokens import get_cybrilla_token_service, invalidate_all_cybrilla_tokens


def invalidate_fp_tokens() -> None:
    invalidate_all_cybrilla_tokens()


def _normalize_state_row(item: dict[str, Any]) -> dict[str, str] | None:
    name = str(item.get("name") or item.get("state_name") or "").strip()
    if not name:
        return None
    return {
        "name": name,
        "state_code": str(item.get("state_code") or item.get("code") or "").strip(),
        "country_ansi_code": str(item.get("country_ansi_code") or "IN"),
    }


def _normalize_country_row(item: dict[str, Any]) -> dict[str, str] | None:
    name = str(item.get("name") or "").strip()
    ansi_code = str(item.get("ansi_code") or item.get("country_ansi_code") or "").strip()
    if not name or not ansi_code:
        return None
    return {"name": name, "ansi_code": ansi_code}


async def ensure_kyc_tokens() -> None:
    tokens = get_cybrilla_token_service()
    await tokens.get_token(CybrillaChannel.finprim_kyc)
    await tokens.get_token(CybrillaChannel.cybrilla_poa)


async def fp_get(path: str, *, use_poa: bool = False) -> dict[str, Any]:
    return await get_cybrilla_orchestrator().request_json("GET", path, use_poa=use_poa)


async def fp_post(path: str, body: dict[str, Any], *, use_poa: bool = False) -> dict[str, Any]:
    return await get_cybrilla_orchestrator().request_json(
        "POST",
        path,
        use_poa=use_poa,
        json_body=body,
    )


async def fp_post_multipart(
    path: str,
    *,
    fields: dict[str, str],
    files: dict[str, tuple[str, bytes, str]],
    use_poa: bool = False,
) -> dict[str, Any]:
    return await get_cybrilla_orchestrator().request_json(
        "POST",
        path,
        use_poa=use_poa,
        timeout=60.0,
        multipart=(fields, files),
    )


async def fp_patch(path: str, body: dict[str, Any], *, use_poa: bool = False) -> dict[str, Any]:
    return await get_cybrilla_orchestrator().request_json(
        "PATCH",
        path,
        use_poa=use_poa,
        json_body=body,
    )


async def poll_poa_preverification(preverify_id: str, *, max_attempts: int = 20) -> dict[str, Any]:
    from app.infrastructure.kyc.cybrilla_terminal_log import log_poa_operation

    log_poa_operation("poll_preverification_start", live=True, preverify_id=preverify_id)
    payload: dict[str, Any] = {"id": preverify_id, "status": "pending"}
    for attempt in range(max_attempts):
        payload = await fp_get(f"/poa/pre_verifications/{preverify_id}", use_poa=True)
        if payload.get("status") == "completed":
            log_poa_operation(
                "poll_preverification_done",
                live=True,
                preverify_id=preverify_id,
                attempt=attempt + 1,
                status=payload.get("status"),
            )
            return payload
        await asyncio.sleep(min(0.25 * (attempt + 1), 2.0))
    log_poa_operation(
        "poll_preverification_timeout",
        live=True,
        preverify_id=preverify_id,
        last_status=payload.get("status"),
        attempts=max_attempts,
    )
    return payload


async def create_kyc_request_and_identity_document(
    *,
    user_email: str,
    phone: str | None,
    pan: str,
    name: str,
    date_of_birth: str,
    postback_url: str,
) -> dict[str, Any]:
    settings = get_settings()
    if not is_finprim_digilocker_live():
        raise FpClientError(
            digilocker_configuration_message(),
            "digilocker_unavailable",
            503,
        )

    from app.infrastructure.kyc.cybrilla_terminal_log import log_kyc_step

    mobile_number = (phone or "").strip()
    if mobile_number.startswith("+91"):
        mobile_number = mobile_number[3:]
    mobile_number = mobile_number.lstrip("+").replace(" ", "")

    runtime = get_finprim_digilocker_runtime()
    client_id = runtime.client_id.strip()
    log_kyc_step(
        "digilocker_finprim_config",
        base_url=runtime.base_url,
        tenant=runtime.tenant,
        environment=runtime.environment,
        fp_enabled=settings.fp_enabled,
        kyc_provider_mode=settings.kyc_provider_mode,
        kyc_digilocker_sandbox=settings.kyc_digilocker_sandbox,
        oauth_client_id_prefix=client_id[:8] if len(client_id) >= 8 else client_id,
        oauth_client_configured=bool(client_id and runtime.client_secret.strip()),
    )

    try:
        kyc_request = await fp_post(
            "/v2/kyc_requests",
            {
                "name": name,
                "pan": pan.upper(),
                "email": user_email,
                "date_of_birth": date_of_birth,
                "mobile": {"isd": "+91", "number": mobile_number or "9999999999"},
            },
        )
        kyc_request_id = str(kyc_request["id"])
        try:
            identity_document = await fp_post(
                "/v2/identity_documents",
                {
                    "kyc_request": kyc_request_id,
                    "type": "aadhaar",
                    "postback_url": postback_url,
                },
            )
        except FpClientError as exc:
            if exc.status_code == 403:
                raise FpClientError(
                    "FinPrim rejected DigiLocker identity document (403). "
                    f"Ask FinPrim to whitelist this postback URL for tenant multiplus sandbox, "
                    f"or set KYC_DIGILOCKER_CALLBACK_URL to a registered URL (often "
                    f"http://localhost:8000/api/v1/kyc/public/digilocker-callback, not 127.0.0.1). "
                    f"postback_url={postback_url}",
                    "digilocker_postback_forbidden",
                    403,
                    response_data=exc.response_data,
                ) from exc
            raise
    except FpClientError:
        raise

    fetch = identity_document.get("fetch") or {}
    redirect_url = str(fetch.get("redirect_url") or "")
    log_kyc_step(
        "digilocker_start",
        live=True,
        pan=pan,
        identity_document_id=str(identity_document["id"]),
        fetch_status=fetch.get("status"),
        has_redirect=bool(redirect_url),
        expires_at=fetch.get("expires_at"),
    )
    return {
        "kycRequestId": kyc_request_id,
        "identityDocumentId": str(identity_document["id"]),
        "redirectUrl": redirect_url,
        "identityDocument": identity_document,
    }


async def fetch_identity_document(document_id: str, *, postback_complete: bool = False) -> dict[str, Any]:
    from app.infrastructure.kyc.cybrilla_terminal_log import log_kyc_step

    live = is_finprim_digilocker_live()
    log_kyc_step(
        "digilocker_fetch_identity_document",
        live=live,
        document_id=document_id,
        postback_complete=postback_complete,
    )
    if not live:
        raise FpClientError(
            "FinPrim DigiLocker is not configured. Cannot fetch identity document.",
            "digilocker_unavailable",
            503,
        )
    document = await fp_get(f"/v2/identity_documents/{document_id}")
    fetch = document.get("fetch") or {}
    log_kyc_step(
        "digilocker_fetch_identity_document_result",
        live=live,
        document_id=document_id,
        fetch_status=fetch.get("status"),
        has_data=bool(document.get("data")),
    )
    return document


def _is_gateway_ifsc_route_unavailable(exc: FpClientError) -> bool:
    return exc.status_code in {403, 501} or "url not available" in exc.message.lower()


def _fallback_ifsc_lookup(ifsc_code: str) -> dict[str, Any]:
    code = ifsc_code.upper().strip()
    return {
        "ifsc_code": code,
        "bank_name": "",
        "branch": "",
        "lookup_fallback": True,
    }


async def lookup_ifsc(ifsc_code: str) -> dict[str, Any]:
    from app.application.integrations.integration_runtime import is_finprim_enabled
    from app.infrastructure.kyc.cybrilla_terminal_log import log_kyc_step

    settings = get_settings()
    code = ifsc_code.upper().strip()
    use_finprim = settings.resolved_kyc_provider_live or is_finprim_enabled()

    if not use_finprim:
        raise FpClientError(
            "IFSC lookup requires Finprim onboarding API (FP_* or Kyckart live).",
            "ifsc_lookup_unavailable",
            503,
        )

    try:
        payload = await fp_get(f"/api/onb/ifsc_codes/{code}")
    except FpClientError as exc:
        if _is_gateway_ifsc_route_unavailable(exc):
            log_kyc_step(
                "ifsc_lookup_finprim_unavailable",
                ifsc_code=code,
                status_code=exc.status_code,
                error=exc.message,
            )
            return _fallback_ifsc_lookup(code)
        if exc.status_code == 404:
            raise FpClientError(
                "IFSC code not found.",
                "invalid_ifsc",
                404,
            ) from exc
        raise

    from app.application.kyc.bank_ifsc_lookup import normalize_ifsc_lookup_payload

    normalized = normalize_ifsc_lookup_payload(code, payload if isinstance(payload, dict) else {})
    log_kyc_step(
        "ifsc_lookup_finprim",
        ifsc_code=code,
        bank_name=normalized.get("bank_name"),
        branch_name=normalized.get("branch_name"),
        branch=normalized.get("branch"),
    )
    return {
        **normalized,
        "lookup_fallback": False,
    }


async def lookup_pincode(pincode: str) -> dict[str, Any]:
    from app.application.integrations.integration_runtime import is_finprim_enabled

    settings = get_settings()
    if not settings.resolved_kyc_provider_live and not is_finprim_enabled():
        raise FpClientError(
            "Pincode lookup requires Finprim onboarding API.",
            "pincode_lookup_unavailable",
            503,
        )
    try:
        payload = await fp_get(f"/api/onb/pincodes/{pincode}")
    except FpClientError as exc:
        if exc.status_code == 404:
            raise FpClientError(
                "Pincode not found.",
                "invalid_pincode",
                404,
            ) from exc
        raise
    return {
        "code": str(payload.get("code") or pincode),
        "city": str(payload.get("city") or "").strip(),
        "district": str(payload.get("district") or "").strip(),
        "state_name": str(payload.get("state_name") or "").strip(),
        "country_ansi_code": str(payload.get("country_ansi_code") or "IN").strip() or "IN",
    }


async def list_states() -> list[dict[str, str]]:
    from app.application.integrations.integration_runtime import is_finprim_enabled
    from app.application.kyc.indian_states import INDIAN_STATE_CODES, merge_indian_states

    settings = get_settings()
    if not settings.resolved_kyc_provider_live and not is_finprim_enabled():
        static_rows = [
            {"name": name, "state_code": code, "country_ansi_code": "IN"}
            for name, code in INDIAN_STATE_CODES.items()
        ]
        return merge_indian_states(static_rows)
    payload = await fp_get("/api/onb/states")
    rows: list[dict[str, str]] = []
    for item in payload.get("states", []):
        if not isinstance(item, dict):
            continue
        normalized = _normalize_state_row(item)
        if normalized:
            rows.append(normalized)
    return merge_indian_states(rows)


async def list_countries() -> list[dict[str, str]]:
    from app.application.integrations.integration_runtime import is_finprim_enabled
    from app.application.kyc.country_master import static_kyc_countries

    settings = get_settings()
    if settings.resolved_kyc_provider_live or is_finprim_enabled():
        try:
            payload = await fp_get("/api/onb/countries")
            rows: list[dict[str, str]] = []
            for item in payload.get("countries", []):
                if not isinstance(item, dict):
                    continue
                normalized = _normalize_country_row(item)
                if normalized:
                    rows.append(normalized)
            if rows:
                return rows
        except FpClientError:
            pass
    return static_kyc_countries()
