"""One-off repair: reopen CANCELLED + payment_abandoned orders when Cybrilla payment succeeded."""

from __future__ import annotations

import argparse
import asyncio
import logging
import uuid

from sqlalchemy import select

from app.application.mf.mf_lumpsum_reconciliation_service import reconcile_order_payment
from app.core.database import AsyncSessionLocal
from app.core.logging_config import configure_logging
from app.infrastructure.persistence.mf_transaction_models import MfOrder, MfOrderStatus

logger = logging.getLogger(__name__)


async def repair_orders(order_ids: list[uuid.UUID], *, all_abandoned: bool) -> list[dict]:
    results: list[dict] = []
    async with AsyncSessionLocal() as session:
        if all_abandoned:
            rows = list(
                (
                    await session.execute(
                        select(MfOrder).where(
                            MfOrder.status == MfOrderStatus.cancelled,
                            MfOrder.failure_code == "payment_abandoned",
                            MfOrder.fp_purchase_id.is_not(None),
                        )
                    )
                ).scalars()
            )
        else:
            rows = []
            for order_id in order_ids:
                order = await session.get(MfOrder, order_id)
                if order:
                    rows.append(order)

        for order in rows:
            before = {
                "order_id": str(order.id),
                "status": order.status.value,
                "fp_state": order.fp_state,
                "failure_code": order.failure_code,
            }
            reconcile = await reconcile_order_payment(session, order)
            after = {
                "status": order.status.value,
                "fp_state": order.fp_state,
                "failure_code": order.failure_code,
            }
            results.append({**before, **reconcile, "after": after})
            logger.info(
                "repair order=%s before=%s outcome=%s repaired=%s after=%s",
                order.id,
                before,
                reconcile.get("outcome"),
                reconcile.get("repaired"),
                after,
            )

        await session.commit()
    return results


async def main() -> int:
    parser = argparse.ArgumentParser(description="Repair abandoned-but-paid MF lumpsum orders.")
    parser.add_argument(
        "order_ids",
        nargs="*",
        help="Order UUIDs to repair. Omit with --all-abandoned to scan all matching orders.",
    )
    parser.add_argument(
        "--all-abandoned",
        action="store_true",
        help="Repair every CANCELLED order with failure_code=payment_abandoned and fp_purchase_id set.",
    )
    args = parser.parse_args()

    order_ids = [uuid.UUID(value) for value in args.order_ids]
    if not order_ids and not args.all_abandoned:
        parser.error("Provide order IDs or pass --all-abandoned")

    results = await repair_orders(order_ids, all_abandoned=args.all_abandoned)
    for row in results:
        print(row)
    print(f"processed={len(results)}")
    return 0


if __name__ == "__main__":
    configure_logging()
    raise SystemExit(asyncio.run(main()))
