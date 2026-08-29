from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.documents.profile_image_url_service import resolve_profile_image_urls_by_user_id
from app.application.mf.mf_lumpsum_reconciliation_service import (
    reconcile_checkout_payment,
    reconcile_order_payment,
)
from app.application.mf.mf_order_service import TERMINAL_STATUSES, _derive_next_action, serialize_order
from app.application.mf.mf_sip_plan_service import (
    advance_sip_plan,
    load_sip_plan_fund_metadata,
    reconcile_sip_plan_from_fp,
    serialize_sip_plan,
)
from app.application.mf.mf_cart_service import serialize_checkout
from app.application.mf.mf_mandate_service import serialize_mandate, sync_mandate_from_fp
from app.application.mf.mf_webhook_service import replay_finprim_webhook_event
from app.application.mf.public_asset_service import resolve_amc_logo_url
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import FundAmc, MutualFund, Product
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.mf_transaction_models import (
    MfCheckout,
    MfCheckoutStatus,
    MfCheckoutType,
    MfFinprimWebhookEvent,
    MfMandate,
    MfMandateStatus,
    MfOrder,
    MfOrderEvent,
    MfOrderStatus,
    MfOrderType,
    MfSipPlan,
    MfSipPlanEvent,
    MfSipPlanStatus,
    MfWebhookProcessingStatus,
)

logger = logging.getLogger(__name__)

_OPEN_CHECKOUT_STATUSES = {
    MfCheckoutStatus.submitted,
    MfCheckoutStatus.payment_pending,
    MfCheckoutStatus.processing,
    MfCheckoutStatus.pending,
}


def _user_display_name(user: User) -> str:
    parts = [user.first_name, user.last_name]
    name = " ".join(part.strip() for part in parts if part and part.strip())
    if name:
        return name
    local = user.email.split("@", 1)[0]
    return local.replace(".", " ").replace("_", " ").title()


async def _serialize_orders_for_admin(
    session: AsyncSession,
    orders: list[MfOrder],
    *,
    checkout: MfCheckout | None = None,
) -> list[dict[str, Any]]:
    if not orders:
        return []

    settings = get_settings()
    product_ids = {order.product_id for order in orders}
    user_ids = list({order.user_id for order in orders})
    fund_ids = {order.fund_id for order in orders}

    products = {
        row.id: row.name
        for row in (await session.execute(select(Product).where(Product.id.in_(product_ids)))).scalars()
    } if product_ids else {}

    users = {
        row.id: row
        for row in (await session.execute(select(User).where(User.id.in_(user_ids)))).scalars()
    } if user_ids else {}

    profile_image_urls = await resolve_profile_image_urls_by_user_id(session, user_ids)

    amc_logos_by_fund: dict[int, str | None] = {}
    if fund_ids:
        funds = {
            row.id: row
            for row in (
                await session.execute(select(MutualFund).where(MutualFund.id.in_(fund_ids)))
            ).scalars()
        }
        amc_ids = {fund.amc_id for fund in funds.values()}
        amcs = {
            row.id: row
            for row in (await session.execute(select(FundAmc).where(FundAmc.id.in_(amc_ids)))).scalars()
        } if amc_ids else {}
        for fund_id, fund in funds.items():
            amc = amcs.get(fund.amc_id)
            amc_logos_by_fund[fund_id] = (
                resolve_amc_logo_url(amc.logo_url, amc.slug, settings) if amc else None
            )

    serialized: list[dict[str, Any]] = []
    for order in orders:
        user = users.get(order.user_id)
        payload = serialize_order(
            order,
            product_name=products.get(order.product_id),
            checkout=checkout if checkout and order.checkout_id == checkout.id else None,
        )
        payload.update(
            {
                "user_id": str(order.user_id),
                "client_id": user.client_id if user else None,
                "user_email": user.email if user else None,
                "user_display_name": _user_display_name(user) if user else None,
                "user_profile_image_url": profile_image_urls.get(order.user_id),
                "amc_logo_url": amc_logos_by_fund.get(order.fund_id),
            }
        )
        serialized.append(payload)
    return serialized


