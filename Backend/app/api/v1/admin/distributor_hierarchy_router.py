from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.deps import get_client_ip, require_any_permission, require_permission
from app.api.v1.distributor.work_schemas import AdminGrantPromotionRequest, AdminGrantPromotionResponse
from app.application.admin.user_admin_service import get_user_by_reference
from app.application.distributor.distributor_work_service import DistributorWorkError, grant_partner_promotion
from app.application.admin.admin_distributor_hierarchy_service import (
    AdminDistributorHierarchyError,
    approve_admin_distributor_branch,
    assign_admin_distributor_branch_manager,
    create_admin_distributor_branch,
    create_admin_distributor_state_head,
    get_admin_distributor_overview,
    get_admin_distributor_branch,
    invite_admin_mitra_manager,
    list_admin_mitra_manager_invitations,
    list_admin_distributor_branches,
    list_eligible_branch_manager_candidates,
    list_eligible_state_head_candidates,
    list_admin_distributor_managers,
    list_admin_distributor_partners,
    list_admin_distributor_state_heads,
    list_unassigned_hierarchy_states,
    pause_admin_distributor_state_head,
    reject_admin_distributor_branch,
    replace_admin_distributor_state_head,
    resend_admin_mitra_manager_invitation,
    resume_admin_distributor_state_head,
    revoke_admin_mitra_manager_invitation,
    resolve_admin_hierarchy_state_filter,
    unassign_admin_distributor_branch_manager,
    unassign_admin_distributor_state_head,
    update_admin_distributor_branch,
)
from app.core.database import get_db
from app.infrastructure.persistence.models import User

router = APIRouter(prefix="/distributor-hierarchy", tags=["admin-distributor-hierarchy"])

HO_CONSOLE_READ = require_any_permission(
    "admin.distributor_hierarchy.read",
    "admin.distributor_partners.list",
    "admin.distributor_branches.list",
    "admin.distributor_managers.list",
)


class AdminHierarchyListResponse(BaseModel):
    items: list[dict]


class AdminHierarchyOverviewResponse(BaseModel):
    overview: dict


class AdminCreateBranchRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    city: str | None = Field(default=None, max_length=80)
    state_code: str = Field(min_length=2, max_length=8)
    state_name: str = Field(min_length=2, max_length=80)
    manager_user_ref: str | None = None


class AdminAssignBranchManagerRequest(BaseModel):
    manager_user_ref: str
    replace_existing: bool = False


class AdminUpdateBranchRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    city: str | None = Field(default=None, max_length=80)


class AdminRejectBranchRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=240)


class AdminCreateBranchResponse(BaseModel):
    branch: dict


class AdminBranchDetailResponse(BaseModel):
    branch: dict


class AdminCreateStateHeadRequest(BaseModel):
    user_ref: str
    state_code: str = Field(min_length=2, max_length=8)
    state_name: str = Field(min_length=2, max_length=80)


class AdminCreateStateHeadResponse(BaseModel):
    state_head: dict


class AdminReplaceStateHeadRequest(BaseModel):
    replacement_user_ref: str


class AdminReplaceStateHeadResponse(BaseModel):
    previous_user_id: str
    state_head: dict


class AdminUnassignStateHeadResponse(BaseModel):
    result: dict


class AdminInviteMitraManagerRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    first_name: str | None = Field(default=None, max_length=80)
    last_name: str | None = Field(default=None, max_length=80)


class AdminInviteMitraManagerResponse(BaseModel):
    invitation: dict


def _hierarchy_http_error(exc: AdminDistributorHierarchyError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail={"code": exc.code, "message": exc.message})


async def _resolve_user_id(db: AsyncSession, user_ref: str) -> UUID:
    user = await get_user_by_reference(db, user_ref)
    if user is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "user_not_found", "message": "User not found."},
        )
    return user.id


@router.get("/overview", response_model=AdminHierarchyOverviewResponse)
async def get_distributor_hierarchy_overview_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(HO_CONSOLE_READ)],
) -> AdminHierarchyOverviewResponse:
    state_filter = await resolve_admin_hierarchy_state_filter(db, user=admin)
    overview = await get_admin_distributor_overview(db, state_filter=state_filter, actor=admin)
    await db.commit()
    return AdminHierarchyOverviewResponse(overview=overview)


@router.get("/state-heads", response_model=AdminHierarchyListResponse)
async def list_distributor_state_heads_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(HO_CONSOLE_READ)],
) -> AdminHierarchyListResponse:
    state_filter = await resolve_admin_hierarchy_state_filter(db, user=admin)
    items = await list_admin_distributor_state_heads(db, state_filter=state_filter)
    await db.commit()
    return AdminHierarchyListResponse(items=items)


