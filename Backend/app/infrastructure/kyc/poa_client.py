from __future__ import annotations

from typing import Any

from app.infrastructure.kyc.fp_clients import fp_get, fp_post, fp_post_multipart, poll_poa_preverification
from app.infrastructure.kyc.stub_provider import (
    stub_poa_bank_validation,
    stub_poa_bank_validation_manual,
    stub_poa_file_upload,
    stub_poa_pan_validation,
    stub_poa_readiness,
)
from app.core.config import get_settings


async def poa_check_readiness(pan_number: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.resolved_kyc_provider_live:
        return await stub_poa_readiness(pan_number)

    created = await fp_post(
        "/poa/pre_verifications",
        {"investor_identifier": pan_number.upper()},
        use_poa=True,
    )
    preverify_id = str(created["id"])
    return await poll_poa_preverification(preverify_id)


async def poa_validate_pan_name_dob(
    *,
    pan_number: str,
    full_name: str,
    date_of_birth: str,
) -> dict[str, Any]:
    settings = get_settings()
    if not settings.resolved_kyc_provider_live:
        return await stub_poa_pan_validation(
            pan_number=pan_number,
            full_name=full_name,
            date_of_birth=date_of_birth,
        )

    created = await fp_post(
        "/poa/pre_verifications",
        {
            "pan": {"value": pan_number.upper()},
            "name": {"value": full_name},
            "date_of_birth": {"value": date_of_birth},
        },
        use_poa=True,
    )
    return await poll_poa_preverification(str(created["id"]))


async def poa_verify_bank_account(
    *,
    pan_number: str,
    account_holder_name: str,
    account_number: str,
    ifsc_code: str,
    account_type: str,
) -> dict[str, Any]:
    settings = get_settings()
    if not settings.resolved_kyc_provider_live:
        return await stub_poa_bank_validation(
            pan_number=pan_number,
            account_number=account_number,
            ifsc_code=ifsc_code,
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
    return await poll_poa_preverification(str(created["id"]))


async def poa_verify_bank_account_manual(
    *,
    pan_number: str,
    account_holder_name: str,
    account_number: str,
    ifsc_code: str,
    account_type: str,
    proof_file_id: str,
) -> dict[str, Any]:
    settings = get_settings()
    if not settings.resolved_kyc_provider_live:
        return await stub_poa_bank_validation_manual(
            pan_number=pan_number,
            account_number=account_number,
            ifsc_code=ifsc_code,
            account_type=account_type,
            proof_file_id=proof_file_id,
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
                        "bank_account_proof": proof_file_id,
                    },
                    "verify_manually_if_required": True,
                }
            ],
        },
        use_poa=True,
    )
    return await poll_poa_preverification(str(created["id"]))


async def fetch_poa_preverification(preverify_id: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.resolved_kyc_provider_live:
        return {"id": preverify_id, "status": "completed", "bank_accounts": [{"status": "verified"}]}
    return await fp_get(f"/poa/pre_verifications/{preverify_id}", use_poa=True)


async def upload_poa_file(
    *,
    file_bytes: bytes,
    filename: str,
    content_type: str,
    purpose: str,
) -> dict[str, Any]:
    settings = get_settings()
    if not settings.resolved_kyc_provider_live:
        return await stub_poa_file_upload(filename=filename)

    return await fp_post_multipart(
        "/poa/files",
        fields={"purpose": purpose},
        files={"file": (filename, file_bytes, content_type)},
        use_poa=True,
    )
