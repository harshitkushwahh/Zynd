from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class InvestAmountConstraintResponse(BaseModel):
    min_inr: Optional[float] = None
    max_inr: Optional[float] = None
    multiples_inr: Optional[float] = None


class InvestRedemptionConstraintResponse(InvestAmountConstraintResponse):
    min_units: Optional[float] = None
    unit_multiples: Optional[float] = None


class InvestSwitchConstraintResponse(BaseModel):
    min_in_inr: Optional[float] = None
    min_out_inr: Optional[float] = None
    min_out_units: Optional[float] = None


class InvestSipOptionResponse(BaseModel):
    frequency: str
    min_inr: Optional[float] = None
    max_inr: Optional[float] = None
    multiples_inr: Optional[float] = None
    min_installments: Optional[int] = None


class InvestInvestmentDetailsResponse(BaseModel):
    lumpsum: Optional[InvestAmountConstraintResponse] = None
    additional: Optional[InvestAmountConstraintResponse] = None
    redemption: Optional[InvestRedemptionConstraintResponse] = None
    switch: Optional[InvestSwitchConstraintResponse] = None
    sip_options: list[InvestSipOptionResponse] = Field(default_factory=list)
    transaction_types: list[str] = Field(default_factory=list)


class InvestReturnsResponse(BaseModel):
    return_1d: Optional[float] = None
    return_1w: Optional[float] = None
    return_1m: Optional[float] = None
    return_3m: Optional[float] = None
    return_6m: Optional[float] = None
    return_1y: Optional[float] = None
    return_3y: Optional[float] = None
    return_5y: Optional[float] = None


class InvestCategoryResponse(BaseModel):
    id: int
    slug: str
    name: str
    fund_count: int


class InvestCategoryListResponse(BaseModel):
    categories: list[InvestCategoryResponse]


class InvestFundDisplayResponse(BaseModel):
    tagline: Optional[str] = None
    hero_badge: Optional[str] = None
    risk_label: Optional[str] = None


class InvestFundContentResponse(InvestFundDisplayResponse):
    benchmark_name: Optional[str] = None
    fund_manager_name: Optional[str] = None
    disclaimer_text: Optional[str] = None
    seo_slug: Optional[str] = None
    seo_meta_description: Optional[str] = None
    amc_marketing_name: Optional[str] = None
    amc_description: Optional[str] = None
    amc_website_url: Optional[str] = None


class InvestFundSummaryResponse(BaseModel):
    product_id: str
    product_code: str
    name: str
    provider: Optional[str] = None
    amc_name: str
    amc_slug: str
    amc_logo_url: Optional[str] = None
    category_slug: Optional[str] = None
    isin: str
    rank_position: Optional[int] = None
    sebi_category: Optional[str] = None
    min_sip_amount_inr: Optional[float] = None
    min_lumpsum_amount_inr: Optional[float] = None
    is_featured: Optional[bool] = None
    display_order: Optional[int] = None
    health_badges: list[str] = Field(default_factory=list)
    display: Optional[InvestFundDisplayResponse] = None
    returns: InvestReturnsResponse


class InvestFundListResponse(BaseModel):
    items: list[InvestFundSummaryResponse]
    page: int
    page_size: int
    total: int
    has_more: bool


class InvestFundSearchResponse(InvestFundListResponse):
    query: str


class InvestHomeResponse(BaseModel):
    categories: list[InvestCategoryResponse]
    collections: list[InvestCategoryResponse] = Field(default_factory=list)
    popular_funds: list[InvestFundSummaryResponse] = Field(default_factory=list)
    featured_funds: list[InvestFundSummaryResponse]
    total_active_funds: int


class InvestFundDetailResponse(InvestFundSummaryResponse):
    category_name: Optional[str] = None
    plan_type: Optional[str] = None
    option_type: Optional[str] = None
    latest_nav: Optional[float] = None
    latest_nav_date: Optional[str] = None
    aum_inr: Optional[float] = None
    aum_as_of: Optional[str] = None
    ter_percent: Optional[float] = None
    ter_as_of: Optional[str] = None
    disclaimer: Optional[str] = None
    distributor_arn: Optional[str] = None
    distributor_euin: Optional[str] = None
    content: Optional[InvestFundContentResponse] = None
    compliance: Optional[dict] = None
    fund_house: Optional[dict] = None
    amc_aum_rank: Optional[dict] = None
    investment_details: Optional[InvestInvestmentDetailsResponse] = None


class InvestReturnCalculatorScenarioResponse(BaseModel):
    horizon: str
    invested_inr: float
    value_inr: float
    return_pct: Optional[float] = None


class InvestReturnCalculatorResponse(BaseModel):
    product_id: str
    amount_inr: float
    mode: str
    as_of_date: Optional[str] = None
    scenarios: list[InvestReturnCalculatorScenarioResponse] = Field(default_factory=list)


class InvestNavPointResponse(BaseModel):
    date: str
    nav: Optional[float] = None


class InvestFundNavHistoryResponse(BaseModel):
    product_id: str
    from_date: str
    to_date: str
    count: int
    points: list[InvestNavPointResponse]


class InvestConfigResponse(BaseModel):
    distributor_arn: Optional[str] = None
    distributor_euin: Optional[str] = None
    disclaimer: str
    orders_enabled: bool
    cas_enabled: bool


class CreateMfOrderRequest(BaseModel):
    product_id: UUID
    amount_inr: float = Field(gt=0)
    idempotency_key: str = Field(min_length=8, max_length=128)


class MfOrderResponse(BaseModel):
    order_id: str
    product_id: str
    product_name: Optional[str] = None
    order_type: str
    amount_inr: float
    status: str
    fp_purchase_id: Optional[str] = None
    fp_state: Optional[str] = None
    failure_code: Optional[str] = None
    failure_reason: Optional[str] = None
    created_at: Optional[str] = None
    submitted_at: Optional[str] = None
    settled_at: Optional[str] = None


class MfOrderListResponse(BaseModel):
    orders: list[MfOrderResponse]


class MfExternalHoldingResponse(BaseModel):
    isin: str
    scheme_name: str
    matched_scheme_name: Optional[str] = None
    folio_number: str
    units: float
    nav_value: Optional[float] = None
    market_value_inr: Optional[float] = None
    as_of_date: Optional[str] = None
    amc_name: Optional[str] = None
    source: str


class MfHoldingsResponse(BaseModel):
    external_holdings: list[MfExternalHoldingResponse]


class MfCasImportResponse(BaseModel):
    import_id: str
    status: str
    external_request_id: Optional[str] = None
    holdings_count: int
    failure_reason: Optional[str] = None
    requested_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class MfCasImportListResponse(BaseModel):
    imports: list[MfCasImportResponse]