async def get_transaction_overview(session: AsyncSession) -> dict[str, Any]:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    stuck_cutoff = now - timedelta(minutes=settings.zynd_mf_stuck_transaction_minutes)
    since_24h = now - timedelta(hours=24)

    order_counts = dict(
        (
            await session.execute(
                select(MfOrder.status, func.count())
                .group_by(MfOrder.status)
            )
        ).all()
    )

    stuck_orders = int(
        await session.scalar(
            select(func.count())
            .select_from(MfOrder)
            .where(
                MfOrder.status.not_in(list(TERMINAL_STATUSES)),
                MfOrder.updated_at < stuck_cutoff,
            )
        )
        or 0
    )

    stuck_checkouts = int(
        await session.scalar(
            select(func.count())
            .select_from(MfCheckout)
            .where(
                MfCheckout.status.in_(list(_OPEN_CHECKOUT_STATUSES)),
                MfCheckout.updated_at < stuck_cutoff,
            )
        )
        or 0
    )

    stuck_mandates = int(
        await session.scalar(
            select(func.count())
            .select_from(MfMandate)
            .where(
                MfMandate.status == MfMandateStatus.auth_pending,
                MfMandate.updated_at < stuck_cutoff,
            )
        )
        or 0
    )

    stuck_sip_plans = int(
        await session.scalar(
            select(func.count())
            .select_from(MfSipPlan)
            .where(
                MfSipPlan.status.not_in(
                    [MfSipPlanStatus.active, MfSipPlanStatus.failed, MfSipPlanStatus.cancelled]
                ),
                MfSipPlan.updated_at < stuck_cutoff,
            )
        )
        or 0
    )

    failed_orders_24h = int(
        await session.scalar(
            select(func.count())
            .select_from(MfOrder)
            .where(MfOrder.status == MfOrderStatus.failed, MfOrder.updated_at >= since_24h)
        )
        or 0
    )

    failed_webhooks_24h = int(
        await session.scalar(
            select(func.count())
            .select_from(MfFinprimWebhookEvent)
            .where(
                MfFinprimWebhookEvent.processing_status == MfWebhookProcessingStatus.failed,
                MfFinprimWebhookEvent.received_at >= since_24h,
            )
        )
        or 0
    )

    return {
        "order_counts": {status.value: int(count) for status, count in order_counts.items()},
        "stuck_orders": stuck_orders,
        "stuck_checkouts": stuck_checkouts,
        "stuck_mandates": stuck_mandates,
        "stuck_sip_plans": stuck_sip_plans,
        "failed_orders_24h": failed_orders_24h,
        "failed_webhooks_24h": failed_webhooks_24h,
        "stuck_threshold_minutes": settings.zynd_mf_stuck_transaction_minutes,
        "payment_expiry_minutes": settings.zynd_mf_payment_expiry_minutes,
    }


