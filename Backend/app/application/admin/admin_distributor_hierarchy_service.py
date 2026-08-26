from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.application.admin.admin_module_audit_service import write_admin_module_audit
from app.application.admin.user_admin_service import user_identity_fields, user_path_ref
from app.application.admin.rbac_service import (
    DISTRIBUTOR_MANAGER_ROLE_KEY,
    MITRA_STATE_HEAD_ROLE_KEY,
    MITRA_SUPER_HEAD_ROLE_KEY,
    assign_role_to_admin_user,
    list_user_role_keys,
    revoke_role_from_admin_user,
)
from app.application.auth.session_service import revoke_all_sessions
from app.application.shared.datetime_utils import utcnow
from app.infrastructure.persistence.distributor_branch_models import DistributorBranch, DistributorBranchStatus
from app.infrastructure.persistence.distributor_partner_models import DistributorPartner, DistributorPartnerStatus
from app.infrastructure.persistence.distributor_state_head_models import (
    STATE_HEAD_STATUS_ACTIVE,
    STATE_HEAD_STATUS_PAUSED,
    DistributorStateHead,
)
from app.infrastructure.persistence.models import AdminInvitation, AdminRole, AdminUserRoleAssignment, User, UserRole, UserStatus

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


def _branch_status_label(status: DistributorBranchStatus) -> str:
    if status == DistributorBranchStatus.active:
        return "Active"
    if status == DistributorBranchStatus.pending_approval:
        return "Pending approval"
    if status == DistributorBranchStatus.rejected:
        return "Rejected"
    return status.value


def _empty_branch_partner_stats() -> dict[str, int | float]:
    return {
        "partner_count": 0,
        "active_partner_count": 0,
        "active_clients": 0,
        "aum_inr": 0.0,
        "sales_mtd_inr": 0.0,
    }


def _serialize_branch_row(
    branch: DistributorBranch,
    *,
    manager: User | None = None,
    manager_unavailable: bool = False,
    partner_count: int = 0,
    active_partner_count: int = 0,
    active_clients: int = 0,
    aum_inr: float = 0,
    sales_mtd_inr: float = 0,
) -> dict[str, Any]:
    manager_status = manager.status.value if manager else None
    return {
        "id": branch.id,
        "branch_code": branch.branch_code,
        "name": branch.name,
        "city": branch.city,
        "state_code": branch.state_code,
        "state_name": branch.state_name,
        "status": branch.status.value,
        "status_label": _branch_status_label(branch.status),
        "manager_id": user_path_ref(manager) if manager else None,
        "manager_name": _display_name(manager) if manager else None,
        "manager_email": manager.email if manager else None,
        "manager_status": manager_status,
        "manager_unavailable": manager_unavailable,
        "created_by_user_id": str(branch.created_by_user_id) if branch.created_by_user_id else None,
        "rejection_reason": branch.rejection_reason,
        "partner_count": partner_count,
        "active_partner_count": active_partner_count,
        "active_clients": active_clients,
        "aum_inr": aum_inr,
        "sales_mtd_inr": sales_mtd_inr,
    }


def _manager_unavailable(branch: DistributorBranch, manager: User | None) -> bool:
    if branch.manager_user_id is None:
        return False
    return manager is None or manager.status != UserStatus.active


async def _is_active_branch_manager(db: AsyncSession, manager: User | None) -> bool:
    if manager is None or manager.status != UserStatus.active:
        return False
    role_result = await db.execute(
        select(AdminRole.key)
        .join(AdminUserRoleAssignment, AdminUserRoleAssignment.role_id == AdminRole.id)
        .where(
            AdminUserRoleAssignment.user_id == manager.id,
            AdminRole.key == DISTRIBUTOR_MANAGER_ROLE_KEY,
        )
    )
    return role_result.scalar_one_or_none() is not None


async def _enforce_branch_manager_assignment_actor(
    db: AsyncSession,
    *,
    actor: User,
    branch: DistributorBranch,
) -> None:
    role_keys = await list_user_role_keys(db, actor.id)
    is_state_head_only = (
        MITRA_STATE_HEAD_ROLE_KEY in role_keys
        and "super_admin" not in role_keys
        and MITRA_SUPER_HEAD_ROLE_KEY not in role_keys
    )
    if is_state_head_only:
        if branch.created_by_user_id != actor.id:
            raise AdminDistributorHierarchyError(
                "You can only manage managers on branches you opened.",
                "branch_owner_required",
                403,
            )
        actor_scope = await get_actor_hierarchy_state_scope(db, actor=actor)
        _enforce_branch_state_scope(
            actor_scope,
            state_code=branch.state_code,
            state_name=branch.state_name,
        )


async def _load_branch_manager(db: AsyncSession, branch: DistributorBranch) -> User | None:
    if branch.manager_user_id is None:
        return None
    return await db.get(User, branch.manager_user_id)


def _serialize_branch_detail(
    branch: DistributorBranch,
    *,
    manager: User | None = None,
    created_by: User | None = None,
    approved_by: User | None = None,
    stats: dict[str, int | float] | None = None,
) -> dict[str, Any]:
    bucket = stats or _empty_branch_partner_stats()
    row = _serialize_branch_row(
        branch,
        manager=manager,
        manager_unavailable=_manager_unavailable(branch, manager),
        partner_count=int(bucket["partner_count"]),
        active_partner_count=int(bucket["active_partner_count"]),
        active_clients=int(bucket["active_clients"]),
        aum_inr=float(bucket["aum_inr"]),
        sales_mtd_inr=float(bucket["sales_mtd_inr"]),
    )
    row.update(
        {
            "created_at": branch.created_at.isoformat(),
            "updated_at": branch.updated_at.isoformat(),
            "approved_at": branch.approved_at.isoformat() if branch.approved_at else None,
            "created_by_name": _display_name(created_by) if created_by else None,
            "created_by_email": created_by.email if created_by else None,
            "approved_by_name": _display_name(approved_by) if approved_by else None,
            "approved_by_email": approved_by.email if approved_by else None,
        }
    )
    return row


