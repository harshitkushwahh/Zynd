from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.auth.audit_service import write_audit
from app.application.family_groups.activity_service import record_family_group_activity
from app.application.family_groups.display import (
    count_active_members,
    now_utc,
    resolve_member_display_name,
    resolve_family_group_avatar_url,
)
from app.application.documents.profile_image_url_service import resolve_profile_image_urls_by_user_id
from app.application.family_groups.family_group_portfolio_service import (
    get_family_group_portfolio_for_admin,
    load_family_group_mf_holdings,
    load_family_group_one_time_payments,
    load_family_group_progress_chart,
    load_family_group_sip_addons,
    load_member_goal_contribution_totals,
    load_member_invested_totals,
    load_member_linked_sip_counts,
)
from app.application.goals.family_goal_service import (
    _contribution_total,
    _serialize_family_goal_enriched,
    count_active_family_goals,
)
from app.application.family_groups.errors import FamilyGroupError
from app.application.family_groups.family_notification_service import notify_family_member_removed
from app.application.family_groups.invite_service import _mark_expired_invites, _serialize_invite, count_pending_invites
from app.application.referral.referral_notification_service import mask_referee_email
from app.infrastructure.persistence.family_group_models import (
    FamilyGroup,
    FamilyGroupActivity,
    FamilyGroupActivityType,
    FamilyGroupInvite,
    FamilyGroupInviteStatus,
    FamilyGroupMember,
    FamilyGroupMemberRole,
    FamilyGroupMemberStatus,
    FamilyGroupStatus,
)
from app.infrastructure.persistence.models import AuditEventType, User
from app.infrastructure.persistence.goal_models import Goal, GoalStatus


def _user_display_name(user: User | None) -> str | None:
    if not user:
        return None
    parts = [user.first_name, user.last_name]
    name = " ".join(part for part in parts if part).strip()
    return name or mask_referee_email(user.email)


async def _get_group_head(db: AsyncSession, group_id: UUID) -> tuple[FamilyGroupMember | None, User | None]:
    result = await db.execute(
        select(FamilyGroupMember, User)
        .join(User, User.id == FamilyGroupMember.user_id)
        .where(
            FamilyGroupMember.group_id == group_id,
            FamilyGroupMember.status == FamilyGroupMemberStatus.active,
            FamilyGroupMember.role == FamilyGroupMemberRole.head,
        )
        .limit(1)
    )
    row = result.first()
    if not row:
        return None, None
    return row[0], row[1]


async def _serialize_admin_group_summary(db: AsyncSession, group: FamilyGroup) -> dict[str, Any]:
    member_count = await count_active_members(db, group.id)
    pending_invite_count = await count_pending_invites(db, group.id)
    _head_member, head_user = await _get_group_head(db, group.id)

    return {
        "id": group.id,
        "title": group.title,
        "tag": group.tag,
        "status": group.status.value,
        "member_count": member_count,
        "pending_invite_count": pending_invite_count,
        "head_user_id": head_user.id if head_user else None,
        "head_display_name": _user_display_name(head_user),
        "head_email_masked": mask_referee_email(head_user.email) if head_user else None,
        "created_by_user_id": group.created_by_user_id,
        "created_at": group.created_at,
        "updated_at": group.updated_at,
        "archived_at": group.archived_at,
    }


async def _family_group_aggregate_progress_pct(db: AsyncSession, group_id: UUID) -> int:
    rows = await db.execute(
        select(Goal.current_amount_inr, Goal.target_amount_inr).where(
            Goal.family_group_id == group_id,
            Goal.status.in_(
                [GoalStatus.draft, GoalStatus.active, GoalStatus.paused, GoalStatus.achieved]
            ),
        )
    )
    progress_values: list[float] = []
    for current, target in rows.all():
        target_amount = Decimal(str(target or 0))
        if target_amount <= 0:
            continue
        current_amount = Decimal(str(current or 0))
        pct = float((current_amount / target_amount * Decimal("100")).quantize(Decimal("0.1")))
        progress_values.append(min(100.0, pct))
    if not progress_values:
        return 0
    return int(round(sum(progress_values) / len(progress_values)))


