from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.application.admin.rbac_service import (
    DISTRIBUTOR_MANAGER_ROLE_KEY,
    MITRA_STATE_HEAD_ROLE_KEY,
    MITRA_SUPER_HEAD_ROLE_KEY,
    assign_role_to_admin_user,
    list_user_role_keys,
)
from app.application.shared.datetime_utils import utcnow
from app.infrastructure.persistence.distributor_branch_models import DistributorBranch
from app.infrastructure.persistence.distributor_partner_models import DistributorPartner, DistributorPartnerStatus
from app.infrastructure.persistence.distributor_state_head_models import DistributorStateHead
from app.infrastructure.persistence.models import AdminRole, AdminUserRoleAssignment, User, UserRole, UserStatus

_BRANCH_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{1,30}$")
_BRANCH_ID_TOKEN_PATTERN = re.compile(r"[^a-z0-9]+")


def _slugify_branch_token(value: str) -> str:
    normalized = _BRANCH_ID_TOKEN_PATTERN.sub("-", value.strip().lower())
    normalized = re.sub(r"-+", "-", normalized).strip("-")
    return normalized[:20]


async def _generate_branch_id(db: AsyncSession, *, name: str, city: str | None) -> str:
    name_token = _slugify_branch_token(name)
    parts = ["br"]
    if name_token:
        parts.append(name_token)

    base = "-".join(parts)
    city_token = _slugify_branch_token(city or "")
    if city_token:
        base_parts = base.split("-")
        if city_token not in base_parts:
            base = f"{base}-{city_token}"

    base = base[:31]
    if not base or not _BRANCH_ID_PATTERN.fullmatch(base):
        base = "br-branch"

    candidate = base
    suffix = 2
    while await db.get(DistributorBranch, candidate) is not None:
        suffix_part = f"-{suffix}"
        trim_len = max(1, 31 - len(suffix_part))
        candidate = f"{base[:trim_len]}{suffix_part}"
        suffix += 1
    return candidate


