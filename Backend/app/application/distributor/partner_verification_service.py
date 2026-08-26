from __future__ import annotations

import re
from typing import Any

from app.application.kyc.bank_verification_core import (
    BankVerificationError,
    resolve_ifsc_details,
    run_hybrid_bank_verification,
    validate_ifsc_format,
)
from app.application.distributor.partner_onboarding_service import PartnerOnboardingError
from app.infrastructure.kyc.kyckart_client import KyckartError, kyckart_pan_to_name_dob
from app.infrastructure.persistence.partner_onboarding_draft_store import (
    get_partner_onboarding_draft,
    update_partner_onboarding_draft,
)

_PAN_PATTERN = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")


async def _load_draft(token: str) -> dict[str, Any]:
    draft = await get_partner_onboarding_draft(token)
    if not draft:
        raise PartnerOnboardingError(
            "Onboarding session expired. Please start again.",
            "onboarding_expired",
            410,
        )
    return draft


async def verify_partner_onboarding_pan(
    *,
    onboarding_token: str,
    pan: str,
) -> dict[str, str | bool]:
    draft = await _load_draft(onboarding_token)
    if not draft.get("email_verified") or not draft.get("mobile_verified"):
        raise PartnerOnboardingError(
            "Verify email and mobile before verifying PAN.",
            "contact_not_verified",
            400,
        )

    normalized = pan.strip().upper()
    if not _PAN_PATTERN.fullmatch(normalized):
        raise PartnerOnboardingError("Enter a valid PAN.", "invalid_pan", 400)

    try:
        kyckart = await kyckart_pan_to_name_dob(normalized)
    except KyckartError as exc:
        raise PartnerOnboardingError(exc.message, exc.code, exc.status_code) from exc

    if kyckart.get("panCategory") == "corporate":
        raise PartnerOnboardingError(
            "Corporate PAN cards cannot be used for Zynd Mitra onboarding.",
            "corporate_pan",
            400,
        )

    verified_name = str(kyckart.get("fullName") or "").strip()
    if not verified_name:
        raise PartnerOnboardingError(
            "Could not fetch PAN holder name.",
            "kyckart_incomplete",
            502,
        )

    await update_partner_onboarding_draft(
        onboarding_token,
        {
            "pan": normalized,
            "pan_verified": True,
            "pan_verified_name": verified_name,
        },
    )
    return {"verified": True, "verified_name": verified_name}


async def verify_partner_onboarding_bank(
    *,
    onboarding_token: str,
    account_number: str,
    account_type: str,
    ifsc: str,
) -> dict[str, str | bool]:
    draft = await _load_draft(onboarding_token)
    if not draft.get("pan_verified"):
        raise PartnerOnboardingError("Verify PAN before verifying the bank account.", "pan_not_verified", 400)

    pan_number = str(draft.get("pan") or "").strip().upper()
    if not pan_number:
        raise PartnerOnboardingError("Verify PAN before verifying the bank account.", "pan_not_verified", 400)

    pan_verified_name = str(draft.get("pan_verified_name") or "").strip()
    pan_draft = {"fullName": pan_verified_name}

    account_no = re.sub(r"\D", "", account_number)
    if len(account_no) < 9:
        raise PartnerOnboardingError("Enter a valid account number.", "invalid_account_number", 400)

    try:
        outcome = await run_hybrid_bank_verification(
            pan_draft=pan_draft,
            pan_number=pan_number,
            account_number=account_no,
            account_type=account_type,
            ifsc_code=ifsc,
            kyc_already_registered=None,
        )
    except BankVerificationError as exc:
        raise PartnerOnboardingError(exc.message, exc.code, exc.status_code) from exc

    if outcome.requires_manual and not outcome.bank_verified:
        reason = (outcome.failure or {}).get("reason") or "Bank account requires manual verification."
        raise PartnerOnboardingError(reason, "bank_manual_required", 400)

    if not outcome.bank_verified:
        reason = (outcome.failure or {}).get("reason") or "Bank account verification failed."
        code = str((outcome.failure or {}).get("code") or "bank_verification_failed")
        raise PartnerOnboardingError(reason, code, 400)

    display_holder = outcome.kyckart_holder_name or outcome.pan_holder_name
    bank_payload = {
        "account_holder_name": display_holder,
        "account_number": account_no,
        "account_type": outcome.account_type_label,
        "ifsc": outcome.ifsc_code,
        "bank_name": outcome.bank_name,
        "branch_name": (outcome.branch or "").strip() or None,
        "verified_holder_name": display_holder,
        "poa_preverify_id": outcome.preverify_id or None,
        "verification_mode": "auto",
    }
    await update_partner_onboarding_draft(
        onboarding_token,
        {
            "bank": bank_payload,
            "bank_verified": True,
        },
    )
    return {
        "verified": True,
        "verified_holder_name": display_holder,
        "bank_name": outcome.bank_name,
        "branch_name": outcome.branch or "",
        "account_type": outcome.account_type_label,
        "verification_mode": "auto",
    }


async def verify_partner_onboarding_bank_manual(
    *,
    onboarding_token: str,
    account_holder_name: str,
    account_number: str,
    confirm_account_number: str,
    account_type: str,
    ifsc: str,
    bank_name: str,
    branch_name: str,
) -> dict[str, str | bool]:
    draft = await _load_draft(onboarding_token)
    if not draft.get("pan_verified"):
        raise PartnerOnboardingError("Verify PAN before verifying the bank account.", "pan_not_verified", 400)

    account_no = re.sub(r"\D", "", account_number)
    confirm_no = re.sub(r"\D", "", confirm_account_number)
    if len(account_no) < 9:
        raise PartnerOnboardingError("Enter a valid account number.", "invalid_account_number", 400)
    if account_no != confirm_no:
        raise PartnerOnboardingError("Account numbers do not match.", "account_number_mismatch", 400)

    holder = account_holder_name.strip()
    bank = bank_name.strip()
    branch = branch_name.strip()
    if len(holder) < 3:
        raise PartnerOnboardingError("Enter the account holder name.", "invalid_account_holder", 400)
    if len(bank) < 2:
        raise PartnerOnboardingError("Enter the bank name.", "invalid_bank_name", 400)
    if len(branch) < 2:
        raise PartnerOnboardingError("Enter the branch name.", "invalid_branch_name", 400)

    try:
        ifsc_code = validate_ifsc_format(ifsc)
        resolved_ifsc, resolved_bank_name, resolved_branch = await resolve_ifsc_details(ifsc_code)
    except BankVerificationError as exc:
        raise PartnerOnboardingError(exc.message, exc.code, exc.status_code) from exc

    from app.application.kyc.bank_verification_core import map_account_type

    try:
        map_account_type(account_type)
    except BankVerificationError as exc:
        raise PartnerOnboardingError(exc.message, exc.code, exc.status_code) from exc

    bank_payload = {
        "account_holder_name": holder,
        "account_number": account_no,
        "confirm_account_number": confirm_no,
        "account_type": account_type.strip(),
        "ifsc": resolved_ifsc,
        "bank_name": bank or resolved_bank_name,
        "branch_name": branch or resolved_branch or None,
        "verified_holder_name": holder,
        "verification_mode": "manual",
    }
    await update_partner_onboarding_draft(
        onboarding_token,
        {
            "bank": bank_payload,
            "bank_verified": True,
        },
    )
    return {
        "verified": True,
        "verified_holder_name": holder,
        "bank_name": bank_payload["bank_name"],
        "branch_name": bank_payload.get("branch_name") or "",
        "account_type": account_type.strip(),
        "verification_mode": "manual",
    }
