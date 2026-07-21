from __future__ import annotations

from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.admin.family_groups_schemas import (
    AdminFamilyGroupActionResponse,
    AdminFamilyGroupAuditLogItemResponse,
    AdminFamilyGroupAuditLogListResponse,
    AdminFamilyGroupDetailResponse,
    AdminFamilyGroupInviteListItemResponse,
    AdminFamilyGroupInviteListResponse,
    AdminFamilyGroupListResponse,
    AdminFamilyGroupSummaryResponse,
    AdminUserFamilyGroupsResponse,
)
from app.api.v1.auth.deps import get_client_ip, require_permission
from app.application.family_groups.admin_service import (
    admin_force_archive_family_group,
    admin_force_remove_group_member,
    get_admin_family_group_detail,
    list_admin_family_group_invites,
    list_admin_family_groups,
    list_admin_user_family_groups,
)
from app.application.family_groups.audit_service import list_family_group_audit_logs
from app.application.family_groups.errors import FamilyGroupError
from app.core.database import get_db
from app.infrastructure.persistence.family_group_models import FamilyGroupInviteStatus, FamilyGroupStatus
from app.infrastructure.persistence.models import AuditEventType, User

router = APIRouter(prefix="/family-groups", tags=["admin-family-groups"])


def _handle_family_group_error(exc: FamilyGroupError) -> HTTPException:
    return HTTPException(
        status_code=exc.status_code,
        detail={"code": exc.code, "message": exc.message},
    )


@router.get("", response_model=AdminFamilyGroupListResponse)
async def get_admin_family_groups(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("family_groups.read"))],
    status: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> AdminFamilyGroupListResponse:
    parsed_status: FamilyGroupStatus | None = None
    if status:
        try:
            parsed_status = FamilyGroupStatus(status)
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail={"code": "invalid_status", "message": "Invalid group status filter."},
            ) from exc

    items = await list_admin_family_groups(
        db,
        status=parsed_status,
        search=search,
        limit=limit,
        offset=offset,
    )
    return AdminFamilyGroupListResponse(
        items=[AdminFamilyGroupSummaryResponse(**item) for item in items],
        limit=limit,
        offset=offset,
    )


@router.get("/invites", response_model=AdminFamilyGroupInviteListResponse)
async def get_admin_family_group_invites(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("family_groups.read"))],
    status: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> AdminFamilyGroupInviteListResponse:
    parsed_status: FamilyGroupInviteStatus | None = None
    if status:
        try:
            parsed_status = FamilyGroupInviteStatus(status)
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail={"code": "invalid_status", "message": "Invalid invite status filter."},
            ) from exc

    items = await list_admin_family_group_invites(
        db,
        status=parsed_status,
        search=search,
        limit=limit,
        offset=offset,
    )
    return AdminFamilyGroupInviteListResponse(
        items=[AdminFamilyGroupInviteListItemResponse(**item) for item in items],
        limit=limit,
        offset=offset,
    )


@router.get("/audit", response_model=AdminFamilyGroupAuditLogListResponse)
async def get_admin_family_group_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("family_groups.read"))],
    user_id: Optional[UUID] = Query(default=None),
    event_type: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> AdminFamilyGroupAuditLogListResponse:
    parsed_event_type: AuditEventType | None = None
    if event_type:
        try:
            parsed_event_type = AuditEventType(event_type)
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail={"code": "invalid_event_type", "message": "Invalid audit event type."},
            ) from exc

    items = await list_family_group_audit_logs(
        db,
        user_id=user_id,
        event_type=parsed_event_type,
        limit=limit,
        offset=offset,
    )
    return AdminFamilyGroupAuditLogListResponse(
        items=[
            AdminFamilyGroupAuditLogItemResponse(
                id=str(item["id"]),
                user_id=str(item["user_id"]) if item.get("user_id") else None,
                event_type=item["event_type"],
                ip_address=item.get("ip_address"),
                metadata=item.get("metadata") or {},
                created_at=item["created_at"].isoformat() if item.get("created_at") else "",
            )
            for item in items
        ],
        limit=limit,
        offset=offset,
    )


@router.get("/users/{user_id}", response_model=AdminUserFamilyGroupsResponse)
async def get_admin_user_family_groups(
    user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("family_groups.read"))],
) -> AdminUserFamilyGroupsResponse:
    try:
        payload = await list_admin_user_family_groups(db, user_id=user_id)
    except FamilyGroupError as exc:
        raise _handle_family_group_error(exc) from exc
    return AdminUserFamilyGroupsResponse(**payload)


@router.get("/{group_id}", response_model=AdminFamilyGroupDetailResponse)
async def get_admin_family_group(
    group_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("family_groups.read"))],
) -> AdminFamilyGroupDetailResponse:
    try:
        payload = await get_admin_family_group_detail(db, group_id=group_id)
    except FamilyGroupError as exc:
        raise _handle_family_group_error(exc) from exc
    return AdminFamilyGroupDetailResponse(**payload)


@router.post("/{group_id}/archive", response_model=AdminFamilyGroupDetailResponse)
async def post_admin_force_archive_family_group(
    group_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("family_groups.manage"))],
) -> AdminFamilyGroupDetailResponse:
    try:
        payload = await admin_force_archive_family_group(
            db,
            group_id=group_id,
            admin=admin,
            ip=get_client_ip(request),
        )
        await db.commit()
    except FamilyGroupError as exc:
        raise _handle_family_group_error(exc) from exc
    return AdminFamilyGroupDetailResponse(**payload)


@router.post(
    "/{group_id}/members/{user_id}/remove",
    response_model=AdminFamilyGroupActionResponse,
)
async def post_admin_force_remove_group_member(
    group_id: UUID,
    user_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("family_groups.manage"))],
) -> AdminFamilyGroupActionResponse:
    try:
        await admin_force_remove_group_member(
            db,
            group_id=group_id,
            target_user_id=user_id,
            admin=admin,
            ip=get_client_ip(request),
        )
        await db.commit()
    except FamilyGroupError as exc:
        raise _handle_family_group_error(exc) from exc
    return AdminFamilyGroupActionResponse()
