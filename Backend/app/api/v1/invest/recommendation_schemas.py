from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


BlockReason = Literal[
    "kyc_required",
    "risk_profile_required",
    "no_baskets",
    "insufficient_funds",
]


class FundsForYouFundResponse(BaseModel):
    product_id: str
    fund_id: int
    scheme_name: str
    amc_name: str
    amc_logo_url: str | None = None
    amc_slug: str | None = None
    min_lumpsum_amount_inr: float | None = None
    in_cart: bool = False
    in_portfolio: bool = False


class FundsForYouPortfolioStoryResponse(BaseModel):
    display_name: str | None = None
    mix_summary: str | None = None
    why_this_mix: str | None = None
    basket_objective: str | None = None


class FundsForYouAllocationSliceResponse(BaseModel):
    id: str
    label: str
    value_pct: float


class FundsForYouResponse(BaseModel):
    eligible: bool
    block_reason: BlockReason | None = None
    tier: str | None = None
    basket_name: str | None = None
    config_version: int
    portfolio_story: FundsForYouPortfolioStoryResponse | None = None
    funds: list[FundsForYouFundResponse]
    allocation: list[FundsForYouAllocationSliceResponse]
