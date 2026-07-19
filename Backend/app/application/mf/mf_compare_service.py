from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.invest_cached_read_service import cached_get_invest_fund_detail
from app.application.mf.invest_home_service import get_invest_config
from app.application.mf.mf_calculator_errors import MfCalculatorError
from app.core.config import get_settings

MAX_COMPARE_FUNDS = 3


async def compare_invest_funds(
    session: AsyncSession,
    *,
    product_ids: list[uuid.UUID],
) -> dict:
    settings = get_settings()
    if not settings.zynd_mf_compare_enabled:
        raise MfCalculatorError(
            code="compare_disabled",
            message="Fund compare is not enabled",
            status_code=503,
        )

    if not product_ids:
        raise MfCalculatorError(code="invalid_compare_count", message="Select at least one fund to compare")

    unique_ids = list(dict.fromkeys(product_ids))
    if len(unique_ids) > MAX_COMPARE_FUNDS:
        raise MfCalculatorError(
            code="invalid_compare_count",
            message=f"You can compare up to {MAX_COMPARE_FUNDS} funds at a time",
        )

    funds: list[dict] = []
    for product_id in unique_ids:
        detail = await cached_get_invest_fund_detail(session, product_id)
        if not detail:
            raise MfCalculatorError(
                code="fund_not_found",
                message=f"Fund not found in catalog: {product_id}",
                status_code=404,
            )
        funds.append(detail)

    config = await get_invest_config(session)
    return {
        "funds": funds,
        "disclaimer": config["disclaimer"],
    }