async def _generate_state_branch_code(db: AsyncSession, state_code: str) -> tuple[str, str]:
    prefix = state_code.strip().upper()
    result = await db.execute(
        select(DistributorBranch.branch_code).where(DistributorBranch.state_code == prefix)
    )
    max_num = 0
    for (code,) in result.all():
        if not code or not code.startswith(prefix):
            continue
        suffix = code[len(prefix) :]
        if suffix.isdigit():
            max_num = max(max_num, int(suffix))

    next_num = max_num + 1
    while True:
        branch_code = f"{prefix}{next_num:03d}"
        branch_id = branch_code.lower()
        if await db.get(DistributorBranch, branch_id) is not None:
            next_num += 1
            continue
        duplicate_code = await db.execute(
            select(DistributorBranch.id).where(DistributorBranch.branch_code == branch_code)
        )
        if duplicate_code.scalar_one_or_none() is not None:
            next_num += 1
            continue
        return branch_id, branch_code


async def _actor_can_auto_activate_branch(db: AsyncSession, actor: User | None) -> bool:
    if actor is None:
        return True
    role_keys = await list_user_role_keys(db, actor.id)
    return "super_admin" in role_keys or MITRA_SUPER_HEAD_ROLE_KEY in role_keys


async def _validate_branch_manager_candidate(db: AsyncSession, manager_user_id: UUID) -> User:
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
    return manager


async def _require_branch_approver(db: AsyncSession, actor: User) -> None:
    role_keys = await list_user_role_keys(db, actor.id)
    if "super_admin" not in role_keys and MITRA_SUPER_HEAD_ROLE_KEY not in role_keys:
        raise AdminDistributorHierarchyError(
            "You do not have permission to approve branch opening requests.",
            "forbidden",
            403,
        )


async def resolve_admin_hierarchy_state_filter(db: AsyncSession, *, user: User) -> str | None:
    role_keys = await list_user_role_keys(db, user.id)
    if "super_admin" in role_keys or MITRA_SUPER_HEAD_ROLE_KEY in role_keys:
        return None
    if MITRA_STATE_HEAD_ROLE_KEY in role_keys:
        result = await db.execute(select(DistributorStateHead).where(DistributorStateHead.user_id == user.id))
        assignment = result.scalar_one_or_none()
        return assignment.state_code if assignment else "__none__"
    return None


async def get_actor_hierarchy_state_scope(
    db: AsyncSession,
    *,
    actor: User,
) -> tuple[str, str] | None:
    role_keys = await list_user_role_keys(db, actor.id)
    if "super_admin" in role_keys or MITRA_SUPER_HEAD_ROLE_KEY in role_keys:
        return None
    if MITRA_STATE_HEAD_ROLE_KEY not in role_keys:
        return None

    result = await db.execute(select(DistributorStateHead).where(DistributorStateHead.user_id == actor.id))
    assignment = result.scalar_one_or_none()
    if assignment is None:
        raise AdminDistributorHierarchyError(
            "No state assigned yet. Ask your Mitra Super Head to link you on the State Heads tab.",
            "state_head_missing",
            403,
        )
    if assignment.status == STATE_HEAD_STATUS_PAUSED:
        raise AdminDistributorHierarchyError(
            "Your Mitra State Head access is paused. Contact your Mitra Super Head.",
            "state_head_paused",
            403,
        )
    return assignment.state_code, assignment.state_name


async def resolve_actor_state_head_assignment(
    db: AsyncSession,
    *,
    actor: User,
) -> tuple[str, str] | None:
    role_keys = await list_user_role_keys(db, actor.id)
    if MITRA_STATE_HEAD_ROLE_KEY not in role_keys:
        return None
    if "super_admin" in role_keys or MITRA_SUPER_HEAD_ROLE_KEY in role_keys:
        return None

    result = await db.execute(select(DistributorStateHead).where(DistributorStateHead.user_id == actor.id))
    assignment = result.scalar_one_or_none()
    if assignment is None:
        return None
    if assignment.status == STATE_HEAD_STATUS_PAUSED:
        return None
    return assignment.state_code, assignment.state_name


def _enforce_branch_state_scope(
    actor_scope: tuple[str, str] | None,
    *,
    state_code: str,
    state_name: str,
) -> None:
    if actor_scope is None:
        return

    scoped_code, scoped_name = actor_scope
    normalized_code = state_code.strip().upper()
    if normalized_code != scoped_code:
        raise AdminDistributorHierarchyError(
            f"Branches must be created in {scoped_name} ({scoped_code}).",
            "state_scope_violation",
            403,
        )
    if state_name.strip().casefold() != scoped_name.casefold():
        raise AdminDistributorHierarchyError(
            f"Branches must be created in {scoped_name} ({scoped_code}).",
            "state_scope_violation",
            403,
        )


async def _partner_stats_by_branch(db: AsyncSession) -> dict[str, dict[str, int | float]]:
    result = await db.execute(
        select(DistributorPartner).where(DistributorPartner.branch_id.is_not(None))
    )
    stats: dict[str, dict[str, int | float]] = {}
    for partner in result.scalars().all():
        branch_id = partner.branch_id
        if not branch_id:
            continue
        bucket = stats.setdefault(branch_id, _empty_branch_partner_stats())
        bucket["partner_count"] = int(bucket["partner_count"]) + 1
        if partner.status == DistributorPartnerStatus.active:
            bucket["active_partner_count"] = int(bucket["active_partner_count"]) + 1
    return stats


async def _partner_counts_by_branch(db: AsyncSession) -> dict[str, int]:
    stats = await _partner_stats_by_branch(db)
    return {branch_id: int(values["partner_count"]) for branch_id, values in stats.items()}


