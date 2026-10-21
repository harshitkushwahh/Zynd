from __future__ import annotations

from pydantic import BaseModel


class InvestorMitraTxnRecommendationItemResponse(BaseModel):
    id: str
    product_id: str
    amount_inr: float
    number_of_installments: int | None = None
    installment_day: int | None = None
    fund_name: str
    product_code: str | None = None
    fund_slug: str | None = None
    display_order: int


class InvestorMitraTxnRecommendationResponse(BaseModel):
    id: str
    token: str
    status: str
    investment_type: str
    amount_inr: float
    item_count: int
    items: list[InvestorMitraTxnRecommendationItemResponse]
    number_of_installments: int | None = None
    installment_day: int | None = None
    sip_frequency: str
    payment_method: str
    fund_name: str
    product_code: str | None = None
    fund_slug: str | None = None
    product_id: str
    client_user_id: str
    mitra_user_id: str
    expires_at: str
    opened_at: str | None = None
    invested_at: str | None = None
    created_at: str
    cart_path: str
    fund_path: str


class ApplyMitraTxnRecommendationResponse(BaseModel):
    applied: bool
    status: str
    redirect_path: str
    recommendation: InvestorMitraTxnRecommendationResponse
