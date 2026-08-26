"""Audit MF order status against live Cybrilla purchase + payment data."""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import uuid

from sqlalchemy import select

from app.application.mf.mf_lumpsum_reconciliation_service import (
    apply_order_fp_truth,
    fetch_order_fp_truth,
)
from app.core.database import AsyncSessionLocal
from app.core.logging_config import configure_logging
from app.infrastructure.persistence.mf_transaction_models import MfCheckout, MfOrder

logger = logging.getLogger(__name__)

DEFAULT_ORDER_IDS = [
    "f3d2a4c7-6968-47fd-ab40-b1f40333a89a",  # UTI Silver — paid Aug 24
    "a41e5328-c2d1-4923-9866-6ac34331c09e",  # Kotak Silver — paid Aug 24
    "738ebaa6-2870-4189-a9e5-148c41550a08",  # ABSL Gold — unpaid Aug 22
    "cab564ae-836d-4383-89da-aa1e66733ed4",
    "fc37c18b-a809-4c8e-ab24-6ed1b8565cf3",
    "d0be3e27-b60a-4d60-a2f9-fa0d53a4e41a",  # HDFC Gold — unpaid Aug 22
    "799b447a-a536-42bc-9ef0-45f5f89d881c",
]


async def audit_orders(order_ids: list[uuid.UUID], *, apply: bool) -> list[dict]:
    results: list[dict] = []
    async with AsyncSessionLocal() as session:
        for order_id in order_ids:
            order = await session.get(MfOrder, order_id)
            if not order:
                results.append({"order_id": str(order_id), "error": "not_found"})
                continue

            checkout = await session.get(MfCheckout, order.checkout_id) if order.checkout_id else None
            truth = await fetch_order_fp_truth(order, checkout=checkout)
            row = {
                "order_id": str(order.id),
                "fp_purchase_id": order.fp_purchase_id,
                "fp_purchase_old_id": order.fp_purchase_old_id,
                "before": {
                    "status": order.status.value,
                    "fp_state": order.fp_state,
                    "failure_code": order.failure_code,
                },
                **truth,
            }

            if apply:
                applied = await apply_order_fp_truth(session, order, checkout=checkout, truth=truth)
                row["changed"] = applied["changed"]
                row["after"] = applied["after"]
            results.append(row)

        if apply:
            await session.commit()

    return results


async def main() -> int:
    parser = argparse.ArgumentParser(description="Audit MF orders against live Cybrilla truth.")
    parser.add_argument(
        "order_ids",
        nargs="*",
        help="Order UUIDs to audit. Defaults to the known Harshit test set.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write corrected statuses back to the database.",
    )
    args = parser.parse_args()

    raw_ids = args.order_ids or DEFAULT_ORDER_IDS
    order_ids = [uuid.UUID(value) for value in raw_ids]
    results = await audit_orders(order_ids, apply=args.apply)

    print(json.dumps(results, indent=2, default=str))
    changed = sum(1 for row in results if row.get("changed"))
    print(f"audited={len(results)} changed={changed} apply={args.apply}")
    return 0


if __name__ == "__main__":
    configure_logging()
    raise SystemExit(asyncio.run(main()))
