from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class DistributorSchemeSearchItemResponse(BaseModel):
    product_id: str
    slug: str | None = None
    product_code: str
    name: str
    amc_name: str
    amc_slug: str | None = None
    amc_logo_url: str | None = None
    category_slug: str | None = None
    isin: str
    min_lumpsum_amount_inr: float | None = None
    min_sip_amount_inr: float | None = None
    sip_allowed: bool = True


class DistributorSchemeSearchResponse(BaseModel):
    query: str
    items: list[DistributorSchemeSearchItemResponse]
    page: int
    page_size: int
    total: int
    has_more: bool


class CreateMitraTxnRecommendationItemRequest(BaseModel):
    product_id: UUID
    amount_inr: Decimal = Field(gt=0)
    number_of_installments: int | None = Field(default=None, ge=1, le=999)
    installment_day: int | None = Field(default=None, ge=1, le=28)


class CreateMitraTxnRecommendationRequest(BaseModel):
    investment_type: str = Field(pattern="^(one_time|sip)$")
    payment_method: str = Field(pattern="^(upi|netbanking)$")
    number_of_installments: int | None = Field(default=None, ge=1, le=999)
    installment_day: int | None = Field(default=None, ge=1, le=28)
    sip_frequency: str = Field(default="monthly", max_length=32)
    items: list[CreateMitraTxnRecommendationItemRequest] = Field(min_length=1, max_length=10)


class MitraTxnRecommendationItemResponse(BaseModel):
    id: str
    product_id: str
    amount_inr: float
    number_of_installments: int | None = None
    installment_day: int | None = None
    fund_name: str
    product_code: str | None = None
    fund_slug: str | None = None
    display_order: int
    amc_name: str | None = None
    amc_slug: str | None = None
    amc_logo_url: str | None = None


class MitraTxnRecommendationResponse(BaseModel):
    id: str
    token: str
    status: str
    investment_type: str
    amount_inr: float
    item_count: int
    items: list[MitraTxnRecommendationItemResponse]
    number_of_installments: int | None = None
    installment_day: int | None = None
    sip_frequency: str
    payment_method: str
    fund_name: str
    product_code: str | None = None
    fund_slug: str | None = None
    product_id: str
    amc_name: str | None = None
    amc_slug: str | None = None
    amc_logo_url: str | None = None
    client_user_id: str
    mitra_user_id: str
    client_code: str | None = None
    client_email_masked: str | None = None
    client_display_name: str | None = None
    client_profile_image_url: str | None = None
    expires_at: str
    opened_at: str | None = None
    invested_at: str | None = None
    created_at: str
    link: str | None = None


class MitraTxnRecommendationListResponse(BaseModel):
    items: list[MitraTxnRecommendationResponse]
