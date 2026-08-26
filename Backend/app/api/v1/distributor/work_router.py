from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.deps import require_any_permission, require_permission
from app.api.v1.distributor.work_schemas import (
    LeaveApplyRequest,
    LeaveRequestListResponse,
    LeaveRequestResponse,
    LeaveReviewRequest,
    PayrollDashboardResponse,
    PayrollPeriodListResponse,
    WorkAttendanceConfigResponse,
    WorkAttendanceListResponse,
    WorkSessionResponse,
    WorkSessionStateResponse,
    WorkSignInRequest,
)
from app.application.distributor.distributor_work_service import (
    DistributorWorkError,
    apply_leave_request,
    get_active_work_session,
    get_payroll_dashboard,
    get_work_attendance_config,
    list_leave_requests,
    list_payroll_periods,
    list_work_attendance_rows,
    review_leave_request,
    sign_in_work_session,
    sign_out_work_session,
)
from app.core.database import get_db
from app.infrastructure.persistence.models import User

router = APIRouter(prefix="/work", tags=["distributor-work"])


def _work_http_error(exc: DistributorWorkError) -> HTTPException:
    return HTTPException(
        status_code=exc.status_code,
        detail={"code": exc.code, "message": exc.message},
    )


@router.get("/config", response_model=WorkAttendanceConfigResponse)
async def get_work_config_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.work.manage"))],
) -> WorkAttendanceConfigResponse:
    try:
        config = await get_work_attendance_config(db, actor=actor)
    except DistributorWorkError as exc:
        raise _work_http_error(exc) from exc
    await db.commit()
    return WorkAttendanceConfigResponse(
        workModes=config.get("workModes", []),
        timeSlots=config.get("timeSlots", []),
        workSites=config.get("workSites", []),
    )


@router.get("/sessions/active", response_model=WorkSessionStateResponse)
async def get_active_work_session_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.work.manage"))],
) -> WorkSessionStateResponse:
    try:
        session = await get_active_work_session(db, actor=actor)
    except DistributorWorkError as exc:
        raise _work_http_error(exc) from exc
    await db.commit()
    return WorkSessionStateResponse(
        session=WorkSessionResponse.model_validate(session) if session else None,
    )


@router.post("/sessions/sign-in", response_model=WorkSessionResponse)
async def sign_in_work_session_route(
    body: WorkSignInRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.work.manage"))],
) -> WorkSessionResponse:
    try:
        session = await sign_in_work_session(
            db,
            actor=actor,
            work_site_id=body.work_site_id,
            work_mode_id=body.work_mode_id,
            time_slot_id=body.time_slot_id,
            remarks=body.remarks,
            geolocation=body.geolocation.model_dump(),
        )
    except DistributorWorkError as exc:
        await db.rollback()
        raise _work_http_error(exc) from exc
    await db.commit()
    return WorkSessionResponse.model_validate(session)


@router.post("/sessions/sign-out", response_model=WorkSessionResponse)
async def sign_out_work_session_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.work.manage"))],
) -> WorkSessionResponse:
    try:
        session = await sign_out_work_session(db, actor=actor)
    except DistributorWorkError as exc:
        await db.rollback()
        raise _work_http_error(exc) from exc
    await db.commit()
    return WorkSessionResponse.model_validate(session)


@router.get("/attendance", response_model=WorkAttendanceListResponse)
async def list_work_attendance_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.work.manage"))],
    month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
) -> WorkAttendanceListResponse:
    try:
        items = await list_work_attendance_rows(db, actor=actor, month=month)
    except DistributorWorkError as exc:
        raise _work_http_error(exc) from exc
    await db.commit()
    return WorkAttendanceListResponse(items=items)


@router.get("/leave/requests", response_model=LeaveRequestListResponse)
async def list_leave_requests_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[
        User,
        Depends(require_any_permission("distributor.leave.apply", "distributor.leave.review")),
    ],
    scope: str = Query(default="self", pattern="^(self|branch)$"),
) -> LeaveRequestListResponse:
    try:
        items = await list_leave_requests(db, actor=actor, scope=scope)
    except DistributorWorkError as exc:
        raise _work_http_error(exc) from exc
    await db.commit()
    return LeaveRequestListResponse(items=items)


@router.post("/leave/requests", response_model=LeaveRequestResponse)
async def apply_leave_request_route(
    body: LeaveApplyRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.leave.apply"))],
) -> LeaveRequestResponse:
    try:
        item = await apply_leave_request(
            db,
            actor=actor,
            leave_type=body.leave_type,
            from_date=body.from_date,
            to_date=body.to_date,
            reason=body.reason,
        )
    except DistributorWorkError as exc:
        await db.rollback()
        raise _work_http_error(exc) from exc
    await db.commit()
    return LeaveRequestResponse(item=item)


@router.post("/leave/requests/{request_id}/review", response_model=LeaveRequestResponse)
async def review_leave_request_route(
    request_id: UUID,
    body: LeaveReviewRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.leave.review"))],
) -> LeaveRequestResponse:
    try:
        item = await review_leave_request(
            db,
            actor=actor,
            request_id=request_id,
            decision=body.decision,
            review_note=body.review_note,
        )
    except DistributorWorkError as exc:
        await db.rollback()
        raise _work_http_error(exc) from exc
    await db.commit()
    return LeaveRequestResponse(item=item)


@router.get("/payroll/dashboard", response_model=PayrollDashboardResponse)
async def get_payroll_dashboard_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.payroll.read"))],
    period_id: str | None = Query(default=None, alias="periodId"),
) -> PayrollDashboardResponse:
    try:
        payload = await get_payroll_dashboard(db, actor=actor, period_id=period_id)
    except DistributorWorkError as exc:
        raise _work_http_error(exc) from exc
    await db.commit()
    return PayrollDashboardResponse.model_validate(payload)


@router.get("/payroll/periods", response_model=PayrollPeriodListResponse)
async def list_payroll_periods_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.payroll.read"))],
) -> PayrollPeriodListResponse:
    try:
        items = await list_payroll_periods(db, actor=actor)
    except DistributorWorkError as exc:
        raise _work_http_error(exc) from exc
    await db.commit()
    return PayrollPeriodListResponse(items=items)
