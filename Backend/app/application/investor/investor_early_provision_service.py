"""Early Cybrilla investor profile provisioning during KYC (after PAN confirmation)."""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.investor.investor_profile_service import (
    mark_investor_profile_active,
    mark_investor_profile_failed,
    mark_investor_profile_provisioning,
)
from app.application.investor.investor_provision_mapper import (
    InvestorProvisionValidationError,
    build_early_investor_profile_payload,
)
from app.core.config import get_settings
from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.mf.fp_investor_client import create_investor_profile
from app.infrastructure.persistence.investor_models import (
    InvestorEmailAddress,
    InvestorObjectSource,
    InvestorObjectSyncStatus,
    InvestorPhoneNumber,
    InvestorProfile,
    InvestorProfileStatus,
    InvestorProvisionTrigger,
)
from app.infrastructure.persistence.models import KycJourneyState, User
from app.infrastructure.persistence.repositories.investor_profile_repository import (
    get_or_create_pending_investor_profile,
)

logger = logging.getLogger(__name__)


def _stub_investor_profile_id(user_id) -> str:
    return f"invp_stub_{user_id.hex[:24]}"


async def _seed_email_phone_drafts(
    db: AsyncSession,
    *,
    profile: InvestorProfile,
    user: User,
) -> None:
    existing_email = await db.scalar(
        select(InvestorEmailAddress).where(InvestorEmailAddress.investor_profile_id == profile.user_id)
    )
    if not existing_email and user.email:
        db.add(
            InvestorEmailAddress(
                investor_profile_id=profile.user_id,
                email=user.email.lower(),
                is_primary=True,
                source=InvestorObjectSource.user,
                sync_status=InvestorObjectSyncStatus.draft,
                belongs_to="self",
            )
        )

    existing_phone = await db.scalar(
        select(InvestorPhoneNumber).where(InvestorPhoneNumber.investor_profile_id == profile.user_id)
    )
    if not existing_phone and user.phone:
        raw = user.phone.strip()
        isd = "+91"
        number = raw
        if raw.startswith("+91"):
            number = raw[3:].lstrip()
        number = "".join(ch for ch in number if ch.isdigit())[-10:]
        if number:
            db.add(
                InvestorPhoneNumber(
                    investor_profile_id=profile.user_id,
                    isd=isd,
                    number=number,
                    is_primary=True,
                    source=InvestorObjectSource.user,
                    sync_status=InvestorObjectSyncStatus.draft,
                    belongs_to="self",
                )
            )
    await db.flush()


async def ensure_investor_profile_after_pan_confirm(
    db: AsyncSession,
    *,
    user: User,
    journey: KycJourneyState,
) -> InvestorProfile:
    """Create local + Finprim investor profile once PAN names are confirmed."""
    profile = await get_or_create_pending_investor_profile(
        db,
        user_id=user.id,
        provision_trigger=InvestorProvisionTrigger.manual,
    )
    profile.metadata_json = {
        **(profile.metadata_json or {}),
        "provisioned_at_pan": True,
    }
    await _seed_email_phone_drafts(db, profile=profile, user=user)

    if profile.external_profile_id:
        return profile

    if profile.status == InvestorProfileStatus.failed:
        profile.status = InvestorProfileStatus.pending
        profile.failure_code = None
        profile.failure_reason = None
        await db.flush()

    settings = get_settings()
    if not settings.resolved_fp_enabled:
        profile.external_profile_id = _stub_investor_profile_id(user.id)
        profile.status = InvestorProfileStatus.active
        profile.metadata_json = {
            **(profile.metadata_json or {}),
            "stub_profile": True,
        }
        await db.flush()
        return profile

    try:
        payload = build_early_investor_profile_payload(user=user, journey=journey)
    except InvestorProvisionValidationError as exc:
        logger.warning("Skipping early investor profile for user=%s: %s", user.id, exc.message)
        await mark_investor_profile_failed(
            db,
            profile,
            failure_code=exc.code,
            failure_reason=exc.message,
        )
        return profile

    await mark_investor_profile_provisioning(db, profile)
    try:
        created = await create_investor_profile(payload)
        profile_id = created.get("id")
        if not profile_id:
            raise InvestorProvisionValidationError(
                "fp_profile_missing",
                "Finprim did not return investor profile id",
            )
        await mark_investor_profile_active(
            db,
            profile,
            external_profile_id=profile_id,
            external_old_id=created.get("old_id"),
        )
    except (FpClientError, InvestorProvisionValidationError) as exc:
        code = getattr(exc, "code", "fp_profile_failed")
        message = getattr(exc, "message", str(exc))
        await mark_investor_profile_failed(db, profile, failure_code=code, failure_reason=message)
        logger.exception("Early investor profile provisioning failed user=%s", user.id)

    return profile


__all__ = ["ensure_investor_profile_after_pan_confirm"]
