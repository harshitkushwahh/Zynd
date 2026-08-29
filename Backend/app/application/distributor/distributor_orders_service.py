from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.distributor.distributor_client_link_service import (
    list_book_client_user_ids_for_actor,
)
from app.application.distributor.distributor_client_service import _distributor_contact_email
from app.application.mf.mf_order_service import load_order_fund_metadata, serialize_order
from app.infrastructure.persistence.mf_models import Product
from app.infrastructure.persistence.mf_transaction_models import MfOrder
from app.infrastructure.persistence.models import User, UserRole


def _mask_client_email(email: str | None) -> str | None:
    if not email:
        return None
    return _distributor_contact_email(email)


async def list_distributor_orders_for_actor(
    db: AsyncSession,
    *,
    actor: User,
    scope: str = "book",
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, Any]]:
    book_client_ids = set(await list_book_client_user_ids_for_actor(db, actor=actor))
    normalized_scope = scope.strip().lower()
    platform_scope = normalized_scope in {"platform", "all", "platform-wide"}

    if not platform_scope and not book_client_ids:
        return []

    stmt = (
        select(MfOrder, User)
        .join(User, User.id == MfOrder.user_id)
        .where(User.role == UserRole.user)
        .order_by(MfOrder.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    if not platform_scope:
        stmt = stmt.where(MfOrder.user_id.in_(book_client_ids))

    rows = list((await db.execute(stmt)).all())
    if not rows:
        return []

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
        items.append(
            {
                **serialized,
                "client_user_id": user.id,
                "client_code": user.client_id,
                "client_email_masked": _mask_client_email(user.email),
                "in_distributor_book": user.id in book_client_ids,
            }
        )
    return items
