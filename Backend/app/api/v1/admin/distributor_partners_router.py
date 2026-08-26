from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.deps import get_client_ip, require_permission
from app.application.distributor.partner_approval_service import (
    PartnerApprovalError,
    approve_distributor_partner,
    get_distributor_partner_for_review,
    list_pending_distributor_partners,
    reject_distributor_partner,
)
from app.core.database import get_db
from app.infrastructure.persistence.models import User
from pydantic import BaseModel, Field

router = APIRouter(prefix="/distributor-partners", tags=["admin-distributor-partners"])


class AdminDistributorPartnerListResponse(BaseModel):
    items: list[dict]


class AdminDistributorPartnerDetailResponse(BaseModel):
    partner: dict


class AdminDistributorPartnerApproveRequest(BaseModel):
    euin: str | None = Field(default=None, max_length=32)


class AdminDistributorPartnerRejectRequest(BaseModel):
    reason: str = Field(min_length=4, max_length=512)


class AdminDistributorPartnerActionResponse(BaseModel):
    partner_id: str
    status: str
    arn: str | None = None
    euin: str | None = None


def _approval_http_error(exc: PartnerApprovalError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail={"code": exc.code, "message": exc.message})


@router.get("/pending", response_model=AdminDistributorPartnerListResponse)
async def list_pending_distributor_partners_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("admin.distributor_partners.list"))],
) -> AdminDistributorPartnerListResponse:
    items = await list_pending_distributor_partners(db)
    await db.commit()
    return AdminDistributorPartnerListResponse(items=items)


@router.get("/{partner_id}", response_model=AdminDistributorPartnerDetailResponse)
async def get_distributor_partner_route(
    partner_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("admin.distributor_partners.list"))],
) -> AdminDistributorPartnerDetailResponse:
    partner = await get_distributor_partner_for_review(db, partner_id=partner_id)
    if partner is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "partner_not_found", "message": "Partner application not found."},
        )
    await db.commit()
    return AdminDistributorPartnerDetailResponse(partner=partner)


@router.post("/{partner_id}/approve", response_model=AdminDistributorPartnerActionResponse)
async def approve_distributor_partner_route(
    partner_id: UUID,
    body: AdminDistributorPartnerApproveRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    reviewer: Annotated[User, Depends(require_permission("admin.distributor_partners.approve"))],
) -> AdminDistributorPartnerActionResponse:
    try:
        result = await approve_distributor_partner(
            db,
            reviewer=reviewer,
            partner_id=partner_id,
            euin=body.euin,
            ip=get_client_ip(request),
        )
    except PartnerApprovalError as exc:
        await db.rollback()
        raise _approval_http_error(exc) from exc
    await db.commit()
    return AdminDistributorPartnerActionResponse(**result)


@router.post("/{partner_id}/reject", response_model=AdminDistributorPartnerActionResponse)
async def reject_distributor_partner_route(
    partner_id: UUID,
    body: AdminDistributorPartnerRejectRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    reviewer: Annotated[User, Depends(require_permission("admin.distributor_partners.approve"))],
) -> AdminDistributorPartnerActionResponse:
    try:
        result = await reject_distributor_partner(
            db,
            reviewer=reviewer,
            partner_id=partner_id,
            reason=body.reason,
            ip=get_client_ip(request),
        )
    except PartnerApprovalError as exc:
        await db.rollback()
        raise _approval_http_error(exc) from exc
    await db.commit()
    return AdminDistributorPartnerActionResponse(partner_id=result["partner_id"], status=result["status"])
