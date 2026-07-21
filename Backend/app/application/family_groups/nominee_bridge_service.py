from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_audit
from app.application.family_groups.activity_service import record_family_group_activity
from app.application.family_groups.display import get_active_membership, serialize_family_group
from app.application.family_groups.errors import FamilyGroupError
from app.application.family_groups.group_service import create_family_group, list_family_groups_for_user
from app.application.family_groups.invite_service import (
    _ensure_no_pending_invite,
    _ensure_not_already_member,
    _get_user_by_email,
    _normalize_email,
    assert_group_has_capacity,
    create_family_group_invite,
)
from app.application.referral.referral_notification_service import mask_referee_email
from app.infrastructure.persistence.family_group_models import (
    FamilyGroupActivityType,
    FamilyGroupMemberRole,
    FamilyGroupNomineeLink,
    FamilyGroupNomineeLinkStatus,
)
from app.infrastructure.persistence.models import AuditEventType, User

NOMINEE_RELATIONSHIP_BADGES: dict[str, tuple[str, str | None]] = {
    "Spouse": ("custom", "Spouse"),
    "Son": ("son", "Son"),
    "Daughter": ("daughter", "Daughter"),
    "Father": ("father", "Father"),
    "Mother": ("mother", "Mother"),
    "Brother": ("custom", "Brother"),
    "Sister": ("custom", "Sister"),
    "Other": ("custom", None),
}

PreviewStatus = str


def map_nominee_relationship_badge(relationship: str) -> tuple[str, str | None]:
    normalized = relationship.strip()
    if normalized in NOMINEE_RELATIONSHIP_BADGES:
        return NOMINEE_RELATIONSHIP_BADGES[normalized]
    return "custom", normalized or "Nominee"


async def _get_nominee_link(
    db: AsyncSession,
    *,
    user_id: UUID,
    kyc_nominee_id: str,
) -> FamilyGroupNomineeLink | None:
    result = await db.execute(
        select(FamilyGroupNomineeLink).where(
            FamilyGroupNomineeLink.user_id == user_id,
            FamilyGroupNomineeLink.kyc_nominee_id == kyc_nominee_id,
        )
    )
    return result.scalar_one_or_none()


async def list_head_groups_for_user(db: AsyncSession, user_id: UUID) -> list[dict[str, Any]]:
    groups = await list_family_groups_for_user(db, user_id=user_id)
    return [group for group in groups if group.get("my_role") == FamilyGroupMemberRole.head.value]


async def _evaluate_group_for_nominee(
    db: AsyncSession,
    *,
    group_id: UUID,
    user_id: UUID,
    nominee_email: str,
) -> PreviewStatus:
    membership = await get_active_membership(db, group_id=group_id, user_id=user_id)
    if not membership or membership.role != FamilyGroupMemberRole.head:
        return "not_group_head"

    invitee_user = await _get_user_by_email(db, nominee_email)
    try:
        await _ensure_not_already_member(
            db,
            group_id=group_id,
            user_id=invitee_user.id if invitee_user else None,
            email=nominee_email,
        )
    except FamilyGroupError as exc:
        if exc.code == "already_member":
            return "already_member"
        raise

    try:
        await _ensure_no_pending_invite(
            db,
            group_id=group_id,
            user_id=invitee_user.id if invitee_user else None,
            email=nominee_email,
        )
    except FamilyGroupError as exc:
        if exc.code == "invite_pending":
            return "invite_pending"
        raise

    try:
        await assert_group_has_capacity(db, group_id)
    except FamilyGroupError as exc:
        if exc.code == "group_full":
            return "group_full"
        raise

    return "ok"


