from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.rbac_service import (
    DISTRIBUTOR_MANAGER_ROLE_KEY,
    DISTRIBUTOR_PARTNER_ROLE_KEY,
    MITRA_STATE_HEAD_ROLE_KEY,
    MITRA_SUPER_HEAD_ROLE_KEY,
    list_user_role_keys,
)
from app.application.admin.user_admin_service import get_user_by_reference
from app.application.distributor.distributor_branch_service import get_distributor_branch_for_manager
from app.application.distributor.partner_access_service import get_distributor_partner_for_user
from app.infrastructure.persistence.distributor_partner_models import DistributorPartner
from app.infrastructure.persistence.distributor_work_models import (
    DistributorLeaveRequest,
    DistributorLeaveRequestStatus,
    DistributorPartnerPromotion,
    DistributorPayrollPeriod,
    DistributorWorkConfig,
    DistributorWorkSession,
    DistributorWorkSessionStatus,
)
from app.infrastructure.persistence.models import User


DEFAULT_WORK_CONFIG: dict[str, object] = {
    "workModes": [
        {"id": "office", "label": "Office", "description": "Branch or company office work"},
        {"id": "field", "label": "Field", "description": "Client visits and on-site meetings"},
        {"id": "hybrid", "label": "Hybrid", "description": "Mix of office and field in the same day"},
    ],
    "timeSlots": [
        {"id": "morning", "label": "Morning shift", "startTime": "09:00", "endTime": "14:00"},
        {"id": "afternoon", "label": "Afternoon shift", "startTime": "14:00", "endTime": "19:00"},
        {"id": "full-day", "label": "Full day", "startTime": "09:00", "endTime": "18:00"},
    ],
    "workSites": [
        {"id": "office", "label": "Office", "payFactorHint": "Standard pay factor"},
        {"id": "client-site", "label": "Client site", "payFactorHint": "1.15× field allowance"},
    ],
}

WORK_SITE_PAY_FACTORS = {
    "office": Decimal("1.0"),
    "client-site": Decimal("1.15"),
}


@dataclass
class DistributorWorkError(Exception):
    code: str
    message: str
    status_code: int = 400


async def _resolve_mitra_actor(db: AsyncSession, actor: User) -> tuple[DistributorPartner, list[str]]:
    role_keys = await list_user_role_keys(db, actor.id)
    if DISTRIBUTOR_PARTNER_ROLE_KEY not in role_keys:
        raise DistributorWorkError(
            code="mitra_only",
            message="This action is available only to Zynd Mitras.",
            status_code=403,
        )
    partner = await get_distributor_partner_for_user(db, actor.id)
    if partner is None:
        raise DistributorWorkError(
            code="partner_not_found",
            message="Zynd Mitra profile not found.",
            status_code=404,
        )
    return partner, role_keys


async def _resolve_branch_id_for_actor(
    db: AsyncSession,
    actor: User,
    role_keys: list[str],
    partner: DistributorPartner | None = None,
) -> str | None:
    if DISTRIBUTOR_MANAGER_ROLE_KEY in role_keys:
        branch = await get_distributor_branch_for_manager(db, manager_user_id=actor.id)
        return branch.id if branch else None
    if partner is None:
        partner = await get_distributor_partner_for_user(db, actor.id)
    return partner.branch_id if partner else None


