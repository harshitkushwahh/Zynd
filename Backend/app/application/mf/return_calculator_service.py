from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.invest_catalog_cache import build_invest_cache_key, get_cached_json, set_cached_json
from app.application.mf.mf_tax_templates import CALCULATOR_HORIZONS
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import FundReturnCalculatorSnapshot, MutualFund, Product


async def compute_return_calculator(
    session: AsyncSession,
    *,
    product_id: uuid.UUID,
    amount_inr: float,
    mode: str = "lumpsum",
    horizons: list[str] | None = None,
) -> dict | None:
    settings = get_settings()
    amount = Decimal(str(amount_inr))
    if amount <= 0:
        return None

    row = (
        await session.execute(
            select(MutualFund, FundReturnCalculatorSnapshot)
            .join(Product, Product.id == MutualFund.product_id)
            .outerjoin(
                FundReturnCalculatorSnapshot,
                FundReturnCalculatorSnapshot.fund_id == MutualFund.id,
            )
            .where(Product.id == product_id)
        )
    ).first()
    if not row:
        return None
    fund, snapshot = row
    if not snapshot or not snapshot.horizons:
        return {
            "product_id": str(product_id),
            "amount_inr": float(amount),
            "mode": mode,
            "as_of_date": None,
            "scenarios": [],
        }

    requested = horizons or list(CALCULATOR_HORIZONS.keys())
    scenarios = []
    for horizon in requested:
        data = snapshot.horizons.get(horizon)
        if not data:
            continue
        multiplier = Decimal(str(data["multiplier"]))
        value_inr = amount * multiplier
        scenarios.append(
            {
                "horizon": horizon,
                "invested_inr": float(amount),
                "value_inr": float(value_inr.quantize(Decimal("0.01"))),
                "return_pct": data.get("return_pct"),
            }
        )

    return {
        "product_id": str(product_id),
        "amount_inr": float(amount),
        "mode": mode,
        "as_of_date": snapshot.as_of_date.isoformat(),
        "scenarios": scenarios,
    }


async def cached_compute_return_calculator(
    session: AsyncSession,
    *,
    product_id: uuid.UUID,
    amount_inr: float,
    mode: str = "lumpsum",
    horizons: list[str] | None = None,
) -> dict | None:
    settings = get_settings()
    horizon_key = ",".join(horizons or list(CALCULATOR_HORIZONS.keys()))
    cache_key = await build_invest_cache_key(
        "calc",
        str(product_id),
        str(amount_inr),
        mode,
        horizon_key,
    )
    cached = await get_cached_json(cache_key, settings=settings)
    if cached is not None:
        return cached

    payload = await compute_return_calculator(
        session,
        product_id=product_id,
        amount_inr=amount_inr,
        mode=mode,
        horizons=horizons,
    )
    if payload is None:
        return None
    await set_cached_json(
        cache_key,
        payload,
        ttl_seconds=settings.zynd_mf_invest_cache_calc_ttl_seconds,
        settings=settings,
    )
    return payload