async def list_admin_distributor_branches(
    db: AsyncSession,
    *,
    state_filter: str | None,
) -> list[dict[str, Any]]:
    query = (
        select(DistributorBranch, User)
        .outerjoin(User, User.id == DistributorBranch.manager_user_id)
        .order_by(DistributorBranch.name.asc())
    )
    if state_filter == "__none__":
        return []
    if state_filter:
        query = query.where(DistributorBranch.state_code == state_filter)

    rows = (await db.execute(query)).all()
    partner_stats = await _partner_stats_by_branch(db)
    return [
        _serialize_branch_row(
            branch,
            manager=manager,
            manager_unavailable=_manager_unavailable(branch, manager),
            **(partner_stats.get(branch.id) or _empty_branch_partner_stats()),
        )
        for branch, manager in rows
    ]


async def get_admin_distributor_branch(
    db: AsyncSession,
    *,
    branch_id: str,
    state_filter: str | None,
) -> dict[str, Any]:
    normalized_id = branch_id.strip().lower()
    branch = await db.get(DistributorBranch, normalized_id)
    if branch is None:
        raise AdminDistributorHierarchyError("Branch not found.", "branch_not_found", 404)
    if state_filter == "__none__":
        raise AdminDistributorHierarchyError("Branch not found.", "branch_not_found", 404)
    if state_filter and branch.state_code != state_filter:
        raise AdminDistributorHierarchyError("Branch not found.", "branch_not_found", 404)

    manager = await db.get(User, branch.manager_user_id) if branch.manager_user_id else None
    created_by = await db.get(User, branch.created_by_user_id) if branch.created_by_user_id else None
    approved_by = await db.get(User, branch.approved_by_user_id) if branch.approved_by_user_id else None
    partner_stats = await _partner_stats_by_branch(db)
    return _serialize_branch_detail(
        branch,
        manager=manager,
        created_by=created_by,
        approved_by=approved_by,
        stats=partner_stats.get(branch.id),
    )


async def list_admin_distributor_managers(
    db: AsyncSession,
    *,
    state_filter: str | None,
) -> list[dict[str, Any]]:
    branch_query = (
        select(DistributorBranch, User)
        .join(User, User.id == DistributorBranch.manager_user_id)
        .where(
            DistributorBranch.manager_user_id.is_not(None),
            DistributorBranch.status == DistributorBranchStatus.active,
        )
    )
    if state_filter == "__none__":
        return []
    if state_filter:
        branch_query = branch_query.where(DistributorBranch.state_code == state_filter)
    branch_rows = (await db.execute(branch_query.order_by(User.first_name.asc(), User.last_name.asc()))).all()

    partner_counts = await _partner_counts_by_branch(db)
    return [
        {
            **user_identity_fields(manager),
            "id": user_path_ref(manager),
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
                "id": user.client_id or user_path_ref(user),
                "partner_id": str(partner.id),
                **user_identity_fields(user),
                "name": _display_name(user),
                "email": user.email,
                "arn": partner.arn or "",
                "euin": partner.euin or "",
                "manager_id": user_path_ref(manager) if manager else None,
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
    actor: User | None = None,
) -> dict[str, Any]:
    actor_assignment = (
        await resolve_actor_state_head_assignment(db, actor=actor) if actor is not None else None
    )
    branches = await list_admin_distributor_branches(db, state_filter=state_filter)
    managers = await list_admin_distributor_managers(db, state_filter=state_filter)
    partners = await list_admin_distributor_partners(db, state_filter=state_filter)

    if state_filter == "__none__":
        pending_count = 0
        pending_branch_count = 0
        state_code = ""
        state_name = ""
        state_assigned = False
    else:
        pending_query = select(func.count()).select_from(DistributorPartner).where(
            DistributorPartner.status == DistributorPartnerStatus.pending_ho_review
        )
        pending_branch_query = select(func.count()).select_from(DistributorBranch).where(
            DistributorBranch.status == DistributorBranchStatus.pending_approval
        )
        if state_filter:
            pending_query = pending_query.join(
                DistributorBranch,
                DistributorBranch.id == DistributorPartner.branch_id,
            ).where(DistributorBranch.state_code == state_filter)
            pending_branch_query = pending_branch_query.where(DistributorBranch.state_code == state_filter)
        pending_count = (await db.execute(pending_query)).scalar_one()
        pending_branch_count = (await db.execute(pending_branch_query)).scalar_one()
        if actor_assignment is not None:
            state_code, state_name = actor_assignment
            state_assigned = True
        elif branches:
            state_code = branches[0]["state_code"]
            state_name = branches[0]["state_name"]
            state_assigned = True
        elif managers:
            state_code = managers[0]["state_code"]
            state_name = managers[0]["state_name"]
            state_assigned = True
        elif state_filter:
            assignment_row = (
                await db.execute(
                    select(DistributorStateHead.state_code, DistributorStateHead.state_name)
                    .where(DistributorStateHead.state_code == state_filter)
                    .limit(1)
                )
            ).first()
            if assignment_row is not None:
                state_code, state_name = assignment_row
                state_assigned = True
            else:
                state_code = state_filter
                state_name = state_filter
                state_assigned = True
        else:
            state_code = "MH"
            state_name = "Maharashtra"
            state_assigned = True

    active_partners = sum(1 for row in partners if row["status"] == "Active")
    return {
        "state_code": state_code,
        "state_name": state_name,
        "state_assigned": state_assigned,
        "manager_count": len(managers),
        "partner_count": len(partners),
        "active_partner_count": active_partners,
        "branch_count": len(branches),
        "pending_review_count": pending_count,
        "pending_branch_count": pending_branch_count,
        "sales_mtd_inr": 0,
    }


async def list_eligible_branch_manager_candidates(db: AsyncSession) -> list[dict[str, Any]]:
    assigned_manager_ids = select(DistributorBranch.manager_user_id).where(
        DistributorBranch.manager_user_id.is_not(None)
    )
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
            **user_identity_fields(user),
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
    manager_user_id: UUID | None = None,
    branch_id: str | None = None,
    actor: User | None = None,
) -> dict[str, Any]:
    cleaned_state_code = state_code.strip().upper()
    cleaned_state_name = state_name.strip()
    if actor is not None:
        actor_scope = await get_actor_hierarchy_state_scope(db, actor=actor)
        _enforce_branch_state_scope(
            actor_scope,
            state_code=cleaned_state_code,
            state_name=cleaned_state_name,
        )

    cleaned_name = name.strip()
    if len(cleaned_name) < 2:
        raise AdminDistributorHierarchyError("Enter a branch name.", "invalid_branch_name", 400)

    if len(cleaned_state_code) < 2 or len(cleaned_state_name) < 2:
        raise AdminDistributorHierarchyError("Enter a valid state.", "invalid_state", 400)

    normalized_id = (branch_id or "").strip().lower()
    if normalized_id:
        if not _BRANCH_ID_PATTERN.fullmatch(normalized_id):
            raise AdminDistributorHierarchyError(
                "Branch id must be 2–31 lowercase letters, numbers, or hyphens.",
                "invalid_branch_id",
                400,
            )
        branch_code = normalized_id.upper().replace("-", "")[:16]
    else:
        normalized_id, branch_code = await _generate_state_branch_code(db, cleaned_state_code)

    existing = await db.get(DistributorBranch, normalized_id)
    if existing is not None:
        raise AdminDistributorHierarchyError("This branch id is already in use.", "branch_exists", 409)

    duplicate_code = await db.execute(
        select(DistributorBranch.id).where(DistributorBranch.branch_code == branch_code)
    )
    if duplicate_code.scalar_one_or_none() is not None:
        raise AdminDistributorHierarchyError("This branch code is already in use.", "branch_code_exists", 409)

    manager: User | None = None
    if manager_user_id is not None:
        manager = await _validate_branch_manager_candidate(db, manager_user_id)

    auto_activate = await _actor_can_auto_activate_branch(db, actor)
    now = utcnow()
    branch = DistributorBranch(
        id=normalized_id,
        branch_code=branch_code,
        name=cleaned_name,
        city=(city or "").strip() or None,
        state_code=cleaned_state_code,
        state_name=cleaned_state_name,
        status=DistributorBranchStatus.active if auto_activate else DistributorBranchStatus.pending_approval,
        manager_user_id=manager_user_id,
        created_by_user_id=actor.id if actor is not None else None,
        approved_by_user_id=actor.id if auto_activate and actor is not None else None,
        approved_at=now if auto_activate else None,
        created_at=now,
        updated_at=now,
    )
    db.add(branch)
    await db.flush()
    await write_admin_module_audit(
        db,
        actor=actor,
        module="mitra_hierarchy",
        kind="distributor_branch_created",
        branch_id=branch.id,
        branch_name=branch.name,
        state_code=branch.state_code,
        status=branch.status.value,
    )
    partner_stats = await _partner_stats_by_branch(db)
    return _serialize_branch_row(
        branch,
        manager=manager,
        manager_unavailable=_manager_unavailable(branch, manager),
        **(partner_stats.get(branch.id) or _empty_branch_partner_stats()),
    )