async def list_orders_admin(
    session: AsyncSession,
    *,
    status: str | None = None,
    order_type: str | None = None,
    checkout_type: str | None = None,
    user_id: uuid.UUID | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    query = select(MfOrder).order_by(MfOrder.created_at.desc()).limit(limit)
    if status:
        try:
            query = query.where(MfOrder.status == MfOrderStatus(status))
        except ValueError:
            pass
    if order_type:
        try:
            query = query.where(MfOrder.order_type == MfOrderType(order_type))
        except ValueError:
            pass
    if checkout_type:
        try:
            parsed_checkout_type = MfCheckoutType(checkout_type)
        except ValueError:
            parsed_checkout_type = None
        if parsed_checkout_type is not None:
            query = query.join(MfCheckout, MfOrder.checkout_id == MfCheckout.id).where(
                MfCheckout.checkout_type == parsed_checkout_type
            )
    if user_id:
        query = query.where(MfOrder.user_id == user_id)
    orders = list((await session.execute(query)).scalars())
    return await _serialize_orders_for_admin(session, orders)


async def _serialize_sip_plans_for_admin(
    session: AsyncSession,
    plans: list[MfSipPlan],
) -> list[dict[str, Any]]:
    if not plans:
        return []

    settings = get_settings()
    product_ids = {plan.product_id for plan in plans}
    user_ids = list({plan.user_id for plan in plans})
    mandate_ids = {plan.mf_mandate_id for plan in plans if plan.mf_mandate_id}
    fund_ids = {plan.fund_id for plan in plans}

    products = {
        row.id: row.name
        for row in (await session.execute(select(Product).where(Product.id.in_(product_ids)))).scalars()
    } if product_ids else {}

    users = {
        row.id: row
        for row in (await session.execute(select(User).where(User.id.in_(user_ids)))).scalars()
    } if user_ids else {}

    mandates = {
        row.id: row
        for row in (await session.execute(select(MfMandate).where(MfMandate.id.in_(mandate_ids)))).scalars()
    } if mandate_ids else {}

    profile_image_urls = await resolve_profile_image_urls_by_user_id(session, user_ids)

    amc_logos_by_fund: dict[int, str | None] = {}
    if fund_ids:
        funds = {
            row.id: row
            for row in (
                await session.execute(select(MutualFund).where(MutualFund.id.in_(fund_ids)))
            ).scalars()
        }
        amc_ids = {fund.amc_id for fund in funds.values()}
        amcs = {
            row.id: row
            for row in (await session.execute(select(FundAmc).where(FundAmc.id.in_(amc_ids)))).scalars()
        } if amc_ids else {}
        for fund_id, fund in funds.items():
            amc = amcs.get(fund.amc_id)
            amc_logos_by_fund[fund_id] = (
                resolve_amc_logo_url(amc.logo_url, amc.slug, settings) if amc else None
            )

    serialized: list[dict[str, Any]] = []
    for plan in plans:
        user = users.get(plan.user_id)
        mandate = mandates.get(plan.mf_mandate_id) if plan.mf_mandate_id else None
        payload = serialize_sip_plan(
            plan,
            product_name=products.get(plan.product_id),
            mandate=mandate,
        )
        payload.update(
            {
                "user_id": str(plan.user_id),
                "client_id": user.client_id if user else None,
                "user_email": user.email if user else None,
                "user_display_name": _user_display_name(user) if user else None,
                "user_profile_image_url": profile_image_urls.get(plan.user_id),
                "amc_logo_url": amc_logos_by_fund.get(plan.fund_id),
            }
        )
        serialized.append(payload)
    return serialized


async def list_sip_plans_admin(
    session: AsyncSession,
    *,
    status: str | None = None,
    user_id: uuid.UUID | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    query = select(MfSipPlan).order_by(MfSipPlan.created_at.desc()).limit(limit)
    if status:
        try:
            query = query.where(MfSipPlan.status == MfSipPlanStatus(status))
        except ValueError:
            pass
    if user_id:
        query = query.where(MfSipPlan.user_id == user_id)
    plans = list((await session.execute(query)).scalars())
    return await _serialize_sip_plans_for_admin(session, plans)


_WORKING_SIP_STATUSES = {
    MfSipPlanStatus.pending,
    MfSipPlanStatus.review,
    MfSipPlanStatus.consent_pending,
}


def _sip_plan_counts(plans: list[MfSipPlan]) -> dict[str, int]:
    active = sum(1 for plan in plans if plan.status == MfSipPlanStatus.active)
    working = sum(1 for plan in plans if plan.status in _WORKING_SIP_STATUSES)
    cancelled = sum(1 for plan in plans if plan.status == MfSipPlanStatus.cancelled)
    failed = sum(1 for plan in plans if plan.status == MfSipPlanStatus.failed)
    return {
        "total": len(plans),
        "active": active,
        "working": working,
        "cancelled": cancelled,
        "failed": failed,
    }


async def _load_sip_plans_by_mandate_ids(
    session: AsyncSession,
    mandate_ids: list[uuid.UUID],
) -> dict[uuid.UUID, list[MfSipPlan]]:
    if not mandate_ids:
        return {}
    rows = list(
        (
            await session.execute(
                select(MfSipPlan)
                .where(MfSipPlan.mf_mandate_id.in_(mandate_ids))
                .order_by(MfSipPlan.created_at.desc())
            )
        ).scalars()
    )
    grouped: dict[uuid.UUID, list[MfSipPlan]] = {}
    for plan in rows:
        if plan.mf_mandate_id is None:
            continue
        grouped.setdefault(plan.mf_mandate_id, []).append(plan)
    return grouped


async def _serialize_mandates_for_admin(
    session: AsyncSession,
    mandates: list[MfMandate],
) -> list[dict[str, Any]]:
    if not mandates:
        return []

    user_ids = list({mandate.user_id for mandate in mandates})
    users = {
        row.id: row
        for row in (await session.execute(select(User).where(User.id.in_(user_ids)))).scalars()
    } if user_ids else {}

    profile_image_urls = await resolve_profile_image_urls_by_user_id(session, user_ids)
    plans_by_mandate = await _load_sip_plans_by_mandate_ids(
        session,
        [mandate.id for mandate in mandates],
    )

    serialized: list[dict[str, Any]] = []
    for mandate in mandates:
        user = users.get(mandate.user_id)
        linked_plans = plans_by_mandate.get(mandate.id, [])
        payload = serialize_mandate(mandate, expose_mandate_limit=True)
        payload.update(
            {
                "user_id": str(mandate.user_id),
                "client_id": user.client_id if user else None,
                "user_email": user.email if user else None,
                "user_display_name": _user_display_name(user) if user else None,
                "user_profile_image_url": profile_image_urls.get(mandate.user_id),
                "sip_plan_counts": _sip_plan_counts(linked_plans),
            }
        )
        serialized.append(payload)
    return serialized


async def get_mandates_summary(session: AsyncSession) -> dict[str, int]:
    total = int(await session.scalar(select(func.count()).select_from(MfMandate)) or 0)
    active = int(
        await session.scalar(
            select(func.count())
            .select_from(MfMandate)
            .where(MfMandate.status == MfMandateStatus.approved)
        )
        or 0
    )
    auth_pending = int(
        await session.scalar(
            select(func.count())
            .select_from(MfMandate)
            .where(MfMandate.status == MfMandateStatus.auth_pending)
        )
        or 0
    )
    return {
        "total_mandates": total,
        "active_mandates": active,
        "auth_pending_mandates": auth_pending,
    }


async def list_mandates_admin(
    session: AsyncSession,
    *,
    status: str | None = None,
    user_id: uuid.UUID | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    query = select(MfMandate).order_by(MfMandate.created_at.desc()).limit(limit)
    if status:
        try:
            query = query.where(MfMandate.status == MfMandateStatus(status))
        except ValueError:
            pass
    if user_id:
        query = query.where(MfMandate.user_id == user_id)
    mandates = list((await session.execute(query)).scalars())
    return {
        "mandates": await _serialize_mandates_for_admin(session, mandates),
        "summary": await get_mandates_summary(session),
    }


async def _serialize_checkouts_for_admin(
    session: AsyncSession,
    checkouts: list[MfCheckout],
) -> list[dict[str, Any]]:
    if not checkouts:
        return []

    checkout_ids = [checkout.id for checkout in checkouts]
    user_ids = list({checkout.user_id for checkout in checkouts})

    orders_by_checkout: dict[uuid.UUID, list[MfOrder]] = {}
    if checkout_ids:
        order_rows = list(
            (
                await session.execute(
                    select(MfOrder)
                    .where(MfOrder.checkout_id.in_(checkout_ids))
                    .order_by(MfOrder.line_index)
                )
            ).scalars()
        )
        for order in order_rows:
            if order.checkout_id is None:
                continue
            orders_by_checkout.setdefault(order.checkout_id, []).append(order)

    product_ids = {
        order.product_id for orders in orders_by_checkout.values() for order in orders
    }
    products = {
        row.id: row.name
        for row in (await session.execute(select(Product).where(Product.id.in_(product_ids)))).scalars()
    } if product_ids else {}

    users = {
        row.id: row
        for row in (await session.execute(select(User).where(User.id.in_(user_ids)))).scalars()
    } if user_ids else {}

    profile_image_urls = await resolve_profile_image_urls_by_user_id(session, user_ids)

    serialized: list[dict[str, Any]] = []
    for checkout in checkouts:
        orders = orders_by_checkout.get(checkout.id, [])
        user = users.get(checkout.user_id)
        payment_url = checkout.token_url
        status = checkout.status.value
        order_previews = [
            {
                "order_id": str(order.id),
                "product_id": str(order.product_id),
                "product_name": products.get(order.product_id),
                "amount_inr": float(order.amount_inr),
                "status": order.status.value,
                "order_type": order.order_type.value,
                "line_index": order.line_index,
            }
            for order in sorted(orders, key=lambda row: row.line_index)
        ]
        serialized.append(
            {
                "checkout_id": str(checkout.id),
                "checkout_type": checkout.checkout_type.value,
                "status": status,
                "total_amount_inr": float(checkout.total_amount_inr),
                "payment_url": payment_url,
                "next_action": _derive_next_action(status=status, payment_url=payment_url),
                "fp_payment_id": checkout.fp_payment_id,
                "failure_code": checkout.failure_code,
                "failure_reason": checkout.failure_reason,
                "created_at": checkout.created_at.isoformat() if checkout.created_at else None,
                "updated_at": checkout.updated_at.isoformat() if checkout.updated_at else None,
                "order_count": len(orders),
                "lumpsum_item_count": len(orders),
                "sip_item_count": 0,
                "orders": order_previews,
                "user_id": str(checkout.user_id),
                "client_id": user.client_id if user else None,
                "user_email": user.email if user else None,
                "user_display_name": _user_display_name(user) if user else None,
                "user_profile_image_url": profile_image_urls.get(checkout.user_id),
            }
        )
    return serialized


async def list_checkouts_admin(
    session: AsyncSession,
    *,
    checkout_type: str | None = None,
    status: str | None = None,
    user_id: uuid.UUID | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    query = select(MfCheckout).order_by(MfCheckout.created_at.desc()).limit(limit)
    if checkout_type:
        try:
            query = query.where(MfCheckout.checkout_type == MfCheckoutType(checkout_type))
        except ValueError:
            pass
    if status:
        try:
            query = query.where(MfCheckout.status == MfCheckoutStatus(status))
        except ValueError:
            pass
    if user_id:
        query = query.where(MfCheckout.user_id == user_id)
    checkouts = list((await session.execute(query)).scalars())
    return await _serialize_checkouts_for_admin(session, checkouts)


async def list_sip_batches_admin(
    session: AsyncSession,
    *,
    status: str | None = None,
    user_id: uuid.UUID | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    mandate_counts = (
        select(
            MfSipPlan.mf_mandate_id.label("mandate_id"),
            func.count().label("plan_count"),
        )
        .where(MfSipPlan.mf_mandate_id.isnot(None))
        .group_by(MfSipPlan.mf_mandate_id)
        .having(func.count() >= 2)
        .subquery()
    )
    query = (
        select(MfMandate)
        .join(mandate_counts, MfMandate.id == mandate_counts.c.mandate_id)
        .order_by(MfMandate.created_at.desc())
        .limit(limit)
    )
    if status:
        try:
            query = query.where(MfMandate.status == MfMandateStatus(status))
        except ValueError:
            pass
    if user_id:
        query = query.where(MfMandate.user_id == user_id)
    mandates = list((await session.execute(query)).scalars())
    if not mandates:
        return []

    plans_by_mandate = await _load_sip_plans_by_mandate_ids(
        session,
        [mandate.id for mandate in mandates],
    )
    serialized_mandates = await _serialize_mandates_for_admin(session, mandates)
    mandate_payloads = {payload["mandate_id"]: payload for payload in serialized_mandates}

    batches: list[dict[str, Any]] = []
    for mandate in mandates:
        linked_plans = plans_by_mandate.get(mandate.id, [])
        plan_payloads = await _serialize_sip_plans_for_admin(session, linked_plans)
        total_amount_inr = sum(plan.amount_inr for plan in linked_plans)
        mandate_payload = mandate_payloads.get(str(mandate.id), {})
        batches.append(
            {
                "batch_id": str(mandate.id),
                "mandate_id": str(mandate.id),
                "mandate_status": mandate.status.value,
                "plan_count": len(linked_plans),
                "total_amount_inr": float(total_amount_inr),
                "auth_url": mandate_payload.get("auth_url"),
                "next_action": mandate_payload.get("next_action"),
                "created_at": mandate.created_at.isoformat() if mandate.created_at else None,
                "updated_at": mandate.updated_at.isoformat() if mandate.updated_at else None,
                "plans": plan_payloads,
                "user_id": mandate_payload.get("user_id"),
                "client_id": mandate_payload.get("client_id"),
                "user_email": mandate_payload.get("user_email"),
                "user_display_name": mandate_payload.get("user_display_name"),
                "user_profile_image_url": mandate_payload.get("user_profile_image_url"),
                "sip_plan_counts": mandate_payload.get("sip_plan_counts"),
            }
        )
    return batches


async def get_order_admin(session: AsyncSession, order_id: uuid.UUID) -> dict[str, Any] | None:
    order = await session.get(MfOrder, order_id)
    if not order:
        return None
    events = list(
        (
            await session.execute(
                select(MfOrderEvent)
                .where(MfOrderEvent.order_id == order.id)
                .order_by(MfOrderEvent.created_at)
            )
        ).scalars()
    )
    checkout = await session.get(MfCheckout, order.checkout_id) if order.checkout_id else None
    order_payload = (await _serialize_orders_for_admin(session, [order], checkout=checkout))[0]
    return {
        "order": order_payload,
        "events": [
            {
                "from_status": event.from_status,
                "to_status": event.to_status,
                "source": event.source,
                "payload": event.payload,
                "created_at": event.created_at.isoformat() if event.created_at else None,
            }
            for event in events
        ],
    }


async def get_checkout_admin(session: AsyncSession, checkout_id: uuid.UUID) -> dict[str, Any] | None:
    checkout = await session.get(MfCheckout, checkout_id)
    if not checkout:
        return None
    orders = list(
        (
            await session.execute(
                select(MfOrder).where(MfOrder.checkout_id == checkout.id).order_by(MfOrder.line_index)
            )
        ).scalars()
    )
    product_ids = {order.product_id for order in orders}
    products = {
        row.id: row.name
        for row in (await session.execute(select(Product).where(Product.id.in_(product_ids)))).scalars()
    } if product_ids else {}
    payload = serialize_checkout(checkout, orders, product_names=products)
    return await _enrich_checkout_admin_payload(session, checkout, payload, orders)


async def _enrich_checkout_admin_payload(
    session: AsyncSession,
    checkout: MfCheckout,
    payload: dict[str, Any],
    orders: list[MfOrder],
) -> dict[str, Any]:
    settings = get_settings()
    user = await session.get(User, checkout.user_id)
    profile_image_urls = await resolve_profile_image_urls_by_user_id(session, [checkout.user_id])
    order_types = {order.id: order.order_type.value for order in orders}
    order_fund_ids = {order.id: order.fund_id for order in orders}

    amc_logos_by_fund: dict[int, str | None] = {}
    fund_ids = set(order_fund_ids.values())
    if fund_ids:
        funds = {
            row.id: row
            for row in (
                await session.execute(select(MutualFund).where(MutualFund.id.in_(fund_ids)))
            ).scalars()
        }
        amc_ids = {fund.amc_id for fund in funds.values()}
        amcs = {
            row.id: row
            for row in (await session.execute(select(FundAmc).where(FundAmc.id.in_(amc_ids)))).scalars()
        } if amc_ids else {}
        for fund_id, fund in funds.items():
            amc = amcs.get(fund.amc_id)
            amc_logos_by_fund[fund_id] = (
                resolve_amc_logo_url(amc.logo_url, amc.slug, settings) if amc else None
            )

    enriched_orders = []
    for order_payload in payload.get("orders", []):
        order_id = uuid.UUID(order_payload["order_id"])
        fund_id = order_fund_ids.get(order_id)
        enriched_orders.append(
            {
                **order_payload,
                "order_type": order_types.get(order_id, "LUMPSUM"),
                "amc_logo_url": amc_logos_by_fund.get(fund_id) if fund_id is not None else None,
            }
        )
    payload["orders"] = enriched_orders
    payload.update(
        {
            "updated_at": checkout.updated_at.isoformat() if checkout.updated_at else None,
            "user_id": str(checkout.user_id),
            "client_id": user.client_id if user else None,
            "user_email": user.email if user else None,
            "user_display_name": _user_display_name(user) if user else None,
            "user_profile_image_url": profile_image_urls.get(checkout.user_id),
        }
    )
    return payload


async def get_sip_plan_admin(session: AsyncSession, plan_id: uuid.UUID) -> dict[str, Any] | None:
    plan = await session.get(MfSipPlan, plan_id)
    if not plan:
        return None
    product = await session.get(Product, plan.product_id)
    mandate = await session.get(MfMandate, plan.mf_mandate_id) if plan.mf_mandate_id else None
    events = list(
        (
            await session.execute(
                select(MfSipPlanEvent)
                .where(MfSipPlanEvent.plan_id == plan.id)
                .order_by(MfSipPlanEvent.created_at)
            )
        ).scalars()
    )
    amc_names, amc_logos, isins = await load_sip_plan_fund_metadata(session, [plan])
    return {
        "plan": serialize_sip_plan(
            plan,
            product_name=product.name if product else None,
            mandate=mandate,
            amc_name=amc_names.get(plan.fund_id),
            amc_logo_url=amc_logos.get(plan.fund_id),
            isin=isins.get(plan.fund_id),
        ),
        "events": [
            {
                "from_status": event.from_status,
                "to_status": event.to_status,
                "source": event.source,
                "payload": event.payload,
                "created_at": event.created_at.isoformat() if event.created_at else None,
            }
            for event in events
        ],
    }


async def get_mandate_admin(session: AsyncSession, mandate_id: uuid.UUID) -> dict[str, Any] | None:
    mandate = await session.get(MfMandate, mandate_id)
    if not mandate:
        return None

    user = await session.get(User, mandate.user_id)
    profile_image_urls = await resolve_profile_image_urls_by_user_id(session, [mandate.user_id])
    linked_plans = list(
        (
            await session.execute(
                select(MfSipPlan)
                .where(MfSipPlan.mf_mandate_id == mandate.id)
                .order_by(MfSipPlan.created_at.desc())
            )
        ).scalars()
    )
    product_ids = {plan.product_id for plan in linked_plans}
    products = {
        row.id: row.name
        for row in (await session.execute(select(Product).where(Product.id.in_(product_ids)))).scalars()
    } if product_ids else {}

    sip_plans = [
        serialize_sip_plan(plan, product_name=products.get(plan.product_id))
        for plan in linked_plans
    ]

    mandate_payload = serialize_mandate(mandate, expose_mandate_limit=True)
    mandate_payload.update(
        {
            "user_id": str(mandate.user_id),
            "client_id": user.client_id if user else None,
            "user_email": user.email if user else None,
            "user_display_name": _user_display_name(user) if user else None,
            "user_profile_image_url": profile_image_urls.get(mandate.user_id),
            "sip_plan_counts": _sip_plan_counts(linked_plans),
            "sip_plans": sip_plans,
        }
    )
    return mandate_payload


async def list_webhook_events_admin(
    session: AsyncSession,
    *,
    processing_status: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    query = select(MfFinprimWebhookEvent).order_by(MfFinprimWebhookEvent.received_at.desc()).limit(limit)
    if processing_status:
        try:
            query = query.where(MfFinprimWebhookEvent.processing_status == MfWebhookProcessingStatus(processing_status))
        except ValueError:
            pass
    rows = list((await session.execute(query)).scalars())
    return [
        {
            "event_id": row.id,
            "fp_event_id": row.fp_event_id,
            "event_type": row.event_type,
            "processing_status": row.processing_status.value,
            "processing_error": row.processing_error,
            "received_at": row.received_at.isoformat() if row.received_at else None,
            "processed_at": row.processed_at.isoformat() if row.processed_at else None,
        }
        for row in rows
    ]


async def expire_stale_checkouts(session: AsyncSession) -> dict[str, int]:
    settings = get_settings()
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=settings.zynd_mf_payment_expiry_minutes)
    checkouts = list(
        (
            await session.execute(
                select(MfCheckout).where(
                    MfCheckout.status.in_([MfCheckoutStatus.submitted, MfCheckoutStatus.payment_pending]),
                    MfCheckout.updated_at < cutoff,
                )
            )
        ).scalars()
    )
    expired = 0
    for checkout in checkouts:
        orders = list(
            (
                await session.execute(
                    select(MfOrder).where(MfOrder.checkout_id == checkout.id)
                )
            ).scalars()
        )
        reconcile = await reconcile_checkout_payment(session, checkout)
        if reconcile.get("repaired"):
            continue
        await session.refresh(checkout)
        if checkout.status not in {MfCheckoutStatus.submitted, MfCheckoutStatus.payment_pending}:
            continue

        checkout.status = MfCheckoutStatus.cancelled
        checkout.failure_code = checkout.failure_code or "payment_expired"
        checkout.failure_reason = checkout.failure_reason or "Payment link expired"
        open_orders = [
            order
            for order in orders
            if order.status not in TERMINAL_STATUSES and order.status != MfOrderStatus.submitted
        ]
        for order in open_orders:
            order.status = MfOrderStatus.cancelled
            order.failure_code = order.failure_code or "payment_expired"
            order.failure_reason = order.failure_reason or "Payment link expired"
        expired += 1
    await session.flush()
    return {"expired_checkouts": expired}


async def reconcile_order_admin(session: AsyncSession, order_id: uuid.UUID) -> dict[str, Any]:
    order = await session.get(MfOrder, order_id)
    if not order:
        raise ValueError("Order not found")
    result = await reconcile_order_payment(session, order)
    product = await session.get(Product, order.product_id)
    checkout = await session.get(MfCheckout, order.checkout_id) if order.checkout_id else None
    return {
        **result,
        "order": serialize_order(order, product_name=product.name if product else None, checkout=checkout),
    }


async def reconcile_sip_plan_admin(session: AsyncSession, plan_id: uuid.UUID) -> dict[str, Any]:
    plan = await session.get(MfSipPlan, plan_id)
    if not plan:
        raise ValueError("SIP plan not found")
    outcome = await reconcile_sip_plan_from_fp(session, plan, retry_submit=True)
    product = await session.get(Product, plan.product_id)
    mandate = await session.get(MfMandate, plan.mf_mandate_id) if plan.mf_mandate_id else None
    return {
        **outcome,
        "plan": serialize_sip_plan(plan, product_name=product.name if product else None, mandate=mandate),
    }


async def reconcile_mandate_admin(session: AsyncSession, mandate_id: uuid.UUID) -> dict[str, Any]:
    mandate = await session.get(MfMandate, mandate_id)
    if not mandate:
        raise ValueError("Mandate not found")
    synced = await sync_mandate_from_fp(session, mandate, force=True)
    return {"synced": synced, "mandate": serialize_mandate(mandate, expose_mandate_limit=True)}


async def replay_webhook_admin(session: AsyncSession, event_id: int) -> dict[str, Any]:
    return await replay_finprim_webhook_event(session, event_id=event_id)


async def replay_failed_webhooks(session: AsyncSession, *, batch_size: int) -> dict[str, int]:
    rows = list(
        (
            await session.execute(
                select(MfFinprimWebhookEvent)
                .where(MfFinprimWebhookEvent.processing_status == MfWebhookProcessingStatus.failed)
                .order_by(MfFinprimWebhookEvent.received_at)
                .limit(batch_size)
            )
        ).scalars()
    )
    replayed = 0
    for row in rows:
        try:
            await replay_finprim_webhook_event(session, event_id=row.id)
            replayed += 1
        except Exception:
            logger.exception("Webhook replay failed event_id=%s", row.id)
    return {"processed": len(rows), "replayed": replayed}