async def _load_family_group_members_preview(
    db: AsyncSession,
    group_id: UUID,
    *,
    limit: int = 4,
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(FamilyGroupMember, User)
        .join(User, User.id == FamilyGroupMember.user_id)
        .where(
            FamilyGroupMember.group_id == group_id,
            FamilyGroupMember.status == FamilyGroupMemberStatus.active,
        )
        .order_by(
            case((FamilyGroupMember.role == FamilyGroupMemberRole.head, 0), else_=1),
            FamilyGroupMember.joined_at.asc(),
        )
        .limit(limit)
    )
    rows = list(result.all())
    user_ids = [user.id for _member, user in rows]
    profile_images = await resolve_profile_image_urls_by_user_id(db, user_ids=user_ids)
    preview: list[dict[str, Any]] = []
    for member, user in rows:
        preview.append(
            {
                "user_id": user.id,
                "display_name": resolve_member_display_name(member, user),
                "role": member.role.value,
                "profile_image_url": profile_images.get(user.id),
            }
        )
    return preview


async def _serialize_admin_user_family_group_card(
    db: AsyncSession,
    group: FamilyGroup,
    *,
    role: str | None = None,
    badge_label: str | None = None,
    joined_at: Any | None = None,
) -> dict[str, Any]:
    summary = await _serialize_admin_group_summary(db, group)
    avatar_url = await resolve_family_group_avatar_url(db, avatar_document_id=group.avatar_document_id)
    card: dict[str, Any] = {
        **summary,
        "description": group.description,
        "avatar_url": avatar_url,
        "members_preview": await _load_family_group_members_preview(db, group.id),
        "active_goals_count": await count_active_family_goals(db, group_id=group.id),
        "progress_pct": await _family_group_aggregate_progress_pct(db, group.id),
    }
    if role is not None:
        card["group_id"] = group.id
        card["role"] = role
        card["badge_label"] = badge_label
        card["joined_at"] = joined_at
    return card