async def approve_admin_distributor_branch(
    db: AsyncSession,
    *,
    branch_id: str,
    actor: User,
) -> dict[str, Any]:
    await _require_branch_approver(db, actor)
    branch = await db.get(DistributorBranch, branch_id.strip().lower())
    if branch is None:
        raise AdminDistributorHierarchyError("Branch not found.", "branch_not_found", 404)
    if branch.status != DistributorBranchStatus.pending_approval:
        raise AdminDistributorHierarchyError(
            "Only pending branch opening requests can be approved.",
            "invalid_branch_status",
            400,
        )

    now = utcnow()
    branch.status = DistributorBranchStatus.active
    branch.approved_by_user_id = actor.id
    branch.approved_at = now
    branch.rejection_reason = None
    branch.updated_at = now
    await db.flush()
    await write_admin_module_audit(
        db,
        actor=actor,
        module="mitra_hierarchy",
        kind="distributor_branch_approved",
        branch_id=branch.id,
        branch_name=branch.name,
        state_code=branch.state_code,
    )

    manager = await db.get(User, branch.manager_user_id) if branch.manager_user_id else None
    partner_stats = await _partner_stats_by_branch(db)
    return _serialize_branch_row(
        branch,
        manager=manager,
        manager_unavailable=_manager_unavailable(branch, manager),
        **(partner_stats.get(branch.id) or _empty_branch_partner_stats()),
    )


async def reject_admin_distributor_branch(
    db: AsyncSession,
    *,
    branch_id: str,
    actor: User,
    reason: str | None = None,
) -> dict[str, Any]:
    await _require_branch_approver(db, actor)
    branch = await db.get(DistributorBranch, branch_id.strip().lower())
    if branch is None:
        raise AdminDistributorHierarchyError("Branch not found.", "branch_not_found", 404)
    if branch.status != DistributorBranchStatus.pending_approval:
        raise AdminDistributorHierarchyError(
            "Only pending branch opening requests can be rejected.",
            "invalid_branch_status",
            400,
        )

    now = utcnow()
    branch.status = DistributorBranchStatus.rejected
    branch.approved_by_user_id = actor.id
    branch.approved_at = now
    branch.rejection_reason = (reason or "").strip() or None
    branch.updated_at = now
    await db.flush()
    await write_admin_module_audit(
        db,
        actor=actor,
        module="mitra_hierarchy",
        kind="distributor_branch_rejected",
        branch_id=branch.id,
        branch_name=branch.name,
        state_code=branch.state_code,
        reason=branch.rejection_reason,
    )

    manager = await db.get(User, branch.manager_user_id) if branch.manager_user_id else None
    partner_stats = await _partner_stats_by_branch(db)
    return _serialize_branch_row(
        branch,
        manager=manager,
        manager_unavailable=_manager_unavailable(branch, manager),
        **(partner_stats.get(branch.id) or _empty_branch_partner_stats()),
    )