@router.get("/unassigned-states", response_model=AdminHierarchyListResponse)
async def list_unassigned_hierarchy_states_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(HO_CONSOLE_READ)],
) -> AdminHierarchyListResponse:
    state_filter = await resolve_admin_hierarchy_state_filter(db, user=admin)
    items = await list_unassigned_hierarchy_states(db, state_filter=state_filter)
    await db.commit()
    return AdminHierarchyListResponse(items=items)


@router.post("/state-heads", response_model=AdminCreateStateHeadResponse, status_code=201)
async def create_distributor_state_head_route(
    body: AdminCreateStateHeadRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("admin.distributor_branches.manage"))],
) -> AdminCreateStateHeadResponse:
    try:
        user_id = await _resolve_user_id(db, body.user_ref)
        state_head = await create_admin_distributor_state_head(
            db,
            user_id=user_id,
            state_code=body.state_code,
            state_name=body.state_name,
            actor=admin,
        )
    except AdminDistributorHierarchyError as exc:
        await db.rollback()
        raise _hierarchy_http_error(exc) from exc
    await db.commit()
    return AdminCreateStateHeadResponse(state_head=state_head)


@router.post("/state-heads/{user_ref}/pause", response_model=AdminCreateStateHeadResponse)
async def pause_distributor_state_head_route(
    user_ref: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("admin.distributor_branches.manage"))],
) -> AdminCreateStateHeadResponse:
    try:
        user_id = await _resolve_user_id(db, user_ref)
        state_head = await pause_admin_distributor_state_head(
            db,
            user_id=user_id,
            actor=admin,
            ip=get_client_ip(request),
        )
    except AdminDistributorHierarchyError as exc:
        await db.rollback()
        raise _hierarchy_http_error(exc) from exc
    await db.commit()
    return AdminCreateStateHeadResponse(state_head=state_head)


@router.post("/state-heads/{user_ref}/resume", response_model=AdminCreateStateHeadResponse)
async def resume_distributor_state_head_route(
    user_ref: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("admin.distributor_branches.manage"))],
) -> AdminCreateStateHeadResponse:
    try:
        user_id = await _resolve_user_id(db, user_ref)
        state_head = await resume_admin_distributor_state_head(db, user_id=user_id, actor=admin)
    except AdminDistributorHierarchyError as exc:
        await db.rollback()
        raise _hierarchy_http_error(exc) from exc
    await db.commit()
    return AdminCreateStateHeadResponse(state_head=state_head)


@router.post("/state-heads/{user_ref}/replace", response_model=AdminReplaceStateHeadResponse)
async def replace_distributor_state_head_route(
    user_ref: str,
    body: AdminReplaceStateHeadRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("admin.distributor_branches.manage"))],
) -> AdminReplaceStateHeadResponse:
    try:
        current_user_id = await _resolve_user_id(db, user_ref)
        replacement_user_id = await _resolve_user_id(db, body.replacement_user_ref)
        result = await replace_admin_distributor_state_head(
            db,
            current_user_id=current_user_id,
            replacement_user_id=replacement_user_id,
            actor=admin,
            ip=get_client_ip(request),
        )
    except AdminDistributorHierarchyError as exc:
        await db.rollback()
        raise _hierarchy_http_error(exc) from exc
    await db.commit()
    return AdminReplaceStateHeadResponse(
        previous_user_id=result["previous_user_id"],
        state_head=result["state_head"],
    )


@router.delete("/state-heads/{user_ref}", response_model=AdminUnassignStateHeadResponse)
async def unassign_distributor_state_head_route(
    user_ref: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("admin.distributor_branches.manage"))],
) -> AdminUnassignStateHeadResponse:
    try:
        user_id = await _resolve_user_id(db, user_ref)
        result = await unassign_admin_distributor_state_head(
            db,
            user_id=user_id,
            actor=admin,
            ip=get_client_ip(request),
        )
    except AdminDistributorHierarchyError as exc:
        await db.rollback()
        raise _hierarchy_http_error(exc) from exc
    await db.commit()
    return AdminUnassignStateHeadResponse(result=result)


@router.get("/state-head-candidates", response_model=AdminHierarchyListResponse)
async def list_state_head_candidates_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("admin.distributor_branches.manage"))],
) -> AdminHierarchyListResponse:
    items = await list_eligible_state_head_candidates(db)
    await db.commit()
    return AdminHierarchyListResponse(items=items)


