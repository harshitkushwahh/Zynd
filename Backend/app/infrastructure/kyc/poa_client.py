from __future__ import annotations

from typing import Any

from app.application.integrations.integration_runtime import is_cybrilla_poa_live
from app.infrastructure.kyc.cybrilla_terminal_log import log_poa_operation
from app.infrastructure.kyc.fp_clients import FpClientError, fp_get, fp_post, fp_post_multipart, poll_poa_preverification


def _require_live_poa() -> None:
    if not is_cybrilla_poa_live():
        raise FpClientError(
            "Cybrilla POA is not configured. Set FP_POA_* credentials.",
            "poa_not_configured",
            503,
        )


async def poa_check_readiness(pan_number: str) -> dict[str, Any]:
    _require_live_poa()
    log_poa_operation("check_readiness", live=True, pan=pan_number)

    created = await fp_post(
        "/poa/pre_verifications",
        {"investor_identifier": pan_number.upper()},
        use_poa=True,
    )
    preverify_id = str(created["id"])
    result = await poll_poa_preverification(preverify_id)
    log_poa_operation(
        "check_readiness_result",
        live=True,
        preverify_id=preverify_id,
        readiness_status=(result.get("readiness") or {}).get("status"),
        readiness_code=(result.get("readiness") or {}).get("code"),
    )
    return result


async def poa_validate_pan_name_dob(
    *,
    pan_number: str,
    full_name: str,
    date_of_birth: str,
) -> dict[str, Any]:
    _require_live_poa()
    log_poa_operation("validate_pan_name_dob", live=True, pan=pan_number)

    created = await fp_post(
        "/poa/pre_verifications",
        {
            "pan": {"value": pan_number.upper()},
            "name": {"value": full_name},
            "date_of_birth": {"value": date_of_birth},
        },
        use_poa=True,
    )
    result = await poll_poa_preverification(str(created["id"]))
    log_poa_operation(
        "validate_pan_name_dob_result",
        live=True,
        preverify_id=result.get("id"),
        pan_status=(result.get("pan") or {}).get("status") if isinstance(result.get("pan"), dict) else None,
    )
    return result


async def poa_fetch_readiness(preverify_id: str, *, pan_number: str) -> dict[str, Any]:
    _require_live_poa()
    payload = await fetch_poa_preverification(preverify_id)
    if str(payload.get("status") or "") == "completed":
        return payload
    return await poll_poa_preverification(preverify_id)


async def poa_fetch_pan_validation(
    preverify_id: str,
    *,
    pan_number: str,
    full_name: str,
    date_of_birth: str,
) -> dict[str, Any]:
    _require_live_poa()
    payload = await fetch_poa_preverification(preverify_id)
    if str(payload.get("status") or "") == "completed":
        return payload
    return await poll_poa_preverification(preverify_id)


async def poa_verify_bank_account(
    *,
    pan_number: str,
    account_holder_name: str,
    account_number: str,
    ifsc_code: str,
    account_type: str,
) -> dict[str, Any]:
    _require_live_poa()
    log_poa_operation(
        "verify_bank_hybrid",
        live=True,
        pan=pan_number,
        ifsc=ifsc_code,
        account_type=account_type,
    )

    created = await fp_post(
        "/poa/pre_verifications",
        {
            "pan": {"value": pan_number.upper()},
            "name": {"value": account_holder_name},
            "bank_accounts": [
                {
                    "value": {
                        "account_number": account_number,
                        "ifsc_code": ifsc_code.upper(),
                        "account_type": account_type,
                    },
                }
            ],
        },
        use_poa=True,
    )
    result = await poll_poa_preverification(str(created["id"]))
    log_poa_operation("verify_bank_hybrid_result", live=True, preverify_id=result.get("id"))
    return result


async def poa_verify_bank_account_manual(
    *,
    pan_number: str,
    account_holder_name: str,
    account_number: str,
    ifsc_code: str,
    account_type: str,
    proof_file_id: str,
) -> dict[str, Any]:
    _require_live_poa()
    log_poa_operation("verify_bank_manual", live=True, pan=pan_number, ifsc=ifsc_code)

    created = await fp_post(
        "/poa/pre_verifications",
        {
            "pan": {"value": pan_number.upper()},
            "name": {"value": account_holder_name},
            "bank_accounts": [
                {
                    "value": {
                        "account_number": account_number,
                        "ifsc_code": ifsc_code.upper(),
                        "account_type": account_type,
                        "bank_account_proof": proof_file_id,
                    },
                    "verify_manually_if_required": True,
                }
            ],
        },
        use_poa=True,
    )
    result = await poll_poa_preverification(str(created["id"]))
    log_poa_operation("verify_bank_manual_result", live=True, preverify_id=result.get("id"))
    return result


async def fetch_poa_preverification(preverify_id: str) -> dict[str, Any]:
    _require_live_poa()
    return await fp_get(f"/poa/pre_verifications/{preverify_id}", use_poa=True)


async def upload_poa_file(
    *,
    file_bytes: bytes,
    filename: str,
    content_type: str,
    purpose: str,
) -> dict[str, Any]:
    _require_live_poa()
    log_poa_operation("upload_file", live=True, filename=filename, purpose=purpose)

    return await fp_post_multipart(
        "/poa/files",
        fields={"purpose": purpose},
        files={"file": (filename, file_bytes, content_type)},
        use_poa=True,
    )
