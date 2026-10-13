"""MF transaction OTP consent — Zynd platform record + delivery; not Cybrilla consent storage."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.consent.consent_service import ConsentAcceptContext, record_acceptance
from app.application.identity.otp_app_service import (
    OtpCooldownError,
    OtpPurpose,
    OtpRateLimitError,
    request_otp_mobile_and_email,
    verify_otp,
)
from app.application.mf.mf_order_errors import MfOrderError
from app.domain.consent.keys import MF_TRANSACTION_AUTHORIZATION
from app.infrastructure.persistence.models import User

logger = logging.getLogger(__name__)

MfTransactionConsentKind = str  # switch | redemption | stp | swp | lumpsum | sip


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def send_mf_transaction_consent_otp(
    *,
    identifier: str,
    email: str | None,
    mobile: str | None,
    ip: str | None = None,
) -> dict[str, Any]:
    """Send one OTP (SMS + email when available). Same code on both channels."""
    if not mobile or not str(mobile).strip():
        raise MfOrderError(
            code="consent_contact_missing",
            message="Folio registered mobile is unavailable",
            status_code=409,
        )
    mobile = str(mobile).strip()
    email_clean = str(email).strip() if email else None
    try:
        otp_meta = await request_otp_mobile_and_email(
            OtpPurpose.fund_confirmation,
            identifier,
            ip=ip,
            mobile=mobile,
            email=email_clean,
        )
    except (OtpCooldownError, OtpRateLimitError) as exc:
        raise MfOrderError(code="otp_rate_limited", message=str(exc), status_code=429) from exc

    from app.application.mf.mf_consent_contact_mask import mask_mf_consent_email, mask_mf_consent_mobile

    return {
        "identifier": identifier,
        "masked_mobile": mask_mf_consent_mobile(mobile),
        "masked_email": mask_mf_consent_email(email_clean) if email_clean else None,
        **otp_meta,
    }


async def verify_mf_transaction_consent_otp(
    session: AsyncSession,
    *,
    user: User,
    identifier: str,
    otp: str,
    transaction_kind: MfTransactionConsentKind,
    subject_id: uuid.UUID,
    ip: str | None = None,
    user_agent: str | None = None,
    extra_metadata: dict[str, Any] | None = None,
) -> uuid.UUID:
    """
    Verify OTP, persist platform consent acceptance (audit + user_consent_records), return record id.
    Does not send consent to Cybrilla — callers attach AMC consent only where FP requires it.
    """
    code = (otp or "").strip()
    if not code:
        raise MfOrderError(code="invalid_otp", message="OTP is required", status_code=400)
    if not await verify_otp(OtpPurpose.fund_confirmation, identifier, code):
        raise MfOrderError(code="invalid_otp", message="Invalid or expired OTP", status_code=400)

    metadata = {
        "transaction_kind": transaction_kind,
        "subject_id": str(subject_id),
        "otp_purpose": OtpPurpose.fund_confirmation.value,
        "otp_identifier": identifier,
        "verified_at": _utc_iso(),
        **(extra_metadata or {}),
    }
    record = await record_acceptance(
        session,
        user=user,
        definition_key=MF_TRANSACTION_AUTHORIZATION,
        context=ConsentAcceptContext(
            source="mf_transaction",
            ip=ip,
            user_agent=user_agent,
            metadata=metadata,
        ),
    )
    logger.info(
        "MF transaction consent recorded user=%s kind=%s subject=%s record=%s",
        user.id,
        transaction_kind,
        subject_id,
        record.id,
    )
    return record.id


def merge_platform_consent_metadata(
    meta: dict[str, Any],
    *,
    consent_record_id: uuid.UUID,
) -> dict[str, Any]:
    return {
        **meta,
        "awaiting_transaction_consent": False,
        "platform_consent_record_id": str(consent_record_id),
        "platform_consent_accepted_at": _utc_iso(),
        "platform_consent_key": MF_TRANSACTION_AUTHORIZATION,
    }
