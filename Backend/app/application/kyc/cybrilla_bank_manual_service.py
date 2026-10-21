from __future__ import annotations

import logging
from typing import Any

from app.infrastructure.core.kyc.fp_clients import FpClientError
from app.infrastructure.core.kyc.poa_client import poa_verify_bank_account_uncertain_manual

logger = logging.getLogger(__name__)

# Cybrilla manual review without proof applies to resident savings/current per POA docs.
_UNCERTAIN_MANUAL_ACCOUNT_TYPES = frozenset({"savings", "current"})


async def request_cybrilla_uncertain_manual_review(
    *,
    pan_number: str,
    account_holder_name: str,
    account_number: str,
    ifsc_code: str,
    poa_account_type: str,
    uncertain_preverify_id: str | None = None,
) -> dict[str, Any] | None:
    """
    Create a follow-up pre_verification with verify_manually_if_required=true.
    Returns the completed POA payload, or None if enqueue failed (KYC may still continue).
    """
    account_type = str(poa_account_type or "").strip().lower()
    if account_type not in _UNCERTAIN_MANUAL_ACCOUNT_TYPES:
        logger.info(
            "cybrilla_uncertain_manual_skipped unsupported_account_type=%s preverify_id=%s",
            account_type,
            uncertain_preverify_id,
        )
        return None

    if not account_holder_name.strip():
        logger.warning(
            "cybrilla_uncertain_manual_skipped missing_holder_name preverify_id=%s",
            uncertain_preverify_id,
        )
        return None

    try:
        result = await poa_verify_bank_account_uncertain_manual(
            pan_number=pan_number,
            account_holder_name=account_holder_name,
            account_number=account_number,
            ifsc_code=ifsc_code,
            account_type=account_type,
        )
    except FpClientError as exc:
        logger.warning(
            "cybrilla_uncertain_manual_enqueue_failed preverify_id=%s code=%s message=%r",
            uncertain_preverify_id,
            exc.code,
            exc.message,
        )
        return None

    logger.info(
        "cybrilla_uncertain_manual_enqueued uncertain_preverify_id=%s manual_preverify_id=%s",
        uncertain_preverify_id,
        result.get("id"),
    )
    return result
