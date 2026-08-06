from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.deps import require_any_permission, require_permission
from app.application.admin.admin_distributor_hierarchy_service import (
    AdminDistributorHierarchyError,
    create_admin_distributor_branch,
    create_admin_distributor_state_head,
    get_admin_distributor_overview,
    list_admin_distributor_branches,
    list_eligible_branch_manager_candidates,
    list_eligible_state_head_candidates,
    list_admin_distributor_managers,
    list_admin_distributor_partners,
    list_admin_distributor_state_heads,
    resolve_admin_hierarchy_state_filter,
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
    manager_user_id: UUID


class AdminCreateBranchResponse(BaseModel):
    branch: dict


class AdminCreateStateHeadRequest(BaseModel):
    user_id: UUID
    state_code: str = Field(min_length=2, max_length=8)
    state_name: str = Field(min_length=2, max_length=80)


class AdminCreateStateHeadResponse(BaseModel):
    state_head: dict


def _hierarchy_http_error(exc: AdminDistributorHierarchyError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail={"code": exc.code, "message": exc.message})


@router.get("/overview", response_model=AdminHierarchyOverviewResponse)
async def get_distributor_hierarchy_overview_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(HO_CONSOLE_READ)],
) -> AdminHierarchyOverviewResponse:
    state_filter = await resolve_admin_hierarchy_state_filter(db, user=admin)
    overview = await get_admin_distributor_overview(db, state_filter=state_filter)
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


@router.post("/state-heads", response_model=AdminCreateStateHeadResponse, status_code=201)
async def create_distributor_state_head_route(
    body: AdminCreateStateHeadRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("admin.distributor_branches.manage"))],
) -> AdminCreateStateHeadResponse:
    try:
        state_head = await create_admin_distributor_state_head(
            db,
            user_id=body.user_id,
            state_code=body.state_code,
            state_name=body.state_name,
        )
    except AdminDistributorHierarchyError as exc:
        await db.rollback()
        raise _hierarchy_http_error(exc) from exc
    await db.commit()
    return AdminCreateStateHeadResponse(state_head=state_head)


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


@router.post("/branches", response_model=AdminCreateBranchResponse, status_code=201)
async def create_distributor_branch_route(
    body: AdminCreateBranchRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("admin.distributor_branches.manage"))],
) -> AdminCreateBranchResponse:
    try:
        branch = await create_admin_distributor_branch(
            db,
            name=body.name,
            city=body.city,
            state_code=body.state_code,
            state_name=body.state_name,
            manager_user_id=body.manager_user_id,
        )
    except AdminDistributorHierarchyError as exc:
        await db.rollback()
        raise _hierarchy_http_error(exc) from exc
    await db.commit()
    return AdminCreateBranchResponse(branch=branch)


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
