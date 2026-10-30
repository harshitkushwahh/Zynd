"""Order-id lookup and UUID extraction for Help Bot payment answers."""

from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.support.context_pack import order_row_from_mf_order
from app.application.support.help_bot_payment_replies import describe_order_for_customer
from app.application.mf.mf_order_service import get_user_order

_ORDER_UUID = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b",
    re.I,
)


def extract_order_uuids(text: str) -> tuple[str, ...]:
    return tuple(dict.fromkeys(_ORDER_UUID.findall(text or "")))


def message_mentions_order_id(text: str) -> bool:
    return bool(_ORDER_UUID.search(text or ""))


async def enrich_payment_context_for_message(
    db: AsyncSession,
    user_id: UUID,
    message: str,
    pack: dict[str, Any],
) -> None:
    """Attach explicit order rows when the customer pastes an order id."""
    ids = extract_order_uuids(message)
    if not ids:
        return

    payments = pack.get("payments")
    if not isinstance(payments, dict):
        payments = {"available": True}
        pack["payments"] = payments
    payments["available"] = True

    requested: list[dict[str, Any]] = []
    for raw in ids[:3]:
        try:
            order_id = UUID(raw)
        except ValueError:
            continue
        order = await get_user_order(db, user_id=user_id, order_id=order_id)
        if order is not None:
            requested.append(order_row_from_mf_order(order))
        else:
            requested.append({"order_id": raw.lower(), "found": False})

    if requested:
        payments["requested_orders"] = requested


async def reply_for_pasted_order_ids(
    db: AsyncSession,
    user_id: UUID,
    message: str,
) -> str | None:
    """Look up orders by primary key (any age). Used when the customer pastes an order id."""
    ids = extract_order_uuids(message)
    if not ids:
        return None

    lines: list[str] = []
    for raw in ids[:3]:
        try:
            order_id = UUID(raw)
        except ValueError:
            continue
        order = await get_user_order(db, user_id=user_id, order_id=order_id)
        if order is not None:
            lines.append(describe_order_for_customer(order_row_from_mf_order(order)))
        else:
            lines.append(describe_order_for_customer({"order_id": raw.lower(), "found": False}))

    if not lines:
        return None
    return " ".join(lines)