async def list_admin_family_groups(
    db: AsyncSession,
    *,
    status: FamilyGroupStatus | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    await _mark_expired_invites(db)
    query = select(FamilyGroup).order_by(FamilyGroup.created_at.desc())
    if status is not None:
        query = query.where(FamilyGroup.status == status)
    if search:
        normalized = search.strip()
        if normalized:
            query = query.where(FamilyGroup.title.ilike(f"%{normalized}%"))

    bounded_limit = max(1, min(limit, 200))
    query = query.offset(max(offset, 0)).limit(bounded_limit)
    groups = list((await db.execute(query)).scalars().all())
    return [await _serialize_admin_group_summary(db, group) for group in groups]


async def _get_group_or_raise(db: AsyncSession, group_id: UUID) -> FamilyGroup:
    group = await db.get(FamilyGroup, group_id)
    if not group:
        raise FamilyGroupError("group_not_found", "Family group not found.", status_code=404)
    return group


async def get_admin_family_group_detail(
    db: AsyncSession,
    *,
    group_id: UUID,
) -> dict[str, Any]:
    await _mark_expired_invites(db, group_id=group_id)
    group = await _get_group_or_raise(db, group_id)
    summary = await _serialize_admin_group_summary(db, group)
    avatar_url = await resolve_family_group_avatar_url(db, avatar_document_id=group.avatar_document_id)

    member_rows = await db.execute(
        select(FamilyGroupMember, User)
        .join(User, User.id == FamilyGroupMember.user_id)
        .where(
            FamilyGroupMember.group_id == group_id,
            FamilyGroupMember.status == FamilyGroupMemberStatus.active,
        )
        .order_by(FamilyGroupMember.joined_at.asc())
    )
    members: list[dict[str, Any]] = []
    for member, user_row in member_rows.all():
        members.append(
            {
                "user_id": user_row.id,
                "display_name": resolve_member_display_name(member, user_row),
                "display_nickname": member.display_nickname,
                "email_masked": mask_referee_email(user_row.email),
                "role": member.role.value,
                "badge_key": member.badge_key,
                "badge_label": member.badge_label,
                "joined_at": member.joined_at,
            }
        )

    invite_rows = await db.execute(
        select(FamilyGroupInvite)
        .where(FamilyGroupInvite.group_id == group_id)
        .order_by(FamilyGroupInvite.created_at.desc())
        .limit(100)
    )
    invites = [_serialize_invite(invite) for invite in invite_rows.scalars().all()]

    activity_rows = await db.execute(
        select(FamilyGroupActivity)
        .where(FamilyGroupActivity.group_id == group_id)
        .order_by(FamilyGroupActivity.created_at.desc(), FamilyGroupActivity.id.desc())
        .limit(20)
    )
    activity = [
        {
            "id": row.id,
            "event_type": row.event_type.value,
            "message": row.message,
            "actor_user_id": row.actor_user_id,
            "target_user_id": row.target_user_id,
            "created_at": row.created_at,
        }
        for row in activity_rows.scalars().all()
    ]

    creator = await db.get(User, group.created_by_user_id)
    return {
        **summary,
        "description": group.description,
        "avatar_url": avatar_url,
        "creator_display_name": _user_display_name(creator),
        "creator_email_masked": mask_referee_email(creator.email) if creator else None,
        "members": members,
        "invites": invites,
        "activity": activity,
    }


async def get_admin_family_group_analytics(
    db: AsyncSession,
    *,
    group_id: UUID,
) -> dict[str, Any]:
    await _mark_expired_invites(db, group_id=group_id)
    group = await _get_group_or_raise(db, group_id)
    summary = await _serialize_admin_group_summary(db, group)
    avatar_url = await resolve_family_group_avatar_url(db, avatar_document_id=group.avatar_document_id)
    portfolio = await get_family_group_portfolio_for_admin(db, group_id=group_id)
    progress_pct = await _family_group_aggregate_progress_pct(db, group_id)

    member_rows = await db.execute(
        select(FamilyGroupMember, User)
        .join(User, User.id == FamilyGroupMember.user_id)
        .where(
            FamilyGroupMember.group_id == group_id,
            FamilyGroupMember.status == FamilyGroupMemberStatus.active,
        )
        .order_by(
            case((FamilyGroupMember.role == FamilyGroupMemberRole.head, 0), else_=1),
            FamilyGroupMember.joined_at.asc(),
        )
    )
    rows = list(member_rows.all())
    user_ids = [user_row.id for _member, user_row in rows]
    profile_images = await resolve_profile_image_urls_by_user_id(db, user_ids=user_ids)
    contribution_totals = await load_member_goal_contribution_totals(
        db, group_id=group_id, user_ids=user_ids
    )
    invested_totals = await load_member_invested_totals(db, user_ids=user_ids)
    linked_sip_counts = await load_member_linked_sip_counts(db, group_id=group_id, user_ids=user_ids)

    group_contribution_total = sum(contribution_totals.values(), Decimal("0"))
    group_invested_total = sum(invested_totals.values(), Decimal("0"))
    share_base = group_contribution_total if group_contribution_total > 0 else group_invested_total

    members: list[dict[str, Any]] = []
    contribution_chart: list[dict[str, Any]] = []
    for member, user_row in rows:
        contribution_amount = contribution_totals.get(user_row.id, Decimal("0"))
        invested_amount = invested_totals.get(user_row.id, Decimal("0"))
        share_source = contribution_amount if group_contribution_total > 0 else invested_amount
        share_pct = (
            float((share_source / share_base * Decimal("100")).quantize(Decimal("0.1")))
            if share_base > 0 and share_source > 0
            else 0.0
        )
        display_name = resolve_member_display_name(member, user_row)
        member_payload = {
            "user_id": user_row.id,
            "display_name": display_name,
            "display_nickname": member.display_nickname,
            "email_masked": mask_referee_email(user_row.email),
            "role": member.role.value,
            "badge_key": member.badge_key,
            "badge_label": member.badge_label,
            "profile_image_url": profile_images.get(user_row.id),
            "joined_at": member.joined_at,
            "invested_amount_inr": float(invested_amount) if invested_amount > 0 else None,
            "goal_contribution_inr": float(contribution_amount) if contribution_amount > 0 else None,
            "portfolio_share_pct": share_pct,
            "linked_sip_count": linked_sip_counts.get(user_row.id, 0),
        }
        members.append(member_payload)
        chart_value = float(contribution_amount if contribution_amount > 0 else invested_amount)
        if chart_value > 0:
            contribution_chart.append(
                {
                    "user_id": user_row.id,
                    "label": display_name.split(" ")[0] if display_name else "Member",
                    "full_name": display_name,
                    "amount_inr": chart_value,
                }
            )

    goal_rows = await db.execute(
        select(Goal)
        .options(selectinload(Goal.template))
        .where(
            Goal.family_group_id == group_id,
            Goal.status != GoalStatus.archived,
        )
        .order_by(Goal.priority.asc(), Goal.target_date.asc(), Goal.created_at.desc())
    )
    goals: list[dict[str, Any]] = []
    for goal in goal_rows.scalars().all():
        contribution_total = await _contribution_total(db, goal_id=goal.id)
        goal_payload = await _serialize_family_goal_enriched(
            db,
            goal,
            contribution_total=contribution_total,
        )
        target_amount = Decimal(str(goal.target_amount_inr or 0))
        current_amount = Decimal(str(goal.current_amount_inr or 0))
        progress = (
            float(
                min(
                    Decimal("100"),
                    (current_amount / target_amount * Decimal("100")).quantize(Decimal("0.1")),
                )
            )
            if target_amount > 0
            else 0.0
        )
        goal_payload["progress_pct"] = progress
        goals.append(goal_payload)

    activity_rows = await db.execute(
        select(FamilyGroupActivity)
        .where(FamilyGroupActivity.group_id == group_id)
        .order_by(FamilyGroupActivity.created_at.desc(), FamilyGroupActivity.id.desc())
        .limit(100)
    )
    activity = [
        {
            "id": row.id,
            "event_type": row.event_type.value,
            "message": row.message,
            "actor_user_id": row.actor_user_id,
            "target_user_id": row.target_user_id,
            "created_at": row.created_at,
        }
        for row in activity_rows.scalars().all()
    ]

    member_labels = {
        user_row.id: resolve_member_display_name(member, user_row)
        for member, user_row in rows
    }
    progress_chart = await load_family_group_progress_chart(
        db,
        group_id=group_id,
        member_ids=user_ids,
    )
    sip_addons = await load_family_group_sip_addons(
        db,
        group_id=group_id,
        member_labels=member_labels,
    )
    mf_holdings = await load_family_group_mf_holdings(
        db,
        member_labels=member_labels,
    )
    one_time_payments = await load_family_group_one_time_payments(
        db,
        group_id=group_id,
        member_labels=member_labels,
    )

    creator = await db.get(User, group.created_by_user_id)
    return {
        **summary,
        "description": group.description,
        "avatar_url": avatar_url,
        "creator_display_name": _user_display_name(creator),
        "creator_email_masked": mask_referee_email(creator.email) if creator else None,
        "progress_pct": progress_pct,
        "portfolio": portfolio,
        "members": members,
        "goals": goals,
        "contribution_chart": contribution_chart,
        "activity": activity,
        "progress_chart": progress_chart,
        "sip_addons": sip_addons,
        "mf_holdings": mf_holdings,
        "one_time_payments": one_time_payments,
    }


async def list_admin_family_group_invites(
    db: AsyncSession,
    *,
    status: FamilyGroupInviteStatus | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    await _mark_expired_invites(db)
    query = (
        select(FamilyGroupInvite, FamilyGroup)
        .join(FamilyGroup, FamilyGroup.id == FamilyGroupInvite.group_id)
        .order_by(FamilyGroupInvite.created_at.desc())
    )
    if status is not None:
        query = query.where(FamilyGroupInvite.status == status)
    if search:
        normalized = search.strip().lower()
        if normalized:
            query = query.where(
                or_(
                    FamilyGroup.title.ilike(f"%{normalized}%"),
                    func.lower(FamilyGroupInvite.invitee_email).like(f"%{normalized}%"),
                )
            )

    bounded_limit = max(1, min(limit, 200))
    query = query.offset(max(offset, 0)).limit(bounded_limit)
    payload: list[dict[str, Any]] = []
    for invite, group in (await db.execute(query)).all():
        serialized = _serialize_invite(invite)
        payload.append(
            {
                **serialized,
                "group_title": group.title,
                "group_status": group.status.value,
            }
        )
    return payload


def _build_admin_invite_journey(invite: FamilyGroupInvite) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = [
        {
            "id": "sent",
            "status": "sent",
            "label": "Invite sent",
            "message": "Invitation was created and sent to the invitee.",
            "occurred_at": invite.created_at,
            "state": "completed",
        }
    ]
    if invite.reminder_sent_at or invite.reminder_count > 0:
        reminder_message = (
            f"Reminder sent ({invite.reminder_count} total)."
            if invite.reminder_count > 1
            else "A reminder was sent to the invitee."
        )
        events.append(
            {
                "id": "reminder",
                "status": "reminder_sent",
                "label": "Reminder sent",
                "message": reminder_message,
                "occurred_at": invite.reminder_sent_at,
                "state": "completed",
            }
        )

    status = invite.status
    if status == FamilyGroupInviteStatus.pending:
        events.append(
            {
                "id": "awaiting",
                "status": "pending",
                "label": "Awaiting response",
                "message": "The invitee has not accepted or declined yet.",
                "occurred_at": None,
                "state": "current",
            }
        )
        events.append(
            {
                "id": "expires",
                "status": "expires",
                "label": "Expires",
                "message": "Invite expires if there is no response.",
                "occurred_at": invite.expires_at,
                "state": "upcoming",
            }
        )
    elif status == FamilyGroupInviteStatus.accepted:
        events.append(
            {
                "id": "accepted",
                "status": "accepted",
                "label": "Accepted",
                "message": "The invitee accepted and joined the family group.",
                "occurred_at": invite.accepted_at,
                "state": "completed",
            }
        )
    elif status == FamilyGroupInviteStatus.declined:
        events.append(
            {
                "id": "declined",
                "status": "declined",
                "label": "Declined",
                "message": "The invitee declined this invitation.",
                "occurred_at": invite.declined_at,
                "state": "completed",
            }
        )
    elif status == FamilyGroupInviteStatus.revoked:
        events.append(
            {
                "id": "revoked",
                "status": "revoked",
                "label": "Revoked",
                "message": "This invitation was withdrawn.",
                "occurred_at": invite.revoked_at,
                "state": "completed",
            }
        )
    elif status == FamilyGroupInviteStatus.expired:
        events.append(
            {
                "id": "expired",
                "status": "expired",
                "label": "Expired",
                "message": "The invitation expired before a response.",
                "occurred_at": invite.expires_at,
                "state": "completed",
            }
        )
    return events


async def get_admin_family_group_invite_detail(
    db: AsyncSession,
    *,
    invite_id: UUID,
) -> dict[str, Any]:
    await _mark_expired_invites(db)
    invite = await db.get(FamilyGroupInvite, invite_id)
    if not invite:
        raise FamilyGroupError("invite_not_found", "Family group invite not found.", status_code=404)

    group = await db.get(FamilyGroup, invite.group_id)
    if not group:
        raise FamilyGroupError("group_not_found", "Family group not found.", status_code=404)

    inviter = await db.get(User, invite.invited_by_user_id)
    invitee = await db.get(User, invite.invitee_user_id) if invite.invitee_user_id else None
    accepted_user = await db.get(User, invite.accepted_user_id) if invite.accepted_user_id else None

    activity_rows = await db.execute(
        select(FamilyGroupActivity)
        .where(FamilyGroupActivity.group_id == invite.group_id)
        .order_by(FamilyGroupActivity.created_at.asc(), FamilyGroupActivity.id.asc())
        .limit(100)
    )
    invite_key = str(invite.id)
    related_event_types = {
        FamilyGroupActivityType.invite_sent,
        FamilyGroupActivityType.invite_accepted,
        FamilyGroupActivityType.invite_declined,
        FamilyGroupActivityType.invite_revoked,
        FamilyGroupActivityType.nominee_suggested_from_kyc,
    }
    activity: list[dict[str, Any]] = []
    for row in activity_rows.scalars().all():
        metadata = row.metadata_json or {}
        matches_invite = str(metadata.get("invite_id") or "") == invite_key
        matches_invitee = (
            invite.invitee_user_id is not None
            and row.target_user_id == invite.invitee_user_id
            and row.event_type
            in {
                FamilyGroupActivityType.invite_accepted,
                FamilyGroupActivityType.invite_declined,
            }
        )
        if not (matches_invite or (row.event_type in related_event_types and matches_invitee)):
            continue
        activity.append(
            {
                "id": row.id,
                "event_type": row.event_type.value,
                "message": row.message,
                "actor_user_id": row.actor_user_id,
                "target_user_id": row.target_user_id,
                "created_at": row.created_at,
            }
        )

    serialized = _serialize_invite(invite, for_head=True)
    return {
        **serialized,
        "group_title": group.title,
        "group_status": group.status.value,
        "invited_by_user_id": invite.invited_by_user_id,
        "invited_by_display_name": _user_display_name(inviter),
        "invited_by_email_masked": mask_referee_email(inviter.email) if inviter else None,
        "invitee_display_name": _user_display_name(invitee),
        "accepted_user_id": invite.accepted_user_id,
        "accepted_display_name": _user_display_name(accepted_user),
        "accepted_at": invite.accepted_at,
        "declined_at": invite.declined_at,
        "revoked_at": invite.revoked_at,
        "reminder_sent_at": invite.reminder_sent_at,
        "reminder_count": invite.reminder_count,
        "updated_at": invite.updated_at,
        "activity": activity,
        "journey": _build_admin_invite_journey(invite),
    }


async def list_admin_user_family_groups(
    db: AsyncSession,
    *,
    user_id: UUID,
) -> dict[str, Any]:
    user = await db.get(User, user_id)
    if not user:
        raise FamilyGroupError("user_not_found", "User not found.", status_code=404)

    await _mark_expired_invites(db)

    membership_rows = await db.execute(
        select(FamilyGroup, FamilyGroupMember)
        .join(FamilyGroupMember, FamilyGroupMember.group_id == FamilyGroup.id)
        .where(
            FamilyGroupMember.user_id == user_id,
            FamilyGroupMember.status == FamilyGroupMemberStatus.active,
        )
        .order_by(FamilyGroup.created_at.desc())
    )
    memberships: list[dict[str, Any]] = []
    for group, member in membership_rows.all():
        memberships.append(
            await _serialize_admin_user_family_group_card(
                db,
                group,
                role=member.role.value,
                badge_label=member.badge_label,
                joined_at=member.joined_at,
            )
        )

    created_rows = await db.execute(
        select(FamilyGroup)
        .where(FamilyGroup.created_by_user_id == user_id)
        .order_by(FamilyGroup.created_at.desc())
    )
    created_groups: list[dict[str, Any]] = []
    for group in created_rows.scalars().all():
        created_groups.append(await _serialize_admin_user_family_group_card(db, group))

    return {
        "user_id": user_id,
        "memberships": memberships,
        "created_groups": created_groups,
    }


async def admin_force_archive_family_group(
    db: AsyncSession,
    *,
    group_id: UUID,
    admin: User,
    ip: str | None = None,
) -> dict[str, Any]:
    group = await _get_group_or_raise(db, group_id)
    if group.status == FamilyGroupStatus.archived:
        return await get_admin_family_group_detail(db, group_id=group_id)

    group.status = FamilyGroupStatus.archived
    group.archived_at = now_utc()
    await db.flush()
    await db.refresh(group)

    await write_audit(
        db,
        event_type=AuditEventType.family_group_archived,
        user_id=admin.id,
        ip=ip,
        metadata={
            "group_id": str(group.id),
            "admin_action": True,
            "admin_user_id": str(admin.id),
        },
    )
    await record_family_group_activity(
        db,
        group_id=group.id,
        event_type=FamilyGroupActivityType.group_archived,
        actor_user_id=admin.id,
        message="Support archived the group",
    )

    return await get_admin_family_group_detail(db, group_id=group_id)


async def admin_force_remove_group_member(
    db: AsyncSession,
    *,
    group_id: UUID,
    target_user_id: UUID,
    admin: User,
    ip: str | None = None,
) -> dict[str, bool]:
    group = await _get_group_or_raise(db, group_id)
    if group.status == FamilyGroupStatus.archived:
        raise FamilyGroupError("group_archived", "This family group is archived.", status_code=409)

    result = await db.execute(
        select(FamilyGroupMember).where(
            FamilyGroupMember.group_id == group_id,
            FamilyGroupMember.user_id == target_user_id,
            FamilyGroupMember.status == FamilyGroupMemberStatus.active,
        )
    )
    target = result.scalar_one_or_none()
    if not target:
        raise FamilyGroupError("member_not_found", "Group member not found.", status_code=404)

    target.status = FamilyGroupMemberStatus.removed
    await db.flush()

    removed_user = await db.get(User, target_user_id)
    if removed_user:
        notify_family_member_removed(
            member=removed_user,
            group_title=group.title,
            group_id=group_id,
            removed_by=admin,
        )

    await record_family_group_activity(
        db,
        group_id=group_id,
        event_type=FamilyGroupActivityType.member_removed,
        actor_user_id=admin.id,
        target_user_id=target_user_id,
        message=f"Support removed {_user_display_name(removed_user) or 'a member'}",
    )
    await write_audit(
        db,
        event_type=AuditEventType.family_group_member_removed,
        user_id=admin.id,
        ip=ip,
        metadata={
            "group_id": str(group_id),
            "target_user_id": str(target_user_id),
            "admin_action": True,
            "admin_user_id": str(admin.id),
        },
    )
    return {"ok": True}