@router.get("/branches", response_model=AdminHierarchyListResponse)
async def list_distributor_branches_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(HO_CONSOLE_READ)],
) -> AdminHierarchyListResponse:
    state_filter = await resolve_admin_hierarchy_state_filter(db, user=admin)
    items = await list_admin_distributor_branches(db, state_filter=state_filter)
    await db.commit()
    return AdminHierarchyListResponse(items=items)


@router.get("/branches/{branch_id}", response_model=AdminBranchDetailResponse)
async def get_distributor_branch_route(
    branch_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(HO_CONSOLE_READ)],
) -> AdminBranchDetailResponse:
    state_filter = await resolve_admin_hierarchy_state_filter(db, user=admin)
    try:
        branch = await get_admin_distributor_branch(db, branch_id=branch_id, state_filter=state_filter)
    except AdminDistributorHierarchyError as exc:
        await db.rollback()
        raise _hierarchy_http_error(exc) from exc
    await db.commit()
    return AdminBranchDetailResponse(branch=branch)


@router.post("/branches", response_model=AdminCreateBranchResponse, status_code=201)
async def create_distributor_branch_route(
    body: AdminCreateBranchRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("admin.distributor_branches.manage"))],
) -> AdminCreateBranchResponse:
    try:
        manager_user_id = (
            await _resolve_user_id(db, body.manager_user_ref) if body.manager_user_ref else None
        )
        branch = await create_admin_distributor_branch(
            db,
            name=body.name,
            city=body.city,
            state_code=body.state_code,
            state_name=body.state_name,
            manager_user_id=manager_user_id,
            actor=admin,
        )
    except AdminDistributorHierarchyError as exc:
        await db.rollback()
        raise _hierarchy_http_error(exc) from exc
    await db.commit()
    return AdminCreateBranchResponse(branch=branch)


@router.post("/branches/{branch_id}/approve", response_model=AdminCreateBranchResponse)
async def approve_distributor_branch_route(
    branch_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("admin.distributor_branches.approve"))],
) -> AdminCreateBranchResponse:
    try:
        branch = await approve_admin_distributor_branch(db, branch_id=branch_id, actor=admin)
    except AdminDistributorHierarchyError as exc:
        await db.rollback()
        raise _hierarchy_http_error(exc) from exc
    await db.commit()
    return AdminCreateBranchResponse(branch=branch)


@router.post("/branches/{branch_id}/reject", response_model=AdminCreateBranchResponse)
async def reject_distributor_branch_route(
    branch_id: str,
    body: AdminRejectBranchRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("admin.distributor_branches.approve"))],
) -> AdminCreateBranchResponse:
    try:
        branch = await reject_admin_distributor_branch(
            db,
            branch_id=branch_id,
            actor=admin,
            reason=body.reason,
        )
    except AdminDistributorHierarchyError as exc:
        await db.rollback()
        raise _hierarchy_http_error(exc) from exc
    await db.commit()
    return AdminCreateBranchResponse(branch=branch)


@router.post("/branches/{branch_id}/assign-manager", response_model=AdminCreateBranchResponse)
async def assign_distributor_branch_manager_route(
    branch_id: str,
    body: AdminAssignBranchManagerRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("admin.distributor_branches.manage"))],
) -> AdminCreateBranchResponse:
    try:
        manager_user_id = await _resolve_user_id(db, body.manager_user_ref)
        branch = await assign_admin_distributor_branch_manager(
            db,
            branch_id=branch_id,
            manager_user_id=manager_user_id,
            actor=admin,
            replace_existing=body.replace_existing,
        )
    except AdminDistributorHierarchyError as exc:
        await db.rollback()
        raise _hierarchy_http_error(exc) from exc
    await db.commit()
    return AdminCreateBranchResponse(branch=branch)


@router.post("/branches/{branch_id}/unassign-manager", response_model=AdminCreateBranchResponse)
async def unassign_distributor_branch_manager_route(
    branch_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("admin.distributor_branches.manage"))],
) -> AdminCreateBranchResponse:
    try:
        branch = await unassign_admin_distributor_branch_manager(
            db,
            branch_id=branch_id,
            actor=admin,
        )
    except AdminDistributorHierarchyError as exc:
        await db.rollback()
        raise _hierarchy_http_error(exc) from exc
    await db.commit()
    return AdminCreateBranchResponse(branch=branch)


@router.patch("/branches/{branch_id}", response_model=AdminCreateBranchResponse)
async def update_distributor_branch_route(
    branch_id: str,
    body: AdminUpdateBranchRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("admin.distributor_branches.manage"))],
) -> AdminCreateBranchResponse:
    try:
        branch = await update_admin_distributor_branch(
            db,
            branch_id=branch_id,
            actor=admin,
            name=body.name,
            city=body.city,
        )
    except AdminDistributorHierarchyError as exc:
        await db.rollback()
        raise _hierarchy_http_error(exc) from exc
    await db.commit()
    return AdminCreateBranchResponse(branch=branch)