async def assign_admin_distributor_branch_manager(
    db: AsyncSession,
    *,
    branch_id: str,
    manager_user_id: UUID,
    actor: User,
    replace_existing: bool = False,
) -> dict[str, Any]:
    branch = await db.get(DistributorBranch, branch_id.strip().lower())
    if branch is None:
        raise AdminDistributorHierarchyError("Branch not found.", "branch_not_found", 404)
    if branch.status != DistributorBranchStatus.active:
        raise AdminDistributorHierarchyError(
            "Managers can only be assigned to active branches.",
            "invalid_branch_status",
            400,
        )

    await _enforce_branch_manager_assignment_actor(db, actor=actor, branch=branch)

    existing_manager = await _load_branch_manager(db, branch)
    if branch.manager_user_id is not None:
        if await _is_active_branch_manager(db, existing_manager):
            if not replace_existing:
                raise AdminDistributorHierarchyError(
                    "This branch already has a manager assigned. Remove or replace the current manager first.",
                    "manager_already_assigned",
                    409,
                )
        elif not replace_existing:
            pass

    manager = await _validate_branch_manager_candidate(db, manager_user_id)
    previous_manager_id = str(branch.manager_user_id) if branch.manager_user_id else None
    branch.manager_user_id = manager_user_id
    branch.updated_at = utcnow()
    await db.flush()
    await write_admin_module_audit(
        db,
        actor=actor,
        module="mitra_hierarchy",
        kind="distributor_branch_manager_assigned",
        branch_id=branch.id,
        branch_name=branch.name,
        manager_user_id=str(manager_user_id),
        previous_manager_user_id=previous_manager_id,
        replaced=replace_existing or bool(previous_manager_id),
    )
    partner_stats = await _partner_stats_by_branch(db)
    return _serialize_branch_row(
        branch,
        manager=manager,
        manager_unavailable=False,
        **(partner_stats.get(branch.id) or _empty_branch_partner_stats()),
    )


async def unassign_admin_distributor_branch_manager(
    db: AsyncSession,
    *,
    branch_id: str,
    actor: User,
) -> dict[str, Any]:
    branch = await db.get(DistributorBranch, branch_id.strip().lower())
    if branch is None:
        raise AdminDistributorHierarchyError("Branch not found.", "branch_not_found", 404)
    if branch.status != DistributorBranchStatus.active:
        raise AdminDistributorHierarchyError(
            "Managers can only be removed from active branches.",
            "invalid_branch_status",
            400,
        )
    if branch.manager_user_id is None:
        raise AdminDistributorHierarchyError(
            "This branch does not have a manager assigned.",
            "manager_not_assigned",
            409,
        )

    await _enforce_branch_manager_assignment_actor(db, actor=actor, branch=branch)

    previous_manager_id = str(branch.manager_user_id)
    branch.manager_user_id = None
    branch.updated_at = utcnow()
    await db.flush()
    await write_admin_module_audit(
        db,
        actor=actor,
        module="mitra_hierarchy",
        kind="distributor_branch_manager_unassigned",
        branch_id=branch.id,
        branch_name=branch.name,
        previous_manager_user_id=previous_manager_id,
    )
    partner_stats = await _partner_stats_by_branch(db)
    return _serialize_branch_row(
        branch,
        manager=None,
        manager_unavailable=False,
        **(partner_stats.get(branch.id) or _empty_branch_partner_stats()),
    )