async def preview_nominee_family_group_add(
    db: AsyncSession,
    *,
    user: User,
    nominee_email: str,
    nominee_name: str,
    relationship: str,
    kyc_nominee_id: str,
    group_id: UUID | None = None,
) -> dict[str, Any]:
    normalized_email = _normalize_email(nominee_email)
    if not normalized_email:
        return {
            "status": "no_email",
            "message": "A valid nominee email is required.",
            "groups": [],
        }

    existing = await _get_nominee_link(db, user_id=user.id, kyc_nominee_id=kyc_nominee_id)
    if existing and existing.status != FamilyGroupNomineeLinkStatus.skipped:
        return {
            "status": "already_handled",
            "message": "You already responded to this nominee family group prompt.",
            "groups": [],
            "existing_status": existing.status.value,
        }

    badge_key, badge_label = map_nominee_relationship_badge(relationship)
    if badge_key == "custom" and not badge_label:
        badge_label = nominee_name.strip() or "Nominee"

    head_groups = await list_head_groups_for_user(db, user.id)
    if not head_groups:
        return {
            "status": "no_groups",
            "message": "Create a family group to invite your nominee.",
            "groups": [],
            "suggested_badge_key": badge_key,
            "suggested_badge_label": badge_label,
        }

    if len(head_groups) > 1 and group_id is None:
        return {
            "status": "select_group",
            "message": "Choose a family group for this nominee.",
            "groups": head_groups,
            "suggested_badge_key": badge_key,
            "suggested_badge_label": badge_label,
        }

    resolved_group_id = group_id or head_groups[0]["id"]
    status = await _evaluate_group_for_nominee(
        db,
        group_id=resolved_group_id,
        user_id=user.id,
        nominee_email=normalized_email,
    )

    messages = {
        "ok": "You can invite this nominee to your family group.",
        "already_member": "This person is already in the selected family group.",
        "invite_pending": "A pending invitation already exists for this person.",
        "group_full": "The selected family group is full.",
        "not_group_head": "Only the group head can invite family members.",
    }

    payload: dict[str, Any] = {
        "status": status,
        "message": messages.get(status, "Unable to add nominee to family group."),
        "groups": head_groups,
        "group_id": resolved_group_id if status == "ok" else None,
        "suggested_badge_key": badge_key,
        "suggested_badge_label": badge_label,
        "invitee_email_masked": mask_referee_email(normalized_email),
    }
    return payload


