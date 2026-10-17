"""Platform-wide KYC queue and MF transaction lists for the Support console."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from sqlalchemy import and_, func, not_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.distributor.distributor_orders_service import _mask_client_email
from app.application.kyc.journey_gate_service import is_rekyc_modification, resolve_kyc_form_type
from app.application.mf.mf_order_service import load_order_fund_metadata, serialize_order
from app.application.support.ticket_service import mask_email, person_name
from app.infrastructure.persistence.mf_models import Product
from app.infrastructure.persistence.mf_transaction_models import MfOrder, MfOrderStatus, MfOrderType
from app.infrastructure.persistence.models import (
    KycJourneyState,
    KycOverallStatus,
    KycStepStatus,
    User,
    UserKycStatus,
    UserRole,
)

SUPPORT_CONSOLE_LIST_MAX_LIMIT = 50

_IN_PROGRESS_OVERALL = {
    KycOverallStatus.in_progress,
    KycOverallStatus.phase1_complete,
    KycOverallStatus.phase2_complete,
}

_OPEN_ORDER_STATUSES = {
    MfOrderStatus.pending,
    MfOrderStatus.submitted,
    MfOrderStatus.payment_pending,
    MfOrderStatus.processing,
}

_STEP_STARTED = (
    KycStepStatus.verified,
    KycStepStatus.saved,
    KycStepStatus.failed,
    KycStepStatus.skipped,
)


def _step_started(kyc_status: UserKycStatus | None) -> bool:
    if not kyc_status:
        return False
    for field in (
        kyc_status.pan_step_status,
        kyc_status.digilocker_step_status,
        kyc_status.address_step_status,
        kyc_status.personal_step_status,
        kyc_status.nominee_step_status,
        kyc_status.bank_step_status,
        kyc_status.signature_step_status,
        kyc_status.review_step_status,
    ):
        if field in _STEP_STARTED:
            return True
    return False


def _has_meaningful_kyc_progress(
    journey: KycJourneyState | None,
    kyc_status: UserKycStatus | None,
) -> bool:
    if journey:
        if journey.pan_verification_status == "verified":
            return True
        if journey.last_completed_step:
            return True
        if journey.external_kyc_form_id:
            return True
        if journey.readiness_code:
            return True
        if journey.kyc_already_registered:
            return True
        if journey.kyc_form_type:
            return True
    return _step_started(kyc_status)


def _meaningful_progress_sql():
    return or_(
        KycJourneyState.pan_verification_status == "verified",
        KycJourneyState.last_completed_step.is_not(None),
        KycJourneyState.external_kyc_form_id.is_not(None),
        KycJourneyState.readiness_code.is_not(None),
        KycJourneyState.kyc_already_registered.is_(True),
        KycJourneyState.kyc_form_type.is_not(None),
        UserKycStatus.pan_step_status.in_(_STEP_STARTED),
        UserKycStatus.digilocker_step_status.in_(_STEP_STARTED),
        UserKycStatus.address_step_status.in_(_STEP_STARTED),
        UserKycStatus.personal_step_status.in_(_STEP_STARTED),
        UserKycStatus.nominee_step_status.in_(_STEP_STARTED),
        UserKycStatus.bank_step_status.in_(_STEP_STARTED),
        UserKycStatus.signature_step_status.in_(_STEP_STARTED),
        UserKycStatus.review_step_status.in_(_STEP_STARTED),
    )


def _not_started_sql():
    return and_(
        or_(
            UserKycStatus.user_id.is_(None),
            UserKycStatus.overall_status.notin_(
                [KycOverallStatus.submitted, KycOverallStatus.completed]
            ),
        ),
        not_(_meaningful_progress_sql()),
        not_(_escalated_condition()),
    )


def _resolved_cybrilla_form_type(journey: KycJourneyState | None) -> str:
    if journey is None:
        return "fresh"
    recorded = str(journey.kyc_form_type or "").strip().lower()
    if recorded in {"fresh", "modify"}:
        return recorded
    return resolve_kyc_form_type(journey)


def _cybrilla_partner_status(journey: KycJourneyState | None) -> str | None:
    if journey is None:
        return None
    form_status = str(journey.kyc_form_status or "").strip()
    external = str(journey.external_kyc_status or "").strip()
    if form_status and external and form_status.lower() != external.lower():
        return f"{form_status} · {external}"
    if form_status:
        return form_status
    if external:
        return external
    return None


def _queue_status_label(
    overall: KycOverallStatus,
    *,
    journey: KycJourneyState | None,
    kyc_status: UserKycStatus | None,
) -> str:
    if overall == KycOverallStatus.completed:
        return "Approved"
    if _is_kyc_escalated(journey, kyc_status):
        return "Escalated"
    if not _has_meaningful_kyc_progress(journey, kyc_status):
        return "Not started"
    if overall == KycOverallStatus.submitted:
        return "Pending review"
    if overall in _IN_PROGRESS_OVERALL:
        return "In progress"
    if overall == KycOverallStatus.none:
        return "In progress"
    return "In progress"


def _is_kyc_escalated(journey: KycJourneyState | None, kyc_status: UserKycStatus | None) -> bool:
    if journey:
        if journey.readiness_code:
            return True
        if journey.pan_verification_status == "failed":
            return True
        if journey.bank_verification_status == "failed":
            return True
        if journey.proof_details_status == "failed":
            return True
        if journey.digilocker_failure_reason:
            return True
    if kyc_status:
        step_fields = (
            kyc_status.pan_step_status,
            kyc_status.bank_step_status,
            kyc_status.review_step_status,
            kyc_status.digilocker_step_status,
        )
        if any(status == KycStepStatus.failed for status in step_fields):
            return True
    return False


def _review_type_label(
    journey: KycJourneyState | None,
    *,
    kyc_status: UserKycStatus | None,
    overall: KycOverallStatus,
) -> str:
    form_type = _resolved_cybrilla_form_type(journey)
    is_modify = bool(
        journey
        and (
            journey.kyc_already_registered
            or form_type == "modify"
            or is_rekyc_modification(journey)
        )
    )

    if overall == KycOverallStatus.completed:
        return "Re-KYC" if is_modify else "Fresh KYC"

    if not _has_meaningful_kyc_progress(journey, kyc_status):
        return "Not started"

    if journey and (journey.digilocker_failure_reason or journey.proof_details_status == "failed"):
        return "Document refresh"
    last = str(journey.last_completed_step or "").strip().lower() if journey else ""
    if last in {"contact", "address"}:
        return "Address update"
    if is_modify:
        return "Re-KYC"
    return "Fresh KYC"


def _kyc_priority(queue_status: str) -> str:
    if queue_status in {"Escalated", "Pending review"}:
        return "High"
    return "Normal"


def _kyc_submitted_at(journey: KycJourneyState | None, kyc_status: UserKycStatus | None):
    if kyc_status and kyc_status.updated_at:
        return kyc_status.updated_at
    if journey and journey.updated_at:
        return journey.updated_at
    return None


def _normalize_queue_filter(value: str | None) -> str | None:
    if not value or value.strip().lower() in {"all", ""}:
        return None
    normalized = value.strip().lower().replace("_", " ")
    mapping = {
        "pending review": "Pending review",
        "in progress": "In progress",
        "escalated": "Escalated",
        "approved": "Approved",
        "not started": "Not started",
    }
    return mapping.get(normalized)


def _escalated_condition():
    return or_(
        KycJourneyState.readiness_code.is_not(None),
        KycJourneyState.pan_verification_status == "failed",
        KycJourneyState.bank_verification_status == "failed",
        KycJourneyState.proof_details_status == "failed",
        KycJourneyState.digilocker_failure_reason.is_not(None),
        UserKycStatus.pan_step_status == KycStepStatus.failed,
        UserKycStatus.bank_step_status == KycStepStatus.failed,
        UserKycStatus.review_step_status == KycStepStatus.failed,
        UserKycStatus.digilocker_step_status == KycStepStatus.failed,
    )


def _apply_queue_status_filter(stmt, queue_filter: str | None):
    if not queue_filter:
        return stmt
    if queue_filter == "Approved":
        return stmt.where(UserKycStatus.overall_status == KycOverallStatus.completed)
    if queue_filter == "Escalated":
        return stmt.where(_escalated_condition())
    if queue_filter == "Not started":
        return stmt.where(_not_started_sql())
    if queue_filter == "In progress":
        return stmt.where(
            _meaningful_progress_sql(),
            UserKycStatus.overall_status.in_(tuple(_IN_PROGRESS_OVERALL)),
            not_(_escalated_condition()),
        )
    if queue_filter == "Pending review":
        return stmt.where(
            UserKycStatus.overall_status == KycOverallStatus.submitted,
            not_(_escalated_condition()),
        )
    return stmt


def _apply_review_type_filter(stmt, review_filter: str | None):
    if not review_filter:
        return stmt
    if review_filter == "Not started":
        return stmt.where(_not_started_sql())
    if review_filter in {"Fresh KYC", "New KYC"}:
        return stmt.where(
            _meaningful_progress_sql(),
            KycJourneyState.kyc_already_registered.is_not(True),
            or_(
                KycJourneyState.kyc_form_type.is_(None),
                KycJourneyState.kyc_form_type == "fresh",
            ),
        )
    if review_filter == "Re-KYC":
        return stmt.where(
            or_(
                KycJourneyState.kyc_already_registered.is_(True),
                KycJourneyState.kyc_form_type == "modify",
            )
        )
    if review_filter == "Address update":
        return stmt.where(KycJourneyState.last_completed_step.in_(("contact", "address")))
    if review_filter == "Document refresh":
        return stmt.where(
            or_(
                KycJourneyState.digilocker_failure_reason.is_not(None),
                KycJourneyState.proof_details_status == "failed",
            )
        )
    return stmt


def _normalize_review_filter(value: str | None) -> str | None:
    if not value or value.strip().lower() in {"all", ""}:
        return None
    normalized = value.strip().lower().replace("_", " ")
    mapping = {
        "new kyc": "Fresh KYC",
        "fresh kyc": "Fresh KYC",
        "re-kyc": "Re-KYC",
        "rekyc": "Re-KYC",
        "document refresh": "Document refresh",
        "address update": "Address update",
        "not started": "Not started",
    }
    return mapping.get(normalized, value.strip())


async def _kyc_metrics(db: AsyncSession) -> dict[str, int]:
    user_count = int(
        await db.scalar(select(func.count()).select_from(User).where(User.role == UserRole.user))
        or 0
    )
    status_rows = (
        await db.execute(
            select(UserKycStatus.overall_status, func.count())
            .join(User, User.id == UserKycStatus.user_id)
            .where(User.role == UserRole.user)
            .group_by(UserKycStatus.overall_status)
        )
    ).all()
    by_overall = {status: int(count) for status, count in status_rows}
    with_status = sum(by_overall.values())
    approved = int(by_overall.get(KycOverallStatus.completed, 0))
    pending_review = int(by_overall.get(KycOverallStatus.submitted, 0))
    in_progress = sum(int(by_overall.get(status, 0)) for status in _IN_PROGRESS_OVERALL)

    not_started = int(
        await db.scalar(
            select(func.count())
            .select_from(User)
            .outerjoin(UserKycStatus, UserKycStatus.user_id == User.id)
            .outerjoin(KycJourneyState, KycJourneyState.user_id == User.id)
            .where(User.role == UserRole.user, _not_started_sql())
        )
        or 0
    )

    escalated = int(
        await db.scalar(
            select(func.count())
            .select_from(User)
            .outerjoin(UserKycStatus, UserKycStatus.user_id == User.id)
            .outerjoin(KycJourneyState, KycJourneyState.user_id == User.id)
            .where(User.role == UserRole.user, _escalated_condition())
        )
        or 0
    )

    return {
        "pending_review": pending_review,
        "in_progress": in_progress,
        "escalated": escalated,
        "approved": approved,
        "not_started": not_started,
        "total_investors": user_count,
    }


async def list_support_kyc_verifications_page(
    db: AsyncSession,
    *,
    search: str | None = None,
    queue_status: str | None = None,
    review_type: str | None = None,
    offset: int = 0,
    limit: int = 25,
) -> dict[str, Any]:
    safe_offset = max(0, offset)
    safe_limit = min(max(1, limit), SUPPORT_CONSOLE_LIST_MAX_LIMIT)
    queue_filter = _normalize_queue_filter(queue_status)
    review_filter = _normalize_review_filter(review_type)

    stmt = (
        select(User, UserKycStatus, KycJourneyState)
        .outerjoin(UserKycStatus, UserKycStatus.user_id == User.id)
        .outerjoin(KycJourneyState, KycJourneyState.user_id == User.id)
        .where(User.role == UserRole.user)
        .order_by(
            KycJourneyState.updated_at.desc().nullslast(),
            UserKycStatus.updated_at.desc().nullslast(),
            User.created_at.desc(),
        )
    )

    if search:
        term = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                User.email.ilike(term),
                User.client_id.ilike(term),
                User.first_name.ilike(term),
                User.last_name.ilike(term),
                User.phone.ilike(term),
            )
        )

    stmt = _apply_queue_status_filter(stmt, queue_filter)
    stmt = _apply_review_type_filter(stmt, review_filter)

    count_stmt = select(func.count(User.id)).select_from(User)
    count_stmt = count_stmt.outerjoin(UserKycStatus, UserKycStatus.user_id == User.id)
    count_stmt = count_stmt.outerjoin(KycJourneyState, KycJourneyState.user_id == User.id)
    count_stmt = count_stmt.where(User.role == UserRole.user)
    if search:
        term = f"%{search.strip().lower()}%"
        count_stmt = count_stmt.where(
            or_(
                User.email.ilike(term),
                User.client_id.ilike(term),
                User.first_name.ilike(term),
                User.last_name.ilike(term),
                User.phone.ilike(term),
            )
        )
    count_stmt = _apply_queue_status_filter(count_stmt, queue_filter)
    count_stmt = _apply_review_type_filter(count_stmt, review_filter)
    total_count = int(await db.scalar(count_stmt) or 0)

    stmt = stmt.offset(safe_offset).limit(safe_limit + 1)
    rows = list((await db.execute(stmt)).all())
    has_more = len(rows) > safe_limit
    rows = rows[:safe_limit]

    items: list[dict[str, Any]] = []
    for user, kyc_status, journey in rows:
        overall = kyc_status.overall_status if kyc_status else KycOverallStatus.none
        queue_label = _queue_status_label(overall, journey=journey, kyc_status=kyc_status)
        review_label = _review_type_label(
            journey,
            kyc_status=kyc_status,
            overall=overall,
        )
        submitted_at = _kyc_submitted_at(journey, kyc_status)
        items.append(
            {
                "id": str(user.id),
                "client_code": user.client_id or "—",
                "display_name": person_name(user, fallback="Investor"),
                "email_masked": mask_email(user.email),
                "queue_status": queue_label,
                "review_type": review_label,
                "partner_status": _cybrilla_partner_status(journey),
                "cybrilla_form_type": _resolved_cybrilla_form_type(journey)
                if _has_meaningful_kyc_progress(journey, kyc_status)
                else None,
                "submitted_at": submitted_at.isoformat() if submitted_at else None,
                "priority": _kyc_priority(queue_label),
                "overall_status": overall.value,
            }
        )

    metrics = await _kyc_metrics(db) if safe_offset == 0 else None

    return {
        "items": items,
        "has_more": has_more,
        "next_offset": safe_offset + len(items),
        "total_count": total_count,
        "metrics": metrics,
    }


def _map_ui_order_status(raw: MfOrderStatus) -> str:
    if raw == MfOrderStatus.succeeded:
        return "Completed"
    if raw == MfOrderStatus.failed:
        return "Failed"
    if raw in _OPEN_ORDER_STATUSES:
        if raw == MfOrderStatus.pending:
            return "Pending"
        return "Processing"
    if raw == MfOrderStatus.cancelled:
        return "Failed"
    return "Processing"


def _map_ui_order_type(raw: MfOrderType) -> str:
    if raw == MfOrderType.redemption:
        return "Redeem"
    if raw == MfOrderType.switch:
        return "Switch"
    return "Purchase"


def _normalize_tx_status_filter(value: str | None) -> set[MfOrderStatus] | None:
    if not value or value.strip().lower() in {"all", ""}:
        return None
    normalized = value.strip().lower()
    if normalized == "completed":
        return {MfOrderStatus.succeeded}
    if normalized == "failed":
        return {MfOrderStatus.failed, MfOrderStatus.cancelled}
    if normalized == "pending":
        return {MfOrderStatus.pending}
    if normalized == "processing":
        return {
            MfOrderStatus.processing,
            MfOrderStatus.submitted,
            MfOrderStatus.payment_pending,
        }
    return None


def _normalize_tx_type_filter(value: str | None) -> set[MfOrderType] | None:
    if not value or value.strip().lower() in {"all", ""}:
        return None
    normalized = value.strip().lower()
    if normalized == "purchase":
        return {MfOrderType.lumpsum, MfOrderType.sip}
    if normalized == "redeem":
        return {MfOrderType.redemption}
    if normalized == "switch":
        return {MfOrderType.switch}
    return None


async def _transaction_metrics(db: AsyncSession) -> dict[str, Any]:
    total = int(await db.scalar(select(func.count()).select_from(MfOrder)) or 0)
    status_rows = (
        await db.execute(select(MfOrder.status, func.count()).group_by(MfOrder.status))
    ).all()
    by_status = {status: int(count) for status, count in status_rows}
    in_progress = sum(int(by_status.get(status, 0)) for status in _OPEN_ORDER_STATUSES)
    completed = int(by_status.get(MfOrderStatus.succeeded, 0))
    failed = int(by_status.get(MfOrderStatus.failed, 0)) + int(
        by_status.get(MfOrderStatus.cancelled, 0)
    )
    volume_raw = await db.scalar(
        select(func.coalesce(func.sum(MfOrder.amount_inr), 0)).where(
            MfOrder.status == MfOrderStatus.succeeded
        )
    )
    volume_inr = float(volume_raw or Decimal("0"))
    return {
        "total_transactions": total,
        "in_progress": in_progress,
        "completed": completed,
        "failed": failed,
        "volume_inr": volume_inr,
    }


async def list_support_transactions_page(
    db: AsyncSession,
    *,
    search: str | None = None,
    status: str | None = None,
    order_type: str | None = None,
    offset: int = 0,
    limit: int = 25,
) -> dict[str, Any]:
    safe_offset = max(0, offset)
    safe_limit = min(max(1, limit), SUPPORT_CONSOLE_LIST_MAX_LIMIT)
    status_filter = _normalize_tx_status_filter(status)
    type_filter = _normalize_tx_type_filter(order_type)

    stmt = (
        select(MfOrder, User)
        .join(User, User.id == MfOrder.user_id)
        .where(User.role == UserRole.user)
        .order_by(MfOrder.created_at.desc())
    )
    if status_filter:
        stmt = stmt.where(MfOrder.status.in_(status_filter))
    if type_filter:
        stmt = stmt.where(MfOrder.order_type.in_(type_filter))
    if search:
        term = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                User.email.ilike(term),
                User.client_id.ilike(term),
                MfOrder.fp_purchase_id.ilike(term),
            )
        )

    count_stmt = select(func.count(MfOrder.id)).select_from(MfOrder).join(User, User.id == MfOrder.user_id)
    count_stmt = count_stmt.where(User.role == UserRole.user)
    if status_filter:
        count_stmt = count_stmt.where(MfOrder.status.in_(status_filter))
    if type_filter:
        count_stmt = count_stmt.where(MfOrder.order_type.in_(type_filter))
    if search:
        term = f"%{search.strip().lower()}%"
        count_stmt = count_stmt.where(
            or_(
                User.email.ilike(term),
                User.client_id.ilike(term),
                MfOrder.fp_purchase_id.ilike(term),
            )
        )
    filtered_total = int(await db.scalar(count_stmt) or 0)

    stmt = stmt.offset(safe_offset).limit(safe_limit + 1)
    rows = list((await db.execute(stmt)).all())
    has_more = len(rows) > safe_limit
    rows = rows[:safe_limit]

    if not rows:
        metrics = await _transaction_metrics(db) if safe_offset == 0 else None
        return {
            "items": [],
            "has_more": False,
            "next_offset": safe_offset,
            "total_count": filtered_total,
            "metrics": metrics,
        }

    orders = [order for order, _user in rows]
    product_ids = {order.product_id for order in orders}
    products = {
        row.id: row.name
        for row in (await db.execute(select(Product).where(Product.id.in_(product_ids)))).scalars()
    } if product_ids else {}
    amc_names, amc_logos, amc_slugs = await load_order_fund_metadata(db, orders)

    items: list[dict[str, Any]] = []
    for order, user in rows:
        serialized = serialize_order(
            order,
            product_name=products.get(order.product_id),
            amc_name=amc_names.get(order.fund_id),
            amc_logo_url=amc_logos.get(order.fund_id),
            amc_slug=amc_slugs.get(order.fund_id),
        )
        ui_status = _map_ui_order_status(order.status)
        ui_type = _map_ui_order_type(order.order_type)
        order_ref = order.fp_purchase_id or str(order.id)
        items.append(
            {
                "id": str(order.id),
                "order_ref": order_ref,
                "client_code": user.client_id or "—",
                "investor_email_masked": _mask_client_email(user.email) or mask_email(user.email),
                "scheme_name": serialized.get("product_name") or "Mutual fund",
                "order_type": ui_type,
                "amount_inr": float(order.amount_inr),
                "status": ui_status,
                "raw_status": order.status.value,
                "created_at": order.created_at.isoformat() if order.created_at else None,
                "fp_purchase_id": order.fp_purchase_id,
            }
        )

    metrics = await _transaction_metrics(db) if safe_offset == 0 else None

    return {
        "items": items,
        "has_more": has_more,
        "next_offset": safe_offset + len(items),
        "total_count": filtered_total,
        "metrics": metrics,
    }
