"""Read approved ZTO values for wizard input prefill only — never written to KYC journey state."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.zto_models import ZtoApprovedProfile

_APPROVED_FIELDS = {
    "name": "name_approved",
    "pan": "pan_approved",
    "date_of_birth": "dob_approved",
    "bank_account_number": "bank_account_approved",
    "ifsc_code": "ifsc_approved",
    "address_line": "address_approved",
}


async def get_approved_profile(db: AsyncSession, user_id: uuid.UUID) -> ZtoApprovedProfile | None:
    result = await db.execute(select(ZtoApprovedProfile).where(ZtoApprovedProfile.user_id == user_id))
    return result.scalar_one_or_none()


def approved_profile_to_dict(profile: ZtoApprovedProfile | None) -> dict[str, Any] | None:
    """Review-field keyed `*_approved` values (raw lookup values are never re-applied)."""
    if profile is None:
        return None
    return {field: getattr(profile, column) for field, column in _APPROVED_FIELDS.items()}


async def get_approved_prefill(db: AsyncSession, user_id: uuid.UUID) -> dict[str, Any] | None:
    return approved_profile_to_dict(await get_approved_profile(db, user_id))