@router.get("/mitra-manager-invitations", response_model=AdminHierarchyListResponse)
async def list_mitra_manager_invitations_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("admin.distributor_branches.manage"))],
) -> AdminHierarchyListResponse:
    try:
        items = await list_admin_mitra_manager_invitations(db, actor=admin)
    except AdminDistributorHierarchyError as exc:
        await db.rollback()
        raise _hierarchy_http_error(exc) from exc
    await db.commit()
    return AdminHierarchyListResponse(items=items)


@router.post("/mitra-manager-invitations", response_model=AdminInviteMitraManagerResponse, status_code=201)
async def invite_mitra_manager_route(
    body: AdminInviteMitraManagerRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("admin.distributor_branches.manage"))],
) -> AdminInviteMitraManagerResponse:
    try:
        invitation = await invite_admin_mitra_manager(
            db,
            actor=admin,
            email=body.email,
            first_name=body.first_name,
            last_name=body.last_name,
            ip=get_client_ip(request),
        )
    except AdminDistributorHierarchyError as exc:
        await db.rollback()
        raise _hierarchy_http_error(exc) from exc
    await db.commit()
    return AdminInviteMitraManagerResponse(invitation=invitation)


@router.post("/mitra-manager-invitations/{invitation_id}/revoke", response_model=AdminInviteMitraManagerResponse)
async def revoke_mitra_manager_invitation_route(
    invitation_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("admin.distributor_branches.manage"))],
) -> AdminInviteMitraManagerResponse:
    try:
        invitation = await revoke_admin_mitra_manager_invitation(
            db,
            actor=admin,
            invitation_id=invitation_id,
            ip=get_client_ip(request),
        )
    except AdminDistributorHierarchyError as exc:
        await db.rollback()
        raise _hierarchy_http_error(exc) from exc
    await db.commit()
    return AdminInviteMitraManagerResponse(invitation=invitation)


@router.post("/mitra-manager-invitations/{invitation_id}/resend", response_model=AdminInviteMitraManagerResponse)
async def resend_mitra_manager_invitation_route(
    invitation_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("admin.distributor_branches.manage"))],
) -> AdminInviteMitraManagerResponse:
    try:
        invitation = await resend_admin_mitra_manager_invitation(
            db,
            actor=admin,
            invitation_id=invitation_id,
            ip=get_client_ip(request),
        )
    except AdminDistributorHierarchyError as exc:
        await db.rollback()
        raise _hierarchy_http_error(exc) from exc
    await db.commit()
    return AdminInviteMitraManagerResponse(invitation=invitation)


@router.get("/branch-manager-candidates", response_model=AdminHierarchyListResponse)
async def list_branch_manager_candidates_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("admin.distributor_branches.manage"))],
) -> AdminHierarchyListResponse:
    items = await list_eligible_branch_manager_candidates(db)
    await db.commit()
    return AdminHierarchyListResponse(items=items)


@router.get("/managers", response_model=AdminHierarchyListResponse)
async def list_distributor_managers_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(HO_CONSOLE_READ)],
) -> AdminHierarchyListResponse:
    state_filter = await resolve_admin_hierarchy_state_filter(db, user=admin)
    items = await list_admin_distributor_managers(db, state_filter=state_filter)
    await db.commit()
    return AdminHierarchyListResponse(items=items)


@router.get("/partners", response_model=AdminHierarchyListResponse)
async def list_distributor_partners_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(HO_CONSOLE_READ)],
) -> AdminHierarchyListResponse:
    state_filter = await resolve_admin_hierarchy_state_filter(db, user=admin)
    items = await list_admin_distributor_partners(db, state_filter=state_filter)
    await db.commit()
    return AdminHierarchyListResponse(items=items)


@router.post("/partners/{partner_user_ref}/promotions", response_model=AdminGrantPromotionResponse)
async def grant_partner_promotion_route(
    partner_user_ref: str,
    body: AdminGrantPromotionRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("admin.distributor_promotions.manage"))],
) -> AdminGrantPromotionResponse:
    try:
        promotion = await grant_partner_promotion(
            db,
            actor=admin,
            partner_user_ref=partner_user_ref,
            label=body.label,
            previous_base_salary=body.previous_base_salary,
            new_base_salary=body.new_base_salary,
            effective_date=body.effective_date,
        )
    except DistributorWorkError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    await db.commit()
    return AdminGrantPromotionResponse(promotion=promotion)