async def update_admin_distributor_branch(
    db: AsyncSession,
    *,
    branch_id: str,
    actor: User,
    name: str | None = None,
    city: str | None = None,
) -> dict[str, Any]:
    branch = await db.get(DistributorBranch, branch_id.strip().lower())
    if branch is None:
        raise AdminDistributorHierarchyError("Branch not found.", "branch_not_found", 404)
    if branch.status == DistributorBranchStatus.rejected:
        raise AdminDistributorHierarchyError(
            "Rejected branches cannot be edited.",
            "invalid_branch_status",
            400,
        )

    role_keys = await list_user_role_keys(db, actor.id)
    is_state_head_only = (
        MITRA_STATE_HEAD_ROLE_KEY in role_keys
        and "super_admin" not in role_keys
        and MITRA_SUPER_HEAD_ROLE_KEY not in role_keys
    )
    if is_state_head_only:
        if branch.created_by_user_id != actor.id:
            raise AdminDistributorHierarchyError(
                "You can only edit branches you opened.",
                "branch_owner_required",
                403,
            )
        actor_scope = await get_actor_hierarchy_state_scope(db, actor=actor)
        _enforce_branch_state_scope(
            actor_scope,
            state_code=branch.state_code,
            state_name=branch.state_name,
        )

    updates: dict[str, Any] = {}
    if name is not None:
        cleaned = name.strip()
        if len(cleaned) < 2:
            raise AdminDistributorHierarchyError(
                "Branch name must be at least 2 characters.",
                "invalid_branch_name",
                400,
            )
        updates["name"] = cleaned
    if city is not None:
        updates["city"] = city.strip() or None

    if not updates:
        raise AdminDistributorHierarchyError(
            "No branch details were provided to update.",
            "empty_update",
            400,
        )

    for key, value in updates.items():
        setattr(branch, key, value)
    branch.updated_at = utcnow()
    await db.flush()
    await write_admin_module_audit(
        db,
        actor=actor,
        module="mitra_hierarchy",
        kind="distributor_branch_updated",
        branch_id=branch.id,
        branch_name=branch.name,
        updates=updates,
    )

    manager = await _load_branch_manager(db, branch)
    partner_stats = await _partner_stats_by_branch(db)
    return _serialize_branch_row(
        branch,
        manager=manager,
        manager_unavailable=_manager_unavailable(branch, manager),
        **(partner_stats.get(branch.id) or _empty_branch_partner_stats()),
    )


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
    if not rows:
        return []

    branches = await list_admin_distributor_branches(db, state_filter=state_filter)
    managers = await list_admin_distributor_managers(db, state_filter=state_filter)
    partners = await list_admin_distributor_partners(db, state_filter=state_filter)

    branch_stats: dict[str, dict[str, int | float]] = {}
    for branch in branches:
        code = branch["state_code"]
        stats = branch_stats.setdefault(
            code,
            {
                "branch_count": 0,
                "pending_branch_count": 0,
                "unassigned_branch_count": 0,
                "aum_inr": 0.0,
                "sales_mtd_inr": 0.0,
                "client_count": 0,
            },
        )
        stats["branch_count"] = int(stats["branch_count"]) + 1
        if branch["status"] == DistributorBranchStatus.pending_approval.value:
            stats["pending_branch_count"] = int(stats["pending_branch_count"]) + 1
        if not branch.get("manager_id"):
            stats["unassigned_branch_count"] = int(stats["unassigned_branch_count"]) + 1
        stats["aum_inr"] = float(stats["aum_inr"]) + float(branch.get("aum_inr") or 0)
        stats["sales_mtd_inr"] = float(stats["sales_mtd_inr"]) + float(branch.get("sales_mtd_inr") or 0)
        stats["client_count"] = int(stats["client_count"]) + int(branch.get("active_clients") or 0)

    manager_counts: dict[str, int] = {}
    for manager in managers:
        code = manager["state_code"]
        manager_counts[code] = manager_counts.get(code, 0) + 1

    partner_stats: dict[str, dict[str, int | float]] = {}
    branch_by_id = {branch["id"]: branch for branch in branches}
    for partner in partners:
        branch = branch_by_id.get(partner.get("branch_id") or "")
        if branch is None:
            continue
        state_code = branch["state_code"]
        stats = partner_stats.setdefault(
            state_code,
            {
                "partner_count": 0,
                "active_partner_count": 0,
                "aum_inr": 0.0,
                "sales_mtd_inr": 0.0,
                "client_count": 0,
            },
        )
        stats["partner_count"] = int(stats["partner_count"]) + 1
        if partner.get("status") == "Active":
            stats["active_partner_count"] = int(stats["active_partner_count"]) + 1
        stats["aum_inr"] = float(stats["aum_inr"]) + float(partner.get("aum_inr") or 0)
        stats["sales_mtd_inr"] = float(stats["sales_mtd_inr"]) + float(partner.get("sales_mtd_inr") or 0)
        stats["client_count"] = int(stats["client_count"]) + int(partner.get("client_count") or 0)

    items: list[dict[str, Any]] = []
    for assignment, user in rows:
        code = assignment.state_code
        branch = branch_stats.get(code, {})
        partner = partner_stats.get(code, {})
        aum_inr = float(partner.get("aum_inr") or 0) or float(branch.get("aum_inr") or 0)
        sales_mtd_inr = float(partner.get("sales_mtd_inr") or 0) or float(branch.get("sales_mtd_inr") or 0)
        client_count = int(partner.get("client_count") or 0) or int(branch.get("client_count") or 0)
        items.append(
            {
                **user_identity_fields(user),
                "name": _display_name(user),
                "email": user.email,
                "state_code": assignment.state_code,
                "state_name": assignment.state_name,
                "status": assignment.status or STATE_HEAD_STATUS_ACTIVE,
                "manager_count": manager_counts.get(code, 0),
                "branch_count": int(branch.get("branch_count") or 0),
                "pending_branch_count": int(branch.get("pending_branch_count") or 0),
                "unassigned_branch_count": int(branch.get("unassigned_branch_count") or 0),
                "partner_count": int(partner.get("partner_count") or 0),
                "active_partner_count": int(partner.get("active_partner_count") or 0),
                "client_count": client_count,
                "aum_inr": aum_inr,
                "sales_mtd_inr": sales_mtd_inr,
            }
        )
    return items


async def list_unassigned_hierarchy_states(
    db: AsyncSession,
    *,
    state_filter: str | None,
) -> list[dict[str, Any]]:
    """States that have hierarchy activity but no Mitra State Head assigned."""
    if state_filter == "__none__":
        return []

    assigned_codes = {
        row
        for row in (
            await db.execute(select(DistributorStateHead.state_code))
        ).scalars().all()
    }

    branch_query = select(
        DistributorBranch.state_code,
        DistributorBranch.state_name,
        func.count(DistributorBranch.id),
    ).group_by(DistributorBranch.state_code, DistributorBranch.state_name)
    if state_filter:
        branch_query = branch_query.where(DistributorBranch.state_code == state_filter)

    rows = (await db.execute(branch_query.order_by(DistributorBranch.state_name.asc()))).all()
    items: list[dict[str, Any]] = []
    for state_code, state_name, branch_count in rows:
        if state_code in assigned_codes:
            continue
        items.append(
            {
                "state_code": state_code,
                "state_name": state_name,
                "branch_count": int(branch_count or 0),
                "message": "No Mitra State Head assigned for this state.",
            }
        )
    return items


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
            **user_identity_fields(user),
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
    actor: User | None = None,
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
            status=STATE_HEAD_STATUS_ACTIVE,
            created_at=now,
            updated_at=now,
        )
    )
    await db.flush()
    await write_admin_module_audit(
        db,
        actor=actor,
        module="mitra_hierarchy",
        kind="mitra_state_head_assigned",
        state_head_user_id=str(user_id),
        state_code=cleaned_state_code,
        state_name=cleaned_state_name,
    )

    return {
        **user_identity_fields(user),
        "name": _display_name(user),
        "email": user.email,
        "state_code": cleaned_state_code,
        "state_name": cleaned_state_name,
        "status": STATE_HEAD_STATUS_ACTIVE,
    }


async def _safe_revoke_mitra_state_head_role(db: AsyncSession, *, user_id: UUID) -> None:
    try:
        await revoke_role_from_admin_user(
            db,
            user_id=user_id,
            role_key=MITRA_STATE_HEAD_ROLE_KEY,
        )
    except ValueError as exc:
        message = str(exc).lower()
        if "not found" in message or "last assigned" in message:
            return
        raise AdminDistributorHierarchyError(message, "role_revoke_failed", 400) from exc


async def _serialize_state_head_assignment(
    db: AsyncSession,
    *,
    assignment: DistributorStateHead,
) -> dict[str, Any]:
    user = await db.get(User, assignment.user_id)
    if user is None:
        raise AdminDistributorHierarchyError("Admin user not found.", "user_not_found", 404)
    return {
        **user_identity_fields(user),
        "name": _display_name(user),
        "email": user.email,
        "state_code": assignment.state_code,
        "state_name": assignment.state_name,
        "status": assignment.status or STATE_HEAD_STATUS_ACTIVE,
    }


