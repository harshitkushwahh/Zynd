from __future__ import annotations

from typing import Annotated

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.admin.risk_profile_schemas import (
    UserRiskProfileAssessmentDetailResponse,
    UserRiskProfileAssessmentListResponse,
)
from app.api.v1.auth.deps import require_permission
from app.api.v1.distributor.schemas import (
    DistributorClientDetailResponse,
    DistributorClientFamilyGroupDetailResponse,
    DistributorClientListResponse,
)
from app.application.distributor.distributor_client_service import (
    download_distributor_client_risk_report,
    get_distributor_client_detail,
    get_distributor_client_family_group,
    get_distributor_client_risk_assessment_detail,
    list_distributor_client_risk_assessments,
    list_distributor_clients,
)
from app.application.risk_profile.errors import RiskProfileError
from app.core.database import get_db
from app.infrastructure.persistence.models import User

router = APIRouter(prefix="/distributor", tags=["distributor"])


@router.get("/clients", response_model=DistributorClientListResponse)
async def list_distributor_clients_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("distributor.clients.list"))],
    email: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> DistributorClientListResponse:
    items = await list_distributor_clients(db, email=email, limit=limit, offset=offset)
    await db.commit()
    return DistributorClientListResponse(items=items)


@router.get("/clients/{client_reference}", response_model=DistributorClientDetailResponse)
async def get_distributor_client_detail_route(
    client_reference: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("distributor.clients.read"))],
) -> DistributorClientDetailResponse:
    payload = await get_distributor_client_detail(db, client_reference)
    if payload is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "client_not_found", "message": "Client not found."},
        )
    await db.commit()
    return DistributorClientDetailResponse(**payload)


@router.get(
    "/clients/{client_reference}/family-groups/{group_id}",
    response_model=DistributorClientFamilyGroupDetailResponse,
)
async def get_distributor_client_family_group_route(
    client_reference: str,
    group_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("distributor.clients.read"))],
) -> DistributorClientFamilyGroupDetailResponse:
    payload = await get_distributor_client_family_group(
        db,
        client_reference=client_reference,
        group_id=group_id,
    )
    if payload is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "family_group_not_found", "message": "Family group not found."},
        )
    await db.commit()
    return DistributorClientFamilyGroupDetailResponse(**payload)


@router.get(
    "/clients/{client_reference}/risk-profile/assessments",
    response_model=UserRiskProfileAssessmentListResponse,
)
async def list_distributor_client_risk_assessments_route(
    client_reference: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("distributor.clients.read"))],
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> UserRiskProfileAssessmentListResponse:
    result = await list_distributor_client_risk_assessments(
        db,
        client_reference,
        limit=limit,
        offset=offset,
    )
    if result is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "client_not_found", "message": "Client not found."},
        )
    await db.commit()
    return UserRiskProfileAssessmentListResponse(**result)


@router.get(
    "/clients/{client_reference}/risk-profile/assessments/{assessment_id}",
    response_model=UserRiskProfileAssessmentDetailResponse,
)
async def get_distributor_client_risk_assessment_detail_route(
    client_reference: str,
    assessment_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("distributor.clients.read"))],
) -> UserRiskProfileAssessmentDetailResponse:
    result = await get_distributor_client_risk_assessment_detail(
        db,
        client_reference,
        assessment_id,
    )
    if result is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "assessment_not_found", "message": "Assessment not found."},
        )
    await db.commit()
    return UserRiskProfileAssessmentDetailResponse(**result)


@router.get("/clients/{client_reference}/risk-profile/assessments/{assessment_id}/report/download")
async def download_distributor_client_risk_report_route(
    client_reference: str,
    assessment_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("distributor.clients.read"))],
) -> Response:
    try:
        payload = await download_distributor_client_risk_report(db, client_reference, assessment_id)
    except RiskProfileError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    if payload is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "assessment_not_found", "message": "Assessment not found."},
        )
    pdf_bytes, filename = payload
    await db.commit()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