async def get_work_attendance_config(db: AsyncSession, *, actor: User) -> dict[str, object]:
    partner, role_keys = await _resolve_mitra_actor(db, actor)
    branch_id = await _resolve_branch_id_for_actor(db, actor, role_keys, partner)
    if not branch_id:
        return DEFAULT_WORK_CONFIG.copy()

    result = await db.execute(
        select(DistributorWorkConfig).where(DistributorWorkConfig.branch_id == branch_id).limit(1)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return DEFAULT_WORK_CONFIG.copy()
    return dict(row.config_json)


async def get_active_work_session(db: AsyncSession, *, actor: User) -> dict[str, object] | None:
    partner, _ = await _resolve_mitra_actor(db, actor)
    result = await db.execute(
        select(DistributorWorkSession)
        .where(
            DistributorWorkSession.mitra_user_id == partner.user_id,
            DistributorWorkSession.status == DistributorWorkSessionStatus.active,
        )
        .order_by(desc(DistributorWorkSession.signed_in_at))
        .limit(1)
    )
    session = result.scalar_one_or_none()
    if session is None:
        return None
    return serialize_work_session(session)


async def sign_in_work_session(
    db: AsyncSession,
    *,
    actor: User,
    work_site_id: str,
    work_mode_id: str,
    time_slot_id: str,
    remarks: str | None,
    geolocation: dict[str, object],
) -> dict[str, object]:
    partner, role_keys = await _resolve_mitra_actor(db, actor)
    if work_site_id not in WORK_SITE_PAY_FACTORS:
        raise DistributorWorkError(
            code="invalid_work_site",
            message="Invalid work site.",
        )

    existing = await db.execute(
        select(DistributorWorkSession.id).where(
            DistributorWorkSession.mitra_user_id == partner.user_id,
            DistributorWorkSession.status == DistributorWorkSessionStatus.active,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise DistributorWorkError(
            code="session_already_active",
            message="You are already signed in for work. Sign out before starting a new session.",
            status_code=409,
        )

    branch_id = await _resolve_branch_id_for_actor(db, actor, role_keys, partner)
    session = DistributorWorkSession(
        mitra_user_id=partner.user_id,
        branch_id=branch_id,
        signed_in_at=datetime.now(timezone.utc),
        work_site_id=work_site_id,
        work_mode_id=work_mode_id,
        time_slot_id=time_slot_id,
        remarks=(remarks or "").strip() or None,
        geolocation_json=geolocation,
        status=DistributorWorkSessionStatus.active,
    )
    db.add(session)
    await db.flush()
    return serialize_work_session(session)


async def sign_out_work_session(db: AsyncSession, *, actor: User) -> dict[str, object]:
    partner, _ = await _resolve_mitra_actor(db, actor)
    result = await db.execute(
        select(DistributorWorkSession)
        .where(
            DistributorWorkSession.mitra_user_id == partner.user_id,
            DistributorWorkSession.status == DistributorWorkSessionStatus.active,
        )
        .order_by(desc(DistributorWorkSession.signed_in_at))
        .limit(1)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise DistributorWorkError(
            code="no_active_session",
            message="No active work session to sign out from.",
            status_code=404,
        )

    session.signed_out_at = datetime.now(timezone.utc)
    session.status = DistributorWorkSessionStatus.complete
    await db.flush()
    return serialize_work_session(session)


def _session_hours(session: DistributorWorkSession) -> float:
    end = session.signed_out_at or datetime.now(timezone.utc)
    delta = end - session.signed_in_at
    return max(0.0, round(delta.total_seconds() / 3600, 1))


def _attendance_status(session: DistributorWorkSession) -> str:
    if session.status == DistributorWorkSessionStatus.active:
        return "partial"
    hours = _session_hours(session)
    if hours >= 7:
        return "complete"
    if hours > 0:
        return "partial"
    return "partial"


def serialize_work_session(session: DistributorWorkSession) -> dict[str, object]:
    return {
        "id": str(session.id),
        "signedInAt": session.signed_in_at.isoformat(),
        "signedOutAt": session.signed_out_at.isoformat() if session.signed_out_at else None,
        "workSiteId": session.work_site_id,
        "workModeId": session.work_mode_id,
        "timeSlotId": session.time_slot_id,
        "remarks": session.remarks,
        "geolocation": session.geolocation_json,
        "status": session.status.value,
        "hours": _session_hours(session),
    }


def serialize_attendance_row(session: DistributorWorkSession) -> dict[str, object]:
    pay_factor = WORK_SITE_PAY_FACTORS.get(session.work_site_id, Decimal("1.0"))
    work_type = "Client site" if session.work_site_id == "client-site" else "Office"
    return {
        "id": str(session.id),
        "date": session.signed_in_at.date().isoformat(),
        "clockIn": session.signed_in_at.strftime("%H:%M"),
        "clockOut": session.signed_out_at.strftime("%H:%M") if session.signed_out_at else None,
        "hours": _session_hours(session),
        "workType": work_type,
        "payFactor": float(pay_factor),
        "status": _attendance_status(session),
    }


async def list_work_attendance_rows(
    db: AsyncSession,
    *,
    actor: User,
    month: str | None = None,
) -> list[dict[str, object]]:
    partner, _ = await _resolve_mitra_actor(db, actor)
    query = select(DistributorWorkSession).where(DistributorWorkSession.mitra_user_id == partner.user_id)

    if month:
        try:
            year_str, month_str = month.split("-", 1)
            year = int(year_str)
            month_num = int(month_str)
            start = date(year, month_num, 1)
            if month_num == 12:
                end = date(year + 1, 1, 1)
            else:
                end = date(year, month_num + 1, 1)
            query = query.where(
                func.date(DistributorWorkSession.signed_in_at) >= start,
                func.date(DistributorWorkSession.signed_in_at) < end,
            )
        except ValueError as exc:
            raise DistributorWorkError(
                code="invalid_month",
                message="Month must be formatted as YYYY-MM.",
            ) from exc

    result = await db.execute(query.order_by(desc(DistributorWorkSession.signed_in_at)))
    rows = result.scalars().all()
    return [serialize_attendance_row(row) for row in rows]


def _leave_days(from_date: date, to_date: date) -> Decimal:
    if to_date < from_date:
        raise DistributorWorkError(code="invalid_leave_range", message="End date must be on or after start date.")
    return Decimal(str((to_date - from_date).days + 1))


async def apply_leave_request(
    db: AsyncSession,
    *,
    actor: User,
    leave_type: str,
    from_date: date,
    to_date: date,
    reason: str,
) -> dict[str, object]:
    partner, role_keys = await _resolve_mitra_actor(db, actor)
    branch_id = await _resolve_branch_id_for_actor(db, actor, role_keys, partner)
    days = _leave_days(from_date, to_date)
    row = DistributorLeaveRequest(
        mitra_user_id=partner.user_id,
        branch_id=branch_id,
        leave_type=leave_type.strip(),
        from_date=from_date,
        to_date=to_date,
        days=days,
        reason=reason.strip(),
        status=DistributorLeaveRequestStatus.pending,
    )
    db.add(row)
    await db.flush()
    return serialize_leave_request(row)


async def list_leave_requests(
    db: AsyncSession,
    *,
    actor: User,
    scope: str = "self",
) -> list[dict[str, object]]:
    role_keys = await list_user_role_keys(db, actor.id)
    query = select(DistributorLeaveRequest)

    if scope == "branch" and DISTRIBUTOR_MANAGER_ROLE_KEY in role_keys:
        branch = await get_distributor_branch_for_manager(db, manager_user_id=actor.id)
        if branch is None:
            return []
        query = query.where(DistributorLeaveRequest.branch_id == branch.id)
    else:
        partner = await get_distributor_partner_for_user(db, actor.id)
        if partner is None:
            return []
        query = query.where(DistributorLeaveRequest.mitra_user_id == partner.user_id)

    result = await db.execute(query.order_by(desc(DistributorLeaveRequest.applied_at)))
    return [serialize_leave_request(row) for row in result.scalars().all()]


async def review_leave_request(
    db: AsyncSession,
    *,
    actor: User,
    request_id: UUID,
    decision: str,
    review_note: str | None,
) -> dict[str, object]:
    role_keys = await list_user_role_keys(db, actor.id)
    if DISTRIBUTOR_MANAGER_ROLE_KEY not in role_keys:
        raise DistributorWorkError(
            code="manager_only",
            message="Only branch managers can review leave requests.",
            status_code=403,
        )
    branch = await get_distributor_branch_for_manager(db, manager_user_id=actor.id)
    if branch is None:
        raise DistributorWorkError(code="branch_not_found", message="Branch not found.", status_code=404)

    result = await db.execute(
        select(DistributorLeaveRequest).where(
            DistributorLeaveRequest.id == request_id,
            DistributorLeaveRequest.branch_id == branch.id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise DistributorWorkError(code="leave_not_found", message="Leave request not found.", status_code=404)
    if row.status != DistributorLeaveRequestStatus.pending:
        raise DistributorWorkError(
            code="leave_already_reviewed",
            message="Leave request has already been reviewed.",
            status_code=409,
        )

    if decision not in {"approved", "rejected"}:
        raise DistributorWorkError(code="invalid_decision", message="Decision must be approved or rejected.")

    row.status = (
        DistributorLeaveRequestStatus.approved
        if decision == "approved"
        else DistributorLeaveRequestStatus.rejected
    )
    row.reviewed_at = datetime.now(timezone.utc)
    row.reviewed_by_user_id = actor.id
    row.review_note = (review_note or "").strip() or None
    await db.flush()
    return serialize_leave_request(row)


def serialize_leave_request(row: DistributorLeaveRequest) -> dict[str, object]:
    status_map = {
        DistributorLeaveRequestStatus.pending: "Pending",
        DistributorLeaveRequestStatus.approved: "Approved",
        DistributorLeaveRequestStatus.rejected: "Rejected",
    }
    return {
        "id": str(row.id),
        "type": row.leave_type,
        "fromDate": row.from_date.isoformat(),
        "toDate": row.to_date.isoformat(),
        "days": float(row.days),
        "reason": row.reason,
        "status": status_map[row.status],
        "appliedAt": row.applied_at.isoformat(),
        "reviewedAt": row.reviewed_at.isoformat() if row.reviewed_at else None,
        "reviewNote": row.review_note,
    }


def _decimal(value: Decimal | float | int) -> float:
    return float(value or 0)


def serialize_payroll_period(row: DistributorPayrollPeriod | None) -> dict[str, object]:
    if row is None:
        return {
            "id": "",
            "periodLabel": "",
            "compensation": {
                "id": "",
                "periodLabel": "",
                "basicSalary": 0,
                "performanceIncentive": 0,
                "spotBonus": 0,
                "deductions": 0,
                "takeHome": 0,
                "paymentStatus": "waiting",
                "paidOn": None,
            },
            "performance": {
                "netSalesTarget": 0,
                "netSalesAchieved": 0,
                "achievementPct": 0,
                "incentiveSlab": 0,
                "calculatedIncentive": 0,
                "adjustments": 0,
                "finalIncentive": 0,
            },
            "promotion": None,
        }

    target = _decimal(row.net_sales_target)
    achieved = _decimal(row.net_sales_achieved)
    achievement_pct = round((achieved / target) * 100) if target > 0 else 0

    return {
        "id": row.id,
        "periodLabel": row.period_label,
        "compensation": {
            "id": row.id,
            "periodLabel": row.period_label,
            "basicSalary": _decimal(row.basic_salary),
            "performanceIncentive": _decimal(row.performance_incentive),
            "spotBonus": _decimal(row.spot_bonus),
            "deductions": _decimal(row.deductions),
            "takeHome": _decimal(row.take_home),
            "paymentStatus": row.payment_status.value,
            "paidOn": row.paid_on.isoformat() if row.paid_on else None,
        },
        "performance": {
            "netSalesTarget": target,
            "netSalesAchieved": achieved,
            "achievementPct": achievement_pct,
            "incentiveSlab": _decimal(row.incentive_slab),
            "calculatedIncentive": _decimal(row.calculated_incentive),
            "adjustments": _decimal(row.adjustments),
            "finalIncentive": _decimal(row.final_incentive),
        },
        "promotion": None,
    }


async def get_latest_partner_promotion(
    db: AsyncSession,
    *,
    mitra_user_id: UUID,
) -> dict[str, object] | None:
    result = await db.execute(
        select(DistributorPartnerPromotion)
        .where(DistributorPartnerPromotion.mitra_user_id == mitra_user_id)
        .order_by(desc(DistributorPartnerPromotion.effective_date), desc(DistributorPartnerPromotion.created_at))
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None
    return {
        "label": row.label,
        "previousBaseSalary": _decimal(row.previous_base_salary),
        "newBaseSalary": _decimal(row.new_base_salary),
        "hikePct": _decimal(row.hike_pct),
        "effectiveLabel": f"Effective {row.effective_date.strftime('%d %b %Y')}",
    }


async def get_payroll_dashboard(
    db: AsyncSession,
    *,
    actor: User,
    period_id: str | None = None,
) -> dict[str, object]:
    partner, _ = await _resolve_mitra_actor(db, actor)
    query = select(DistributorPayrollPeriod).where(
        DistributorPayrollPeriod.mitra_user_id == partner.user_id,
    )
    if period_id:
        query = query.where(DistributorPayrollPeriod.id == period_id)
    else:
        query = query.order_by(desc(DistributorPayrollPeriod.period_start))

    result = await db.execute(query.limit(1))
    payroll = result.scalar_one_or_none()
    payload = serialize_payroll_period(payroll)
    payload["promotion"] = await get_latest_partner_promotion(db, mitra_user_id=partner.user_id)
    return payload


async def list_payroll_periods(db: AsyncSession, *, actor: User) -> list[dict[str, object]]:
    partner, _ = await _resolve_mitra_actor(db, actor)
    result = await db.execute(
        select(DistributorPayrollPeriod)
        .where(DistributorPayrollPeriod.mitra_user_id == partner.user_id)
        .order_by(desc(DistributorPayrollPeriod.period_start))
    )
    return [
        {
            "id": row.id,
            "periodLabel": row.period_label,
            "takeHome": _decimal(row.take_home),
            "paymentStatus": row.payment_status.value,
            "paidOn": row.paid_on.isoformat() if row.paid_on else None,
        }
        for row in result.scalars().all()
    ]


async def grant_partner_promotion(
    db: AsyncSession,
    *,
    actor: User,
    partner_user_ref: str,
    label: str,
    previous_base_salary: Decimal,
    new_base_salary: Decimal,
    effective_date: date,
) -> dict[str, object]:
    role_keys = await list_user_role_keys(db, actor.id)
    if MITRA_STATE_HEAD_ROLE_KEY not in role_keys and MITRA_SUPER_HEAD_ROLE_KEY not in role_keys:
        raise DistributorWorkError(
            code="state_head_only",
            message="Only Mitra state heads can grant promotions.",
            status_code=403,
        )

    partner_user = await get_user_by_reference(db, partner_user_ref)
    if partner_user is None:
        raise DistributorWorkError(code="partner_not_found", message="Zynd Mitra not found.", status_code=404)

    partner = await get_distributor_partner_for_user(db, partner_user.id)
    if partner is None:
        raise DistributorWorkError(code="partner_not_found", message="Zynd Mitra not found.", status_code=404)

    if new_base_salary <= previous_base_salary:
        raise DistributorWorkError(
            code="invalid_salary",
            message="New base salary must be greater than the previous base salary.",
        )

    hike_pct = ((new_base_salary - previous_base_salary) / previous_base_salary) * Decimal("100")
    row = DistributorPartnerPromotion(
        mitra_user_id=partner.user_id,
        granted_by_user_id=actor.id,
        label=label.strip(),
        previous_base_salary=previous_base_salary,
        new_base_salary=new_base_salary,
        hike_pct=hike_pct.quantize(Decimal("0.01")),
        effective_date=effective_date,
    )
    db.add(row)
    await db.flush()
    return {
        "id": str(row.id),
        "label": row.label,
        "previousBaseSalary": _decimal(row.previous_base_salary),
        "newBaseSalary": _decimal(row.new_base_salary),
        "hikePct": _decimal(row.hike_pct),
        "effectiveLabel": f"Effective {row.effective_date.strftime('%d %b %Y')}",
    }
