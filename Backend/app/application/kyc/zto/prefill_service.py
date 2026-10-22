"""Read approved ZTO values for wizard input prefill only — never written to KYC journey state."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.kyc.zto.normalize import (
    ADDRESS_REVIEW_FIELDS,
    address_parts_from_storage,
    format_address_display,
)
from app.infrastructure.persistence.zto_models import ZtoApprovedProfile

_APPROVED_FIELDS = {
    "name": "name_approved",
    "pan": "pan_approved",
    "date_of_birth": "dob_approved",
    "bank_account_number": "bank_account_approved",
    "ifsc_code": "ifsc_approved",
}


async def get_approved_profile(db: AsyncSession, user_id: uuid.UUID) -> ZtoApprovedProfile | None:
    result = await db.execute(select(ZtoApprovedProfile).where(ZtoApprovedProfile.user_id == user_id))
    return result.scalar_one_or_none()


def approved_profile_to_dict(profile: ZtoApprovedProfile | None) -> dict[str, Any] | None:
    """Review-field keyed `*_approved` values (raw lookup values are never re-applied)."""
    if profile is None:
        return None
    result = {field: getattr(profile, column) for field, column in _APPROVED_FIELDS.items()}
    address_parts = address_parts_from_storage(profile.address_approved)
    for key in ADDRESS_REVIEW_FIELDS:
        result[key] = address_parts.get(key)
    result["address_line"] = format_address_display(address_parts)
    return result


async def get_approved_prefill(db: AsyncSession, user_id: uuid.UUID) -> dict[str, Any] | None:
    return approved_profile_to_dict(await get_approved_profile(db, user_id))
