from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class RecommendationConfigResponse(BaseModel):
    published_version: int
    published_at: str | None = None
    published_by: str | None = None


class RecommendationBasketResponse(BaseModel):
    id: str
    tier: str
    slug: str
    name: str
    display_name: str | None = None
    description: str | None = None
    objective_summary: str | None = None
    portfolio_display_name: str | None = None
    target_allocation: dict[str, Any] | None = None
    is_active: bool
    sort_order: int
    fund_count: int = 0
    investable_fund_count: int = 0
    created_at: str | None = None
    updated_at: str | None = None


class RecommendationBasketFundResponse(BaseModel):
    id: str
    product_id: str
    sort_order: int
    allocation_weight_pct: float | None = None
    portfolio_role: str | None = None
    is_anchor: bool
    is_alternative: bool
    alternative_for_product_id: str | None = None
    is_active: bool
    fund_id: int | None = None
    scheme_name: str | None = None
    amc_name: str | None = None
    amc_slug: str | None = None
    amc_logo_url: str | None = None
    lifecycle_status: str | None = None
    fund_active: bool | None = None
    amc_empanelled: bool | None = None


class RecommendationBasketDetailResponse(RecommendationBasketResponse):
    funds: list[RecommendationBasketFundResponse] = Field(default_factory=list)


class RecommendationBasketListResponse(BaseModel):
    items: list[RecommendationBasketResponse]


class CreateRecommendationBasketRequest(BaseModel):
    tier: Literal["secure", "conservative", "moderate", "growth", "aggressive"]
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    objective_summary: str | None = None
    portfolio_display_name: str | None = None
    target_allocation: dict[str, Any] | None = None
    sort_order: int = 0

    @model_validator(mode="after")
    def validate_display_name(self) -> CreateRecommendationBasketRequest:
        display = (self.portfolio_display_name or self.name or "").strip()
        if not display:
            raise ValueError("portfolio_display_name is required.")
        return self


class UpdateRecommendationBasketRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    objective_summary: str | None = None
    portfolio_display_name: str | None = None
    target_allocation: dict[str, Any] | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class ReplaceRecommendationBasketFundsRequest(BaseModel):
    funds: list[dict[str, Any]]


class AddRecommendationBasketFundRequest(BaseModel):
    product_id: str
    sort_order: int | None = None


class RecommendationPreviewResponse(BaseModel):
    eligible: bool
    block_reason: str | None = None
    tier: str | None = None
    basket_name: str | None = None
    config_version: int
    funds: list[dict[str, Any]]
    allocation: list[dict[str, Any]]


class RecommendationPublishIssueResponse(BaseModel):
    code: str
    message: str
    tier: str | None = None
    basket_id: str | None = None
    basket_name: str | None = None
    investable_fund_count: int | None = None
    required_fund_count: int | None = None


class RecommendationPublishWarningResponse(BaseModel):
    code: str
    message: str
    tier: str | None = None


class RecommendationPublishTierSummaryResponse(BaseModel):
    tier: str
    active_basket_count: int
    ready_basket_count: int
    short_baskets: list[dict[str, Any]] = Field(default_factory=list)


class RecommendationPublishReadinessResponse(BaseModel):
    can_publish: bool
    published_version: int
    required_fund_count: int
    tiers: list[RecommendationPublishTierSummaryResponse]
    issues: list[RecommendationPublishIssueResponse]
    warnings: list[RecommendationPublishWarningResponse]


class RecommendationMetricsResponse(BaseModel):
    resolve_total: dict[str, int]
    block_reason_total: dict[str, int]
    snapshot_hits: int
    snapshot_misses: int
    snapshot_hit_rate: float | None = None
    degraded_total: int
    compute_duration_ms_avg: float | None = None
    compute_count: int


class RecommendationAuditLogResponse(BaseModel):
    id: str
    event_type: str
    user_id: str | None = None
    ip_address: str | None = None
    metadata: dict[str, Any] | None = None
    created_at: str


class RecommendationAuditLogListResponse(BaseModel):
    items: list[RecommendationAuditLogResponse]
