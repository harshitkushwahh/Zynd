from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.mf_calculator_service import (
    cached_compute_calculator,
    compute_lumpsum_calculator,
    compute_return_calculator,
    compute_sip_calculator,
    compute_swp_calculator,
)


async def cached_compute_return_calculator(
    session: AsyncSession,
    *,
    product_id: uuid.UUID,
    amount_inr: float,
    mode: str = "lumpsum",
    horizons: list[str] | None = None,
    duration_months: int = 12,
    sip_day: int = 5,
) -> dict[str, Any] | None:
    horizon_key = ",".join(horizons or ["default"])
    return await cached_compute_calculator(
        session,
        kind="return",
        product_id=product_id,
        cache_parts=[str(amount_inr), mode, horizon_key, str(duration_months), str(sip_day)],
        compute_fn=lambda: compute_return_calculator(
            session,
            product_id=product_id,
            amount_inr=amount_inr,
            mode=mode,  # type: ignore[arg-type]
            horizons=horizons,
            duration_months=duration_months,
            sip_day=sip_day,
        ),
    )


async def cached_compute_lumpsum_calculator(
    session: AsyncSession,
    *,
    product_id: uuid.UUID,
    amount_inr: float,
    horizons: list[str] | None = None,
) -> dict[str, Any] | None:
    horizon_key = ",".join(horizons or ["default"])
    return await cached_compute_calculator(
        session,
        kind="lumpsum",
        product_id=product_id,
        cache_parts=[str(amount_inr), horizon_key],
        compute_fn=lambda: compute_lumpsum_calculator(
            session,
            product_id=product_id,
            amount_inr=amount_inr,
            horizons=horizons,
        ),
    )


async def cached_compute_sip_calculator(
    session: AsyncSession,
    *,
    product_id: uuid.UUID,
    monthly_amount_inr: float,
    duration_months: int,
    sip_day: int = 5,
) -> dict[str, Any] | None:
    return await cached_compute_calculator(
        session,
        kind="sip",
        product_id=product_id,
        cache_parts=[str(monthly_amount_inr), str(duration_months), str(sip_day)],
        compute_fn=lambda: compute_sip_calculator(
            session,
            product_id=product_id,
            monthly_amount_inr=monthly_amount_inr,
            duration_months=duration_months,
            sip_day=sip_day,
        ),
    )


async def cached_compute_swp_calculator(
    session: AsyncSession,
    *,
    product_id: uuid.UUID,
    corpus_inr: float,
    monthly_withdrawal_inr: float,
    duration_months: int,
    withdrawal_day: int = 5,
) -> dict[str, Any] | None:
    return await cached_compute_calculator(
        session,
        kind="swp",
        product_id=product_id,
        cache_parts=[str(corpus_inr), str(monthly_withdrawal_inr), str(duration_months), str(withdrawal_day)],
        compute_fn=lambda: compute_swp_calculator(
            session,
            product_id=product_id,
            corpus_inr=corpus_inr,
            monthly_withdrawal_inr=monthly_withdrawal_inr,
            duration_months=duration_months,
            withdrawal_day=withdrawal_day,
        ),
    )
