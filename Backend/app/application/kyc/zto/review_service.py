from __future__ import annotations

from typing import Any, Mapping

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.kyc.zto.constants import FETCH_SUCCESS, LOOKUP_KIND_BANK, LOOKUP_KIND_CUSTOMER
from app.application.kyc.zto.errors import ZtoError
from app.application.kyc.zto.flow_service import load_decrypted_payloads
from app.application.kyc.zto.normalize import (
    REVIEW_FIELDS,
    ZtoValidationError,
    build_lookup_snapshot,
    validate_review_field,
)
from app.application.kyc.zto.phase import ZtoPhase, get_flow, is_review_required, resolve_phase_from_flow
from app.application.kyc.zto.prefill_service import approved_profile_to_dict, get_approved_profile
from app.application.shared.datetime_utils import utcnow
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.zto_models import ZtoApprovedProfile

# review field -> zto_approved_profile column prefix
_COLUMN_PREFIX = {
    "name": "name",
    "pan": "pan",
    "date_of_birth": "dob",
    "bank_account_number": "bank_account",
    "ifsc_code": "ifsc",
    "address_line": "address",
}


def _require_enabled(settings: Settings) -> None:
    if not settings.zto_enabled:
        raise ZtoError("Zero-touch lookup is not enabled.", "zto_disabled", 404)


async def build_review_data(
    db: AsyncSession, *, user: User, settings: Settings | None = None
) -> dict[str, Any]:
    """Review DTO: initial form values while pending, approved snapshot once accepted."""
    settings = settings or get_settings()
    _require_enabled(settings)
    flow = await get_flow(db, user.id)
    phase = resolve_phase_from_flow(flow, enabled=True)
    data: dict[str, Any] = {
        "phase": phase.value,
        "review_required": is_review_required(phase),
        "fields": None,
        "lookup_name": None,
        "bank_available": False,
        "customer_available": False,
        "approved": None,
    }
    if phase == ZtoPhase.ACCEPTED:
        data["approved"] = approved_profile_to_dict(await get_approved_profile(db, user.id))
    if phase != ZtoPhase.REVIEW_PENDING:
        return data

    bank_payload, customer_payload, _ = await load_decrypted_payloads(db, user.id)
    snapshot = build_lookup_snapshot(bank_payload, customer_payload)
    fields = dict(snapshot)
    # Name shown first is what the user typed at signup; lookup name is only a comparison value.
    fields["name"] = (flow.signup_display_name if flow else None) or snapshot["name"]
    data.update(
        fields=fields,
        lookup_name=snapshot["name"],
        bank_available=bank_payload is not None,
        customer_available=customer_payload is not None,
    )
    return data


def _is_edited(approved: str | None, from_lookup: str | None) -> bool:
    return (approved or "") != (from_lookup or "")


def _compare_key(field: str, value: str | None) -> str | None:
    # Names compare case-insensitively so trivial casing does not mark edited.
    return value.casefold() if field == "name" and value else value


async def accept_review(
    db: AsyncSession,
    *,
    user: User,
    submitted: Mapping[str, Any],
    settings: Settings | None = None,
) -> ZtoApprovedProfile:
    settings = settings or get_settings()
    _require_enabled(settings)
    flow = await get_flow(db, user.id)
    if resolve_phase_from_flow(flow, enabled=True) != ZtoPhase.REVIEW_PENDING:
        raise ZtoError("No lookup review is pending.", "zto_review_not_pending", 409)

    approved_values: dict[str, str | None] = {}
    for field in REVIEW_FIELDS:
        try:
            approved_values[field] = validate_review_field(field, submitted.get(field))
        except ZtoValidationError as exc:
            raise ZtoError(exc.message, f"zto_invalid_{field}", 422) from exc

    bank_payload, customer_payload, fetches = await load_decrypted_payloads(db, user.id)
    snapshot = build_lookup_snapshot(bank_payload, customer_payload)

    profile = await get_approved_profile(db, user.id)
    if profile is None:
        profile = ZtoApprovedProfile(user_id=user.id, accepted_at=utcnow())
        db.add(profile)
    profile.accepted_at = utcnow()
    bank_fetch = fetches.get(LOOKUP_KIND_BANK)
    customer_fetch = fetches.get(LOOKUP_KIND_CUSTOMER)
    profile.bank_lookup_id = bank_fetch.id if bank_fetch and bank_fetch.status == FETCH_SUCCESS else None
    profile.customer_lookup_id = customer_fetch.id if customer_fetch and customer_fetch.status == FETCH_SUCCESS else None

    for field, prefix in _COLUMN_PREFIX.items():
        from_lookup = snapshot.get(field)
        approved = approved_values[field]
        setattr(profile, f"{prefix}_from_lookup", from_lookup)
        setattr(profile, f"{prefix}_approved", approved)
        setattr(
            profile,
            f"{prefix}_edited",
            _is_edited(_compare_key(field, approved), _compare_key(field, from_lookup)),
        )

    flow.phase = ZtoPhase.ACCEPTED.value
    flow.declined_at = None
    await db.flush()
    return profile


async def decline_review(
    db: AsyncSession, *, user: User, settings: Settings | None = None
) -> None:
    """Decline: no approved profile is written; encrypted fetches are retained for audit."""
    settings = settings or get_settings()
    _require_enabled(settings)
    flow = await get_flow(db, user.id)
    if resolve_phase_from_flow(flow, enabled=True) != ZtoPhase.REVIEW_PENDING:
        raise ZtoError("No lookup review is pending.", "zto_review_not_pending", 409)
    flow.phase = ZtoPhase.DECLINED.value
    flow.declined_at = utcnow()
    await db.flush()