async def pause_admin_distributor_state_head(
    db: AsyncSession,
    *,
    user_id: UUID,
    actor: User | None = None,
    ip: str | None = None,
) -> dict[str, Any]:
    assignment = await db.get(DistributorStateHead, user_id)
    if assignment is None:
        raise AdminDistributorHierarchyError(
            "Mitra State Head assignment not found.",
            "state_head_not_found",
            404,
        )
    if assignment.status == STATE_HEAD_STATUS_PAUSED:
        raise AdminDistributorHierarchyError(
            "This Mitra State Head is already paused.",
            "state_head_already_paused",
            400,
        )

    assignment.status = STATE_HEAD_STATUS_PAUSED
    assignment.updated_at = utcnow()
    await db.flush()
    await revoke_all_sessions(db, user_id=user_id, ip=ip, reason="state_head_paused")
    await write_admin_module_audit(
        db,
        actor=actor,
        module="mitra_hierarchy",
        kind="mitra_state_head_paused",
        state_head_user_id=str(user_id),
        state_code=assignment.state_code,
        ip=ip,
    )
    return await _serialize_state_head_assignment(db, assignment=assignment)


async def resume_admin_distributor_state_head(
    db: AsyncSession,
    *,
    user_id: UUID,
    actor: User | None = None,
) -> dict[str, Any]:
    assignment = await db.get(DistributorStateHead, user_id)
    if assignment is None:
        raise AdminDistributorHierarchyError(
            "Mitra State Head assignment not found.",
            "state_head_not_found",
            404,
        )
    if assignment.status != STATE_HEAD_STATUS_PAUSED:
        raise AdminDistributorHierarchyError(
            "This Mitra State Head is not paused.",
            "state_head_not_paused",
            400,
        )

    user = await db.get(User, user_id)
    if user is None or user.status != UserStatus.active:
        raise AdminDistributorHierarchyError(
            "Cannot resume a Mitra State Head whose account is not active.",
            "user_inactive",
            400,
        )

    assignment.status = STATE_HEAD_STATUS_ACTIVE
    assignment.updated_at = utcnow()
    await db.flush()
    await write_admin_module_audit(
        db,
        actor=actor,
        module="mitra_hierarchy",
        kind="mitra_state_head_resumed",
        state_head_user_id=str(user_id),
        state_code=assignment.state_code,
    )
    return await _serialize_state_head_assignment(db, assignment=assignment)


async def unassign_admin_distributor_state_head(
    db: AsyncSession,
    *,
    user_id: UUID,
    actor: User | None = None,
    ip: str | None = None,
) -> dict[str, Any]:
    assignment = await db.get(DistributorStateHead, user_id)
    if assignment is None:
        raise AdminDistributorHierarchyError(
            "Mitra State Head assignment not found.",
            "state_head_not_found",
            404,
        )

    snapshot = {
        "user_id": str(user_id),
        "state_code": assignment.state_code,
        "state_name": assignment.state_name,
        "status": assignment.status or STATE_HEAD_STATUS_ACTIVE,
        "unassigned": True,
        "message": "No Mitra State Head assigned for this state.",
    }
    await db.delete(assignment)
    await db.flush()
    await _safe_revoke_mitra_state_head_role(db, user_id=user_id)
    await revoke_all_sessions(db, user_id=user_id, ip=ip, reason="state_head_unassigned")
    await write_admin_module_audit(
        db,
        actor=actor,
        module="mitra_hierarchy",
        kind="mitra_state_head_unassigned",
        state_head_user_id=str(user_id),
        state_code=snapshot["state_code"],
        ip=ip,
    )
    return snapshot


async def replace_admin_distributor_state_head(
    db: AsyncSession,
    *,
    current_user_id: UUID,
    replacement_user_id: UUID,
    actor: User | None = None,
    ip: str | None = None,
) -> dict[str, Any]:
    if current_user_id == replacement_user_id:
        raise AdminDistributorHierarchyError(
            "Choose a different admin user to replace this Mitra State Head.",
            "replacement_same_user",
            400,
        )

    current = await db.get(DistributorStateHead, current_user_id)
    if current is None:
        raise AdminDistributorHierarchyError(
            "Mitra State Head assignment not found.",
            "state_head_not_found",
            404,
        )

    replacement = await db.get(User, replacement_user_id)
    if replacement is None or replacement.role != UserRole.admin:
        raise AdminDistributorHierarchyError("Admin user not found.", "user_not_found", 404)
    if replacement.status != UserStatus.active:
        raise AdminDistributorHierarchyError("Admin user is not active.", "user_inactive", 400)

    rbac_result = await db.execute(
        select(AdminUserRoleAssignment.id)
        .where(AdminUserRoleAssignment.user_id == replacement_user_id)
        .limit(1)
    )
    if rbac_result.scalar_one_or_none() is None:
        raise AdminDistributorHierarchyError(
            "Assign at least one admin RBAC role before making this user a Mitra State Head.",
            "rbac_required",
            400,
        )

    existing_replacement = await db.get(DistributorStateHead, replacement_user_id)
    if existing_replacement is not None:
        raise AdminDistributorHierarchyError(
            "This user is already assigned as a Mitra State Head.",
            "user_state_head_exists",
            409,
        )

    state_code = current.state_code
    state_name = current.state_name
    await db.delete(current)
    await db.flush()
    await _safe_revoke_mitra_state_head_role(db, user_id=current_user_id)
    await revoke_all_sessions(db, user_id=current_user_id, ip=ip, reason="state_head_replaced")

    try:
        await assign_role_to_admin_user(
            db,
            user_id=replacement_user_id,
            role_key=MITRA_STATE_HEAD_ROLE_KEY,
        )
    except ValueError as exc:
        message = str(exc)
        if "already assigned" not in message.lower():
            raise AdminDistributorHierarchyError(message, "role_assign_failed", 400) from exc

    now = utcnow()
    next_assignment = DistributorStateHead(
        user_id=replacement_user_id,
        state_code=state_code,
        state_name=state_name,
        status=STATE_HEAD_STATUS_ACTIVE,
        created_at=now,
        updated_at=now,
    )
    db.add(next_assignment)
    await db.flush()
    await write_admin_module_audit(
        db,
        actor=actor,
        module="mitra_hierarchy",
        kind="mitra_state_head_replaced",
        previous_state_head_user_id=str(current_user_id),
        replacement_state_head_user_id=str(replacement_user_id),
        state_code=state_code,
        ip=ip,
    )

    return {
        "previous_user_id": str(current_user_id),
        "state_head": await _serialize_state_head_assignment(db, assignment=next_assignment),
    }