async def add_nominee_to_family_group(
    db: AsyncSession,
    *,
    user: User,
    nominee_email: str,
    nominee_name: str,
    relationship: str,
    kyc_nominee_id: str,
    group_id: UUID | None = None,
    create_group_title: str | None = None,
    action: str = "invite",
    ip: str | None = None,
) -> dict[str, Any]:
    normalized_email = _normalize_email(nominee_email)
    if not normalized_email:
        raise FamilyGroupError("no_email", "A valid nominee email is required.", status_code=400)

    existing = await _get_nominee_link(db, user_id=user.id, kyc_nominee_id=kyc_nominee_id)
    if existing:
        if existing.status == FamilyGroupNomineeLinkStatus.skipped:
            if action == "skip":
                return {"ok": True, "action": "skip"}
            if action == "invite":
                await db.delete(existing)
                await db.flush()
            else:
                raise FamilyGroupError(
                    "invalid_request",
                    "Unsupported action for this nominee family group prompt.",
                    status_code=400,
                )
        else:
            raise FamilyGroupError(
                "already_handled",
                "You already responded to this nominee family group prompt.",
                status_code=409,
            )

    resolved_group_id = group_id
    if action == "skip":
        link = FamilyGroupNomineeLink(
            user_id=user.id,
            group_id=resolved_group_id,
            kyc_nominee_id=kyc_nominee_id,
            nominee_email=normalized_email,
            nominee_name=nominee_name.strip(),
            relationship=relationship.strip(),
            status=FamilyGroupNomineeLinkStatus.skipped,
        )
        db.add(link)
        await db.flush()

        await write_audit(
            db,
            event_type=AuditEventType.family_group_nominee_kyc_skipped,
            user_id=user.id,
            ip=ip,
            metadata={
                "kyc_nominee_id": kyc_nominee_id,
                "nominee_email": mask_referee_email(normalized_email),
                "group_id": str(resolved_group_id) if resolved_group_id else None,
            },
        )
        return {"ok": True, "action": "skip"}

    if not resolved_group_id and create_group_title:
        created = await create_family_group(
            db,
            user=user,
            title=create_group_title.strip(),
            ip=ip,
        )
        resolved_group_id = created["id"]

    preview = await preview_nominee_family_group_add(
        db,
        user=user,
        nominee_email=normalized_email,
        nominee_name=nominee_name,
        relationship=relationship,
        kyc_nominee_id=kyc_nominee_id,
        group_id=resolved_group_id,
    )
    preview_status = preview["status"]
    if preview_status == "already_member":
        link = FamilyGroupNomineeLink(
            user_id=user.id,
            group_id=resolved_group_id,
            kyc_nominee_id=kyc_nominee_id,
            nominee_email=normalized_email,
            nominee_name=nominee_name.strip(),
            relationship=relationship.strip(),
            status=FamilyGroupNomineeLinkStatus.already_member,
        )
        db.add(link)
        await db.flush()
        raise FamilyGroupError(
            "already_member",
            "This person is already in your family group.",
            status_code=409,
        )
    if preview_status != "ok":
        raise FamilyGroupError(
            preview_status,
            str(preview["message"]),
            status_code=409 if preview_status in {"invite_pending", "group_full"} else 403,
        )

    resolved_group_id = resolved_group_id or preview.get("group_id")
    if resolved_group_id is None:
        raise FamilyGroupError("invalid_request", "A family group must be selected.", status_code=400)

    badge_key = preview.get("suggested_badge_key")
    badge_label = preview.get("suggested_badge_label")

    invite = await create_family_group_invite(
        db,
        group_id=resolved_group_id,
        inviter=user,
        invitee_email=normalized_email,
        intended_role=FamilyGroupMemberRole.viewer,
        intended_badge_key=str(badge_key) if badge_key else None,
        intended_badge_label=str(badge_label) if badge_label else None,
        ip=ip,
    )

    link = FamilyGroupNomineeLink(
        user_id=user.id,
        group_id=resolved_group_id,
        kyc_nominee_id=kyc_nominee_id,
        nominee_email=normalized_email,
        nominee_name=nominee_name.strip(),
        relationship=relationship.strip(),
        status=FamilyGroupNomineeLinkStatus.invited,
        invite_id=invite["id"],
    )
    db.add(link)
    await db.flush()

    await record_family_group_activity(
        db,
        group_id=resolved_group_id,
        event_type=FamilyGroupActivityType.nominee_suggested_from_kyc,
        actor_user_id=user.id,
        metadata={
            "kyc_nominee_id": kyc_nominee_id,
            "nominee_name": nominee_name.strip(),
            "nominee_email_masked": mask_referee_email(normalized_email),
            "relationship": relationship.strip(),
        },
    )

    await write_audit(
        db,
        event_type=AuditEventType.family_group_nominee_kyc_invited,
        user_id=user.id,
        ip=ip,
        metadata={
            "group_id": str(resolved_group_id),
            "invite_id": str(invite["id"]),
            "kyc_nominee_id": kyc_nominee_id,
            "nominee_email": mask_referee_email(normalized_email),
        },
    )

    from app.application.family_groups.display import get_family_group_or_raise

    group = await get_family_group_or_raise(db, resolved_group_id)
    group_payload = await serialize_family_group(db, group, viewer_user_id=user.id)

    return {
        "ok": True,
        "action": "invite",
        "group": group_payload,
        "invite": invite,
    }


async def apply_nominee_nickname_on_join(
    db: AsyncSession,
    *,
    group_id: UUID,
    user_id: UUID,
    email: str,
) -> None:
    normalized_email = _normalize_email(email)
    result = await db.execute(
        select(FamilyGroupNomineeLink).where(
            FamilyGroupNomineeLink.group_id == group_id,
            FamilyGroupNomineeLink.nominee_email == normalized_email,
            FamilyGroupNomineeLink.status == FamilyGroupNomineeLinkStatus.invited,
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        return

    membership = await get_active_membership(db, group_id=group_id, user_id=user_id)
    if membership and link.nominee_name:
        membership.display_nickname = link.nominee_name.strip()
        link.status = FamilyGroupNomineeLinkStatus.already_member
        await db.flush()
