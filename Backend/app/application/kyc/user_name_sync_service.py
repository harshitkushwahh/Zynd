from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import KycJourneyState, User

NAME_MAX_LENGTH = 50


def _truncate(value: str) -> str:
    return value.strip()[:NAME_MAX_LENGTH]


def names_from_pan_draft(pan_draft: dict[str, Any]) -> tuple[str | None, str | None, str | None]:
    first = str(pan_draft.get("firstName") or "").strip()
    middle = str(pan_draft.get("middleName") or "").strip()
    last = str(pan_draft.get("lastName") or "").strip()
    single_name_only = bool(pan_draft.get("singleNameOnly"))

    if first and last:
        return _truncate(first), _truncate(middle) if middle else None, _truncate(last)

    if first and single_name_only:
        return _truncate(first), _truncate(middle) if middle else None, None

    full = str(pan_draft.get("fullName") or "").strip()
    if full:
        parts = full.split()
        if len(parts) == 1:
            return _truncate(parts[0]), None, None
        if len(parts) == 2:
            return _truncate(parts[0]), None, _truncate(parts[1])
        return _truncate(parts[0]), _truncate(" ".join(parts[1:-1])), _truncate(parts[-1])

    if first:
        return _truncate(first), _truncate(middle) if middle else None, _truncate(last) if last else None

    return None, None, None


async def sync_user_name_from_verified_kyc(
    db: AsyncSession,
    *,
    user: User,
    journey: KycJourneyState,
) -> bool:
    """Replace signup name with PAN-verified identity once PAN is verified."""
    if journey.pan_verification_status != "verified":
        return False

    pan_draft = journey.pan_draft_json or {}
    first, middle, last = names_from_pan_draft(pan_draft)
    if not first:
        return False

    single_name_only = bool(pan_draft.get("singleNameOnly"))
    if not last and not single_name_only:
        return False

    changed = False
    if user.first_name != first:
        user.first_name = first
        changed = True
    if user.middle_name != middle:
        user.middle_name = middle
        changed = True
    if user.last_name != last:
        user.last_name = last
        changed = True

    if changed:
        await db.flush()
    return changed