async def invite_admin_mitra_manager(
    db: AsyncSession,
    *,
    actor: User,
    email: str,
    first_name: str | None = None,
    last_name: str | None = None,
    ip: str | None = None,
) -> dict[str, Any]:
    from app.application.admin.admin_invitation_service import create_admin_invitation

    role_keys = await list_user_role_keys(db, actor.id)
    if (
        "super_admin" not in role_keys
        and MITRA_SUPER_HEAD_ROLE_KEY not in role_keys
        and MITRA_STATE_HEAD_ROLE_KEY not in role_keys
    ):
        raise AdminDistributorHierarchyError(
            "You do not have permission to invite Mitra Managers.",
            "forbidden",
            403,
        )

    try:
        return await create_admin_invitation(
            db,
            actor=actor,
            email=email,
            role_key=DISTRIBUTOR_MANAGER_ROLE_KEY,
            first_name=first_name,
            last_name=last_name,
            ip=ip,
        )
    except ValueError as exc:
        raise AdminDistributorHierarchyError(str(exc), "invitation_failed", 400) from exc


async def _ensure_can_manage_mitra_manager_invitation(
    db: AsyncSession,
    *,
    actor: User,
    invitation: AdminInvitation,
) -> None:
    if invitation.role_key != DISTRIBUTOR_MANAGER_ROLE_KEY:
        raise AdminDistributorHierarchyError("Invitation not found.", "invitation_not_found", 404)

    role_keys = await list_user_role_keys(db, actor.id)
    if "super_admin" in role_keys or MITRA_SUPER_HEAD_ROLE_KEY in role_keys:
        return
    if MITRA_STATE_HEAD_ROLE_KEY in role_keys and invitation.invited_by == actor.id:
        return

    raise AdminDistributorHierarchyError(
        "You do not have permission to manage this invitation.",
        "forbidden",
        403,
    )


async def _ensure_can_list_mitra_manager_invitations(
    db: AsyncSession,
    *,
    actor: User,
) -> None:
    role_keys = await list_user_role_keys(db, actor.id)
    if (
        "super_admin" in role_keys
        or MITRA_SUPER_HEAD_ROLE_KEY in role_keys
        or MITRA_STATE_HEAD_ROLE_KEY in role_keys
    ):
        return
    raise AdminDistributorHierarchyError(
        "You do not have permission to view Mitra Manager invitations.",
        "forbidden",
        403,
    )


async def list_admin_mitra_manager_invitations(
    db: AsyncSession,
    *,
    actor: User,
) -> list[dict[str, Any]]:
    from app.application.admin.admin_invitation_service import (
        _get_inviter_name,
        _get_role_name,
        _invitation_to_dict,
        _mark_expired_invitations,
    )

    await _ensure_can_list_mitra_manager_invitations(db, actor=actor)
    await _mark_expired_invitations(db)

    role_keys = await list_user_role_keys(db, actor.id)
    query = (
        select(AdminInvitation)
        .where(AdminInvitation.role_key == DISTRIBUTOR_MANAGER_ROLE_KEY)
        .order_by(AdminInvitation.created_at.desc())
    )
    if "super_admin" not in role_keys and MITRA_SUPER_HEAD_ROLE_KEY not in role_keys:
        query = query.where(AdminInvitation.invited_by == actor.id)

    items: list[dict[str, Any]] = []
    for invitation in (await db.execute(query)).scalars().all():
        items.append(
            _invitation_to_dict(
                invitation,
                role_name=await _get_role_name(db, invitation.role_key),
                inviter_name=await _get_inviter_name(db, invitation.invited_by),
            )
        )
    return items


async def revoke_admin_mitra_manager_invitation(
    db: AsyncSession,
    *,
    actor: User,
    invitation_id: UUID,
    ip: str | None = None,
) -> dict[str, Any]:
    from app.application.admin.admin_invitation_service import revoke_admin_invitation

    invitation = await db.get(AdminInvitation, invitation_id)
    if invitation is None:
        raise AdminDistributorHierarchyError("Invitation not found.", "invitation_not_found", 404)

    await _ensure_can_manage_mitra_manager_invitation(db, actor=actor, invitation=invitation)
    try:
        return await revoke_admin_invitation(
            db,
            actor=actor,
            invitation_id=invitation_id,
            ip=ip,
        )
    except ValueError as exc:
        raise AdminDistributorHierarchyError(str(exc), "invitation_revoke_failed", 400) from exc


async def resend_admin_mitra_manager_invitation(
    db: AsyncSession,
    *,
    actor: User,
    invitation_id: UUID,
    ip: str | None = None,
) -> dict[str, Any]:
    from app.application.admin.admin_invitation_service import resend_admin_invitation

    invitation = await db.get(AdminInvitation, invitation_id)
    if invitation is None:
        raise AdminDistributorHierarchyError("Invitation not found.", "invitation_not_found", 404)

    await _ensure_can_manage_mitra_manager_invitation(db, actor=actor, invitation=invitation)
    try:
        return await resend_admin_invitation(
            db,
            actor=actor,
            invitation_id=invitation_id,
            ip=ip,
        )
    except ValueError as exc:
        raise AdminDistributorHierarchyError(str(exc), "invitation_resend_failed", 400) from exc
