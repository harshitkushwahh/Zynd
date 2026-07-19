from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.admin.schemas import (
    AdminInvitationListResponse,
    AdminInvitationResponse,
    CreateAdminInvitationRequest,
)
from app.api.v1.auth.deps import get_client_ip, require_permission
from app.application.admin.admin_invitation_service import (
    create_admin_invitation,
    list_admin_invitations,
    resend_admin_invitation,
    revoke_admin_invitation,
)
from app.core.database import get_db
from app.infrastructure.persistence.models import User

router = APIRouter(prefix="/invitations", tags=["admin-invitations"])


@router.get("", response_model=AdminInvitationListResponse)
async def get_admin_invitations(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("rbac.manage"))],
) -> AdminInvitationListResponse:
    items = await list_admin_invitations(db)
    return AdminInvitationListResponse(
        items=[AdminInvitationResponse(**item) for item in items]
    )


@router.post("", response_model=AdminInvitationResponse, status_code=201)
async def post_admin_invitation(
    body: CreateAdminInvitationRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("rbac.manage"))],
) -> AdminInvitationResponse:
    try:
        item = await create_admin_invitation(
            db,
            actor=admin,
            email=body.email,
            role_key=body.role_key,
            first_name=body.first_name,
            last_name=body.last_name,
            ip=get_client_ip(request),
        )
    except ValueError as exc:
        message = str(exc)
        status_code = 409 if "already" in message.lower() else 400
        raise HTTPException(
            status_code=status_code,
            detail={"code": "admin_invitation_failed", "message": message},
        ) from exc

    await db.commit()
    return AdminInvitationResponse(**item)


@router.post("/{invitation_id}/revoke", response_model=AdminInvitationResponse)
async def post_revoke_admin_invitation(
    invitation_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("rbac.manage"))],
) -> AdminInvitationResponse:
    try:
        item = await revoke_admin_invitation(
            db,
            actor=admin,
            invitation_id=invitation_id,
            ip=get_client_ip(request),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": "admin_invitation_revoke_failed", "message": str(exc)},
        ) from exc

    await db.commit()
    return AdminInvitationResponse(**item)


@router.post("/{invitation_id}/resend", response_model=AdminInvitationResponse)
async def post_resend_admin_invitation(
    invitation_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("rbac.manage"))],
) -> AdminInvitationResponse:
    try:
        item = await resend_admin_invitation(
            db,
            actor=admin,
            invitation_id=invitation_id,
            ip=get_client_ip(request),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": "admin_invitation_resend_failed", "message": str(exc)},
        ) from exc

    await db.commit()
    return AdminInvitationResponse(**item)
