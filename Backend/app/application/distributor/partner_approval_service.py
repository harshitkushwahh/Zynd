from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.distributor.partner_onboarding_notifications import send_partner_set_password_email
from app.application.documents.profile_image_url_service import resolve_profile_image_urls_by_user_id
from app.application.shared.datetime_utils import utcnow
from app.application.distributor.distributor_branch_service import get_distributor_branch_by_id
from app.infrastructure.persistence.distributor_partner_models import DistributorPartner, DistributorPartnerStatus
from app.infrastructure.persistence.models import AuditEventType, AuditLog, User

_ARN_PATTERN = re.compile(r"^[A-Z0-9/-]{4,32}$", re.IGNORECASE)


class PartnerApprovalError(Exception):
    def __init__(self, message: str, code: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


def _partner_display_name(user: User) -> str:
    return " ".join(
        part for part in [user.first_name, user.middle_name, user.last_name] if part
    ).strip() or user.email


def _serialize_partner(
    partner: DistributorPartner,
    user: User,
    *,
    profile_image_url: str | None,
    manager_name: str | None = None,
    branch_id: str | None = None,
    branch_name: str | None = None,
) -> dict[str, Any]:
    return {
        "id": str(partner.id),
        "user_id": str(user.id),
        "name": _partner_display_name(user),
        "email": user.email,
        "phone": user.phone,
        "pan_masked": partner.pan_masked,
        "arn": partner.arn or "",
        "euin": partner.euin or "",
        "status": partner.status.value,
        "profile_payload": partner.profile_payload or {},
        "profile_image_url": profile_image_url,
        "onboarded_by_user_id": str(partner.onboarded_by_user_id) if partner.onboarded_by_user_id else None,
        "ho_reviewed_at": partner.ho_reviewed_at,
        "ho_rejection_reason": partner.ho_rejection_reason,
        "created_at": partner.created_at,
        "manager_name": manager_name,
        "branch_id": branch_id or partner.branch_id,
        "branch_name": branch_name,
    }


async def _partner_review_context(
    db: AsyncSession,
    partner: DistributorPartner,
) -> tuple[str | None, str | None, str | None]:
    manager_name = None
    branch_name = None
    branch_id = partner.branch_id
    if partner.onboarded_by_user_id:
        manager = await db.get(User, partner.onboarded_by_user_id)
        if manager:
            manager_name = _partner_display_name(manager)
    if partner.branch_id:
        branch = await get_distributor_branch_by_id(db, partner.branch_id)
        if branch:
            branch_name = branch.name
            branch_id = branch.id
    return manager_name, branch_id, branch_name


async def list_pending_distributor_partners(db: AsyncSession) -> list[dict[str, Any]]:
    result = await db.execute(
        select(DistributorPartner, User)
        .join(User, User.id == DistributorPartner.user_id)
        .where(DistributorPartner.status == DistributorPartnerStatus.pending_ho_review)
        .order_by(DistributorPartner.created_at.asc())
    )
    rows = result.all()
    profile_images = await resolve_profile_image_urls_by_user_id(db, [user.id for _, user in rows])
    items: list[dict[str, Any]] = []
    for partner, user in rows:
        manager_name, branch_id, branch_name = await _partner_review_context(db, partner)
        items.append(
            _serialize_partner(
                partner,
                user,
                profile_image_url=profile_images.get(user.id),
                manager_name=manager_name,
                branch_id=branch_id,
                branch_name=branch_name,
            )
        )
    return items


async def get_distributor_partner_for_review(
    db: AsyncSession,
    *,
    partner_id: UUID,
) -> dict[str, Any] | None:
    result = await db.execute(
        select(DistributorPartner, User)
        .join(User, User.id == DistributorPartner.user_id)
        .where(DistributorPartner.id == partner_id)
    )
    row = result.one_or_none()
    if not row:
        return None
    partner, user = row
    profile_images = await resolve_profile_image_urls_by_user_id(db, [user.id])
    manager_name, branch_id, branch_name = await _partner_review_context(db, partner)
    return _serialize_partner(
        partner,
        user,
        profile_image_url=profile_images.get(user.id),
        manager_name=manager_name,
        branch_id=branch_id,
        branch_name=branch_name,
    )


async def approve_distributor_partner(
    db: AsyncSession,
    *,
    reviewer: User,
    partner_id: UUID,
    arn: str,
    euin: str | None,
    ip: str | None,
) -> dict[str, Any]:
    normalized_arn = arn.strip().upper()
    if not _ARN_PATTERN.fullmatch(normalized_arn):
        raise PartnerApprovalError("Enter a valid ARN.", "invalid_arn", 400)

    result = await db.execute(
        select(DistributorPartner, User)
        .join(User, User.id == DistributorPartner.user_id)
        .where(DistributorPartner.id == partner_id)
    )
    row = result.one_or_none()
    if not row:
        raise PartnerApprovalError("Partner application not found.", "partner_not_found", 404)
    partner, user = row

    if partner.status != DistributorPartnerStatus.pending_ho_review:
        raise PartnerApprovalError(
            "This application is not awaiting HO review.",
            "invalid_partner_status",
            400,
        )

    existing = await db.execute(
        select(DistributorPartner).where(
            DistributorPartner.arn == normalized_arn,
            DistributorPartner.id != partner.id,
        )
    )
    if existing.scalar_one_or_none():
        raise PartnerApprovalError("This ARN is already assigned.", "arn_already_assigned", 409)

    now = utcnow()
    partner.arn = normalized_arn
    partner.euin = (euin or "").strip() or None
    partner.status = DistributorPartnerStatus.pending_password
    partner.ho_reviewed_by_user_id = reviewer.id
    partner.ho_reviewed_at = now
    partner.ho_rejection_reason = None

    db.add(
        AuditLog(
            user_id=reviewer.id,
            event_type=AuditEventType.admin_action_requested,
            ip_address=ip,
            metadata_={
                "kind": "distributor_partner_approved",
                "partner_id": str(partner.id),
                "partner_user_id": str(user.id),
                "arn": normalized_arn,
            },
        )
    )
    await db.flush()
    await send_partner_set_password_email(user)

    return {
        "partner_id": str(partner.id),
        "status": partner.status.value,
        "arn": partner.arn,
        "euin": partner.euin,
    }


async def reject_distributor_partner(
    db: AsyncSession,
    *,
    reviewer: User,
    partner_id: UUID,
    reason: str,
    ip: str | None,
) -> dict[str, Any]:
    cleaned_reason = reason.strip()
    if len(cleaned_reason) < 4:
        raise PartnerApprovalError("Enter a rejection reason.", "reason_required", 400)

    result = await db.execute(select(DistributorPartner).where(DistributorPartner.id == partner_id))
    partner = result.scalar_one_or_none()
    if not partner:
        raise PartnerApprovalError("Partner application not found.", "partner_not_found", 404)
    if partner.status != DistributorPartnerStatus.pending_ho_review:
        raise PartnerApprovalError(
            "This application is not awaiting HO review.",
            "invalid_partner_status",
            400,
        )

    partner.status = DistributorPartnerStatus.rejected
    partner.ho_reviewed_by_user_id = reviewer.id
    partner.ho_reviewed_at = utcnow()
    partner.ho_rejection_reason = cleaned_reason

    db.add(
        AuditLog(
            user_id=reviewer.id,
            event_type=AuditEventType.admin_action_requested,
            ip_address=ip,
            metadata_={
                "kind": "distributor_partner_rejected",
                "partner_id": str(partner.id),
                "reason": cleaned_reason,
            },
        )
    )
    await db.flush()
    return {"partner_id": str(partner.id), "status": partner.status.value}


async def activate_distributor_partner_after_password_set(db: AsyncSession, *, user_id: UUID) -> None:
    result = await db.execute(select(DistributorPartner).where(DistributorPartner.user_id == user_id))
    partner = result.scalar_one_or_none()
    if not partner or partner.status != DistributorPartnerStatus.pending_password:
        return
    partner.status = DistributorPartnerStatus.active