class AdminDistributorHierarchyError(Exception):
    def __init__(self, message: str, code: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


def _display_name(user: User) -> str:
    return " ".join(part for part in [user.first_name, user.middle_name, user.last_name] if part).strip() or user.email


def _partner_status_label(status: DistributorPartnerStatus) -> str:
    if status == DistributorPartnerStatus.active:
        return "Active"
    if status in {DistributorPartnerStatus.pending_ho_review, DistributorPartnerStatus.pending_password}:
        return "Onboarding"
    if status == DistributorPartnerStatus.rejected:
        return "Suspended"
    return status.value


async def resolve_admin_hierarchy_state_filter(db: AsyncSession, *, user: User) -> str | None:
    role_keys = await list_user_role_keys(db, user.id)
    if "super_admin" in role_keys or MITRA_SUPER_HEAD_ROLE_KEY in role_keys:
        return None
    if MITRA_STATE_HEAD_ROLE_KEY in role_keys:
        result = await db.execute(select(DistributorStateHead).where(DistributorStateHead.user_id == user.id))
        assignment = result.scalar_one_or_none()
        return assignment.state_code if assignment else "__none__"
    return None


async def _partner_counts_by_branch(db: AsyncSession) -> dict[str, int]:
    result = await db.execute(
        select(DistributorPartner.branch_id, func.count())
        .where(DistributorPartner.branch_id.is_not(None))
        .group_by(DistributorPartner.branch_id)
    )
    return {branch_id: count for branch_id, count in result.all() if branch_id}


async def list_admin_distributor_branches(
    db: AsyncSession,
    *,
    state_filter: str | None,
) -> list[dict[str, Any]]:
    query = (
        select(DistributorBranch, User)
        .join(User, User.id == DistributorBranch.manager_user_id)
        .order_by(DistributorBranch.name.asc())
    )
    if state_filter == "__none__":
        return []
    if state_filter:
        query = query.where(DistributorBranch.state_code == state_filter)

    rows = (await db.execute(query)).all()
    partner_counts = await _partner_counts_by_branch(db)
    return [
        {
            "id": branch.id,
            "name": branch.name,
            "city": branch.city,
            "state_code": branch.state_code,
            "state_name": branch.state_name,
            "manager_id": str(manager.id),
            "manager_name": _display_name(manager),
            "manager_email": manager.email,
            "partner_count": partner_counts.get(branch.id, 0),
            "active_clients": 0,
            "aum_inr": 0,
            "sales_mtd_inr": 0,
        }
        for branch, manager in rows
    ]


async def list_admin_distributor_managers(
    db: AsyncSession,
    *,
    state_filter: str | None,
) -> list[dict[str, Any]]:
    branch_query = select(DistributorBranch, User).join(User, User.id == DistributorBranch.manager_user_id)
    if state_filter == "__none__":
        return []
    if state_filter:
        branch_query = branch_query.where(DistributorBranch.state_code == state_filter)
    branch_rows = (await db.execute(branch_query.order_by(User.first_name.asc(), User.last_name.asc()))).all()

    partner_counts = await _partner_counts_by_branch(db)
    return [
        {
            "id": str(manager.id),
            "name": _display_name(manager),
            "email": manager.email,
            "city": branch.city or "",
            "branch_ids": [branch.id],
            "branch_names": [branch.name],
            "state_code": branch.state_code,
            "state_name": branch.state_name,
            "partner_count": partner_counts.get(branch.id, 0),
            "sales_mtd_inr": 0,
            "sales_ytd_inr": 0,
            "status": "Active",
        }
        for branch, manager in branch_rows
    ]


async def list_admin_distributor_partners(
    db: AsyncSession,
    *,
    state_filter: str | None,
) -> list[dict[str, Any]]:
    ManagerUser = aliased(User)
    query = (
        select(DistributorPartner, User, DistributorBranch, ManagerUser)
        .join(User, User.id == DistributorPartner.user_id)
        .outerjoin(DistributorBranch, DistributorBranch.id == DistributorPartner.branch_id)
        .outerjoin(ManagerUser, ManagerUser.id == DistributorPartner.onboarded_by_user_id)
        .order_by(DistributorPartner.created_at.desc())
    )
    if state_filter == "__none__":
        return []
    if state_filter:
        query = query.where(DistributorBranch.state_code == state_filter)

    rows = (await db.execute(query)).all()
    items: list[dict[str, Any]] = []
    for partner, user, branch, manager in rows:
        items.append(
            {
                "id": user.client_id or str(partner.id),
                "partner_id": str(partner.id),
                "user_id": str(user.id),
                "name": _display_name(user),
                "email": user.email,
                "arn": partner.arn or "",
                "euin": partner.euin or "",
                "manager_id": str(manager.id) if manager else None,
                "manager_name": _display_name(manager) if manager else None,
                "branch_id": branch.id if branch else partner.branch_id,
                "branch_name": branch.name if branch else "",
                "client_count": 0,
                "aum_inr": 0,
                "sales_mtd_inr": 0,
                "status": _partner_status_label(partner.status),
                "onboarding_status": partner.status.value,
            }
        )
    return items


async def get_admin_distributor_overview(
    db: AsyncSession,
    *,
    state_filter: str | None,
) -> dict[str, Any]:
    branches = await list_admin_distributor_branches(db, state_filter=state_filter)
    managers = await list_admin_distributor_managers(db, state_filter=state_filter)
    partners = await list_admin_distributor_partners(db, state_filter=state_filter)

    if state_filter == "__none__":
        pending_count = 0
    else:
        pending_query = select(func.count()).select_from(DistributorPartner).where(
            DistributorPartner.status == DistributorPartnerStatus.pending_ho_review
        )
        if state_filter:
            pending_query = pending_query.join(
                DistributorBranch,
                DistributorBranch.id == DistributorPartner.branch_id,
            ).where(DistributorBranch.state_code == state_filter)
        pending_count = (await db.execute(pending_query)).scalar_one()

    state_code = branches[0]["state_code"] if branches else (managers[0]["state_code"] if managers else "MH")
    state_name = branches[0]["state_name"] if branches else (managers[0]["state_name"] if managers else "Maharashtra")

    active_partners = sum(1 for row in partners if row["status"] == "Active")
    return {
        "state_code": state_code,
        "state_name": state_name,
        "manager_count": len(managers),
        "partner_count": len(partners),
        "active_partner_count": active_partners,
        "branch_count": len(branches),
        "pending_review_count": pending_count,
        "sales_mtd_inr": 0,
    }


async def list_eligible_branch_manager_candidates(db: AsyncSession) -> list[dict[str, Any]]:
    assigned_manager_ids = select(DistributorBranch.manager_user_id)
    rows = (
        await db.execute(
            select(User)
            .join(AdminUserRoleAssignment, AdminUserRoleAssignment.user_id == User.id)
            .join(AdminRole, AdminRole.id == AdminUserRoleAssignment.role_id)
            .where(
                AdminRole.key == DISTRIBUTOR_MANAGER_ROLE_KEY,
                User.role == UserRole.admin,
                User.status == UserStatus.active,
                User.id.not_in(assigned_manager_ids),
            )
            .order_by(User.first_name.asc(), User.last_name.asc(), User.email.asc())
        )
    ).scalars().all()
    return [
        {
            "user_id": str(user.id),
            "name": _display_name(user),
            "email": user.email,
        }
        for user in rows
    ]


async def create_admin_distributor_branch(
    db: AsyncSession,
    *,
    name: str,
    city: str | None,
    state_code: str,
    state_name: str,
    manager_user_id: UUID,
    branch_id: str | None = None,
) -> dict[str, Any]:
    normalized_id = (branch_id or "").strip().lower()
    if not normalized_id:
        normalized_id = await _generate_branch_id(db, name=name, city=city)
    elif not _BRANCH_ID_PATTERN.fullmatch(normalized_id):
        raise AdminDistributorHierarchyError(
            "Branch id must be 2–31 lowercase letters, numbers, or hyphens.",
            "invalid_branch_id",
            400,
        )

    cleaned_name = name.strip()
    if len(cleaned_name) < 2:
        raise AdminDistributorHierarchyError("Enter a branch name.", "invalid_branch_name", 400)

    cleaned_state_code = state_code.strip().upper()
    cleaned_state_name = state_name.strip()
    if len(cleaned_state_code) < 2 or len(cleaned_state_name) < 2:
        raise AdminDistributorHierarchyError("Enter a valid state.", "invalid_state", 400)

    existing = await db.get(DistributorBranch, normalized_id)
    if existing is not None:
        raise AdminDistributorHierarchyError("This branch id is already in use.", "branch_exists", 409)

    manager = await db.get(User, manager_user_id)
    if manager is None:
        raise AdminDistributorHierarchyError("Manager user not found.", "manager_not_found", 404)

    role_result = await db.execute(
        select(AdminRole.key)
        .join(AdminUserRoleAssignment, AdminUserRoleAssignment.role_id == AdminRole.id)
        .where(
            AdminUserRoleAssignment.user_id == manager_user_id,
            AdminRole.key == DISTRIBUTOR_MANAGER_ROLE_KEY,
        )
    )
    if role_result.scalar_one_or_none() is None:
        raise AdminDistributorHierarchyError(
            "Assign the branch manager role before linking a branch.",
            "manager_role_required",
            400,
        )

    existing_manager_branch = await db.execute(
        select(DistributorBranch).where(DistributorBranch.manager_user_id == manager_user_id)
    )
    if existing_manager_branch.scalar_one_or_none() is not None:
        raise AdminDistributorHierarchyError(
            "This manager is already assigned to a branch.",
            "manager_branch_exists",
            409,
        )

    now = utcnow()
    branch = DistributorBranch(
        id=normalized_id,
        name=cleaned_name,
        city=(city or "").strip() or None,
        state_code=cleaned_state_code,
        state_name=cleaned_state_name,
        manager_user_id=manager_user_id,
        created_at=now,
        updated_at=now,
    )
    db.add(branch)
    await db.flush()
    return {
        "id": branch.id,
        "name": branch.name,
        "city": branch.city,
        "state_code": branch.state_code,
        "state_name": branch.state_name,
        "manager_id": str(manager.id),
        "manager_name": _display_name(manager),
        "manager_email": manager.email,
        "partner_count": 0,
        "active_clients": 0,
        "aum_inr": 0,
        "sales_mtd_inr": 0,
    }


async def list_admin_distributor_state_heads(
    db: AsyncSession,
    *,
    state_filter: str | None,
) -> list[dict[str, Any]]:
    query = select(DistributorStateHead, User).join(User, User.id == DistributorStateHead.user_id)
    if state_filter == "__none__":
        return []
    if state_filter:
        query = query.where(DistributorStateHead.state_code == state_filter)
    rows = (await db.execute(query.order_by(DistributorStateHead.state_name.asc(), User.email.asc()))).all()
    return [
        {
            "user_id": str(user.id),
            "name": _display_name(user),
            "email": user.email,
            "state_code": assignment.state_code,
            "state_name": assignment.state_name,
        }
        for assignment, user in rows
    ]


async def list_eligible_state_head_candidates(db: AsyncSession) -> list[dict[str, Any]]:
    assigned_state_head_ids = select(DistributorStateHead.user_id)
    rows = (
        await db.execute(
            select(User)
            .join(AdminUserRoleAssignment, AdminUserRoleAssignment.user_id == User.id)
            .where(
                User.role == UserRole.admin,
                User.status == UserStatus.active,
                User.id.not_in(assigned_state_head_ids),
            )
            .distinct()
            .order_by(User.first_name.asc(), User.last_name.asc(), User.email.asc())
        )
    ).scalars().all()
    return [
        {
            "user_id": str(user.id),
            "name": _display_name(user),
            "email": user.email,
        }
        for user in rows
    ]


async def create_admin_distributor_state_head(
    db: AsyncSession,
    *,
    user_id: UUID,
    state_code: str,
    state_name: str,
) -> dict[str, Any]:
    user = await db.get(User, user_id)
    if user is None or user.role != UserRole.admin:
        raise AdminDistributorHierarchyError("Admin user not found.", "user_not_found", 404)
    if user.status != UserStatus.active:
        raise AdminDistributorHierarchyError("Admin user is not active.", "user_inactive", 400)

    rbac_result = await db.execute(
        select(AdminUserRoleAssignment.id).where(AdminUserRoleAssignment.user_id == user_id).limit(1)
    )
    if rbac_result.scalar_one_or_none() is None:
        raise AdminDistributorHierarchyError(
            "Assign at least one admin RBAC role before making this user a Mitra State Head.",
            "rbac_required",
            400,
        )

    cleaned_state_code = state_code.strip().upper()
    cleaned_state_name = state_name.strip()
    if len(cleaned_state_code) < 2 or len(cleaned_state_name) < 2:
        raise AdminDistributorHierarchyError("Enter a valid state.", "invalid_state", 400)

    existing_user_assignment = await db.get(DistributorStateHead, user_id)
    if existing_user_assignment is not None:
        raise AdminDistributorHierarchyError(
            "This user is already assigned as a Mitra State Head.",
            "user_state_head_exists",
            409,
        )

    existing_state = await db.execute(
        select(DistributorStateHead).where(DistributorStateHead.state_code == cleaned_state_code)
    )
    if existing_state.scalar_one_or_none() is not None:
        raise AdminDistributorHierarchyError(
            "This state already has a Mitra State Head assigned.",
            "state_head_exists",
            409,
        )

    try:
        await assign_role_to_admin_user(
            db,
            user_id=user_id,
            role_key=MITRA_STATE_HEAD_ROLE_KEY,
        )
    except ValueError as exc:
        message = str(exc)
        if "already assigned" not in message.lower():
            raise AdminDistributorHierarchyError(message, "role_assign_failed", 400) from exc

    now = utcnow()
    db.add(
        DistributorStateHead(
            user_id=user_id,
            state_code=cleaned_state_code,
            state_name=cleaned_state_name,
            created_at=now,
            updated_at=now,
        )
    )
    await db.flush()

    return {
        "user_id": str(user.id),
        "name": _display_name(user),
        "email": user.email,
        "state_code": cleaned_state_code,
        "state_name": cleaned_state_name,
    }
