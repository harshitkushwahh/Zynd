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
    slug: str
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
    data_quality: Optional[str] = None
    disclaimer: Optional[str] = None
    scenarios: list[InvestReturnCalculatorScenarioResponse] = Field(default_factory=list)


class MfCalculatorPointResponse(BaseModel):
    date: str
    invested_inr: Optional[float] = None
    value_inr: float
    units: Optional[float] = None


class MfLumpsumCalculatorResponse(BaseModel):
    product_id: str
    mode: Literal["lumpsum"] = "lumpsum"
    amount_inr: float
    as_of_date: Optional[str] = None
    data_quality: str
    disclaimer: str
    scenarios: list[InvestReturnCalculatorScenarioResponse] = Field(default_factory=list)
    points: list[MfCalculatorPointResponse] = Field(default_factory=list)


class MfSipCalculatorResponse(BaseModel):
    product_id: str
    mode: Literal["sip"] = "sip"
    monthly_amount_inr: float
    duration_months: int
    sip_day: int
    total_invested_inr: float
    projected_value_inr: float
    return_pct: Optional[float] = None
    xirr_pct: Optional[float] = None
    installments: int
    as_of_date: Optional[str] = None
    data_quality: str
    disclaimer: str
    points: list[MfCalculatorPointResponse] = Field(default_factory=list)


class MfSwpCalculatorResponse(BaseModel):
    product_id: str
    mode: Literal["swp"] = "swp"
    corpus_inr: float
    monthly_withdrawal_inr: float
    duration_months: int
    withdrawal_day: int
    total_withdrawn_inr: float
    remaining_value_inr: float
    months_sustained: int
    depleted: bool
    as_of_date: Optional[str] = None
    data_quality: str
    disclaimer: str
    points: list[MfCalculatorPointResponse] = Field(default_factory=list)


class MfCompareRequest(BaseModel):
    product_ids: list[UUID] = Field(..., min_length=1, max_length=3)


class MfCompareResponse(BaseModel):
    funds: list[InvestFundDetailResponse]
    disclaimer: str


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
    sip_enabled: bool = True
    cas_enabled: bool


class CreateMfOrderRequest(BaseModel):
    product_id: UUID
    amount_inr: float = Field(gt=0)
    idempotency_key: str = Field(min_length=8, max_length=128)
    bank_account_id: Optional[UUID] = None
    family_goal_id: Optional[UUID] = None
    payment_method: Literal["upi", "netbanking"] = "upi"


class MfOrderResponse(BaseModel):
    order_id: str
    checkout_id: Optional[str] = None
    product_id: str
    product_name: Optional[str] = None
    amc_name: Optional[str] = None
    amc_logo_url: Optional[str] = None
    order_type: str
    amount_inr: float
    payment_method: Optional[str] = None
    status: str
    fp_purchase_id: Optional[str] = None
    fp_purchase_old_id: Optional[int] = None
    fp_state: Optional[str] = None
    payment_url: Optional[str] = None
    next_action: Optional[str] = None
    failure_code: Optional[str] = None
    failure_reason: Optional[str] = None
    created_at: Optional[str] = None
    submitted_at: Optional[str] = None
    settled_at: Optional[str] = None
    payout_bank_account_id: Optional[str] = None
    payout_bank_account_masked: Optional[str] = None
    payout_bank_ifsc_code: Optional[str] = None
    payout_bank_name: Optional[str] = None


class MfOrderListResponse(BaseModel):
    orders: list[MfOrderResponse]


class MfOrderEventResponse(BaseModel):
    from_status: Optional[str] = None
    to_status: str
    source: str
    payload: Optional[dict] = None
    created_at: Optional[str] = None


class MfOrderJourneyResponse(BaseModel):
    order: MfOrderResponse
    events: list[MfOrderEventResponse]


class MfCartItemResponse(BaseModel):
    product_id: str
    product_name: Optional[str] = None
    fund_id: int
    amc_name: Optional[str] = None
    amc_logo_url: Optional[str] = None
    amount_inr: float
    investment_type: Literal["lumpsum", "sip"] = "lumpsum"
    installment_day: Optional[int] = None
    frequency: Optional[str] = None
    number_of_installments: Optional[int] = None
    fp_scheme_id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class MfCartResponse(BaseModel):
    items: list[MfCartItemResponse]
    lumpsum_items: list[MfCartItemResponse] = Field(default_factory=list)
    sip_items: list[MfCartItemResponse] = Field(default_factory=list)
    item_count: int
    lumpsum_item_count: int = 0
    sip_item_count: int = 0
    total_amount_inr: float
    lumpsum_total_amount_inr: float = 0
    sip_total_amount_inr: float = 0
    max_items: int


class UpsertMfCartItemRequest(BaseModel):
    product_id: UUID
    amount_inr: float = Field(gt=0)
    investment_type: Literal["lumpsum", "sip"] = "lumpsum"
    installment_day: Optional[int] = Field(default=None, ge=1, le=28)
    frequency: Literal["monthly", "daily"] = "monthly"
    number_of_installments: Optional[int] = Field(default=None, ge=1, le=60)


class BulkUpsertMfCartItemLine(BaseModel):
    product_id: UUID
    amount_inr: float = Field(gt=0)


class BulkUpsertMfCartItemsRequest(BaseModel):
    items: list[BulkUpsertMfCartItemLine] = Field(min_length=1, max_length=50)


class CheckoutMfCartRequest(BaseModel):
    idempotency_key: str = Field(min_length=8, max_length=128)
    bank_account_id: Optional[UUID] = None
    family_goal_id: Optional[UUID] = None
    payment_method: Literal["upi", "netbanking"] = "upi"
    mandate_type: Literal["upi", "nach"] = "upi"


class MfCheckoutOrderLineResponse(BaseModel):
    order_id: str
    product_id: str
    product_name: Optional[str] = None
    amount_inr: float
    status: str
    line_index: int
    fp_state: Optional[str] = None


class MfCheckoutResponse(BaseModel):
    checkout_id: str
    checkout_type: str
    status: str
    total_amount_inr: float
    payment_method: Optional[str] = None
    payment_url: Optional[str] = None
    next_action: Optional[str] = None
    fp_payment_id: Optional[int] = None
    failure_code: Optional[str] = None
    failure_reason: Optional[str] = None
    created_at: Optional[str] = None
    payout_bank_account_id: Optional[str] = None
    payout_bank_account_masked: Optional[str] = None
    payout_bank_ifsc_code: Optional[str] = None
    payout_bank_name: Optional[str] = None
    orders: list[MfCheckoutOrderLineResponse] = Field(default_factory=list)


class CreateMfMandateRequest(BaseModel):
    idempotency_key: str = Field(min_length=8, max_length=128)
    installment_amount_inr: Optional[float] = Field(default=None, gt=0)
    bank_account_id: Optional[UUID] = None
    mandate_type: Literal["upi", "nach"] = "upi"


class MfMandateResponse(BaseModel):
    mandate_id: str
    status: str
    fp_mandate_id: Optional[int] = None
    bank_account_old_id: int
    mandate_type: str
    mandate_limit: int
    fp_mandate_status: Optional[str] = None
    auth_url: Optional[str] = None
    next_action: Optional[str] = None
    failure_code: Optional[str] = None
    failure_reason: Optional[str] = None
    created_at: Optional[str] = None
    approved_at: Optional[str] = None


class MfMandateListResponse(BaseModel):
    mandates: list[MfMandateResponse]


class CreateMfSipPlanRequest(BaseModel):
    product_id: UUID
    amount_inr: float = Field(gt=0)
    frequency: Literal["monthly", "daily"] = "monthly"
    installment_day: Optional[int] = Field(default=None, ge=1, le=28)
    number_of_installments: int = Field(ge=1, le=60)
    mandate_id: Optional[UUID] = None
    idempotency_key: str = Field(min_length=8, max_length=128)
    bank_account_id: Optional[UUID] = None
    family_goal_id: Optional[UUID] = None
    mandate_type: Literal["upi", "nach"] = "upi"


class MfSipPlanResponse(BaseModel):
    plan_id: str
    product_id: str
    product_name: Optional[str] = None
    amc_name: Optional[str] = None
    amc_logo_url: Optional[str] = None
    isin: Optional[str] = None
    amount_inr: float
    frequency: str
    installment_day: Optional[int] = None
    number_of_installments: int
    status: str
    fp_plan_id: Optional[str] = None
    fp_state: Optional[str] = None
    next_installment_date: Optional[str] = None
    mandate: Optional[MfMandateResponse] = None
    mandate_auth_url: Optional[str] = None
    next_action: Optional[str] = None
    failure_code: Optional[str] = None
    failure_reason: Optional[str] = None
    created_at: Optional[str] = None
    activated_at: Optional[str] = None


class MfSipPlanListResponse(BaseModel):
    plans: list[MfSipPlanResponse]


class MfSipCartCheckoutResponse(BaseModel):
    plans: list[MfSipPlanResponse]


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
    amc_logo_url: Optional[str] = None
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


class InvestorBankAccountFailure(BaseModel):
    field: str
    code: Optional[str] = None
    reason: Optional[str] = None


class InvestorBankAccountResponse(BaseModel):
    id: str
    account_number_masked: str
    account_number_last4: str
    ifsc_code: str
    account_type: str
    account_holder_name: str
    pan_account_holder_name: Optional[str] = None
    bank_name: Optional[str] = None
    branch_name: Optional[str] = None
    is_primary: bool
    source: str
    verification_status: str
    sync_status: str
    requires_manual_verification: bool = False
    requires_proof_upload: bool = False
    proof_uploaded: bool = False
    preverify_id: Optional[str] = None
    failure: Optional[InvestorBankAccountFailure] = None
    readiness_verified: bool = False
    external_bank_account_id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class InvestorBankAccountListResponse(BaseModel):
    bank_accounts: list[InvestorBankAccountResponse]


class InvestorBankAccountVerifyRequest(BaseModel):
    account_number: str = Field(min_length=9, max_length=18)
    account_type: str
    ifsc_code: str = Field(min_length=11, max_length=11)


class InvestorBankAccountVerifyResponse(InvestorBankAccountResponse):
    success: bool
    pan_verified: bool = False
    bank_verified: bool = False
    requires_manual_verification: bool = False
    requires_proof_upload: bool = False


class InvestorBankAccountProofUploadResponse(BaseModel):
    file_id: str
    bank_account: InvestorBankAccountResponse


class InvestorBankAccountManualVerifyResponse(InvestorBankAccountResponse):
    success: bool
    bank_verified: bool = False
    readiness_verified: bool = False
    requires_manual_verification: bool = False
    requires_proof_upload: bool = False


class InvestorBankAccountPreverifyStatusResponse(BaseModel):
    status: Optional[str] = None
    bank_verified: bool = False
    code: Optional[str] = None
    reason: Optional[str] = None


class InvestRiskProfileAnswerInput(BaseModel):
    question_id: UUID
    option_id: UUID


class InvestRiskProfileQuestionOptionResponse(BaseModel):
    id: str
    label: str
    score_value: int
    sort_order: int


class InvestRiskProfileQuestionResponse(BaseModel):
    id: str
    category_id: str
    category_slug: Optional[str] = None
    category_name: Optional[str] = None
    prompt: str
    help_text: Optional[str] = None
    sort_order: int
    options: list[InvestRiskProfileQuestionOptionResponse]


class InvestRiskProfileTemplateSummaryResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    is_default: bool
    selection_mode: str
    total_questions: int


class InvestRiskProfileSubmitRequest(BaseModel):
    answers: list[InvestRiskProfileAnswerInput] = Field(min_length=1)
    template_id: Optional[UUID] = None


class InvestRiskProfileAttemptStateResponse(BaseModel):
    completed_count: int
    granted_attempts: int
    attempts_remaining: int
    is_locked: bool
    locked_at: Optional[str] = None
    updated_at: Optional[str] = None


class InvestRiskProfileDraftResponse(BaseModel):
    template_id: Optional[str] = None
    question_ids: list[str] = Field(default_factory=list)
    answers: dict[str, str] = Field(default_factory=dict)
    step_index: int = 0
    updated_at: Optional[str] = None


class InvestRiskProfileSessionResponse(BaseModel):
    attempt_state: InvestRiskProfileAttemptStateResponse
    draft: Optional[InvestRiskProfileDraftResponse] = None


class InvestRiskProfileDraftUpsertRequest(BaseModel):
    template_id: Optional[UUID] = None
    question_ids: list[str] = Field(min_length=1)
    answers: dict[str, str] = Field(default_factory=dict)
    step_index: int = Field(default=0, ge=0)


class InvestRiskProfileAssessmentResponse(BaseModel):
    selection_reason: Optional[str] = None
    preferred_question_count: Optional[int] = None
    template: Optional[InvestRiskProfileTemplateSummaryResponse] = None
    questions: list[InvestRiskProfileQuestionResponse] = Field(default_factory=list)
    total_questions: int = 0


class InvestRiskProfileTierResponse(BaseModel):
    tier: str
    min_score: int
    max_score: int
    display_score: int
    display_score_min: int
    display_score_max: int
    title: str
    message_body: str
    message_summary: str
    message_recommendation: str
    sort_order: int
    updated_at: Optional[str] = None


class InvestRiskProfileTierListResponse(BaseModel):
    items: list[InvestRiskProfileTierResponse] = Field(default_factory=list)


class InvestRiskProfileConfigResponse(BaseModel):
    trends_min_profiles: int
    default_attempts: int
    unlock_bonus_attempts: int


class InvestRiskProfileResultResponse(BaseModel):
    assessment_id: str
    score: int
    display_score: int
    tier: str
    tier_config: InvestRiskProfileTierResponse
    category_scores: dict[str, float]
    attempt_state: InvestRiskProfileAttemptStateResponse


class InvestRiskProfileCurrentResponse(BaseModel):
    user_id: str
    score: int
    display_score: int
    tier: str
    tier_config: InvestRiskProfileTierResponse
    assessment_id: str
    questions_answered: int
    total_questions: int
    computed_at: Optional[str] = None
    updated_at: Optional[str] = None
    attempt_state: Optional[InvestRiskProfileAttemptStateResponse] = None


class InvestRiskProfileAssessmentAnswerOptionResponse(BaseModel):
    id: str
    label: str
    selected: bool


class InvestRiskProfileAssessmentAnswerResponse(BaseModel):
    question_id: str
    category_name: Optional[str] = None
    prompt: str
    help_text: Optional[str] = None
    sort_order: int
    selected_option_id: str
    selected_option_label: str
    options: list[InvestRiskProfileAssessmentAnswerOptionResponse] = Field(default_factory=list)


class InvestRiskProfileAssessmentAnswersResponse(BaseModel):
    assessment_id: str
    completed_at: Optional[str] = None
    answers: list[InvestRiskProfileAssessmentAnswerResponse] = Field(default_factory=list)


class InvestRiskProfileAssessmentHistoryItemResponse(BaseModel):
    assessment_id: str
    score: int
    display_score: int
    tier: str
    tier_config: InvestRiskProfileTierResponse
    completed_at: Optional[str] = None
    questions_answered: int
    total_questions: int


class InvestRiskProfileAssessmentHistoryResponse(BaseModel):
    items: list[InvestRiskProfileAssessmentHistoryItemResponse] = Field(default_factory=list)
    limit: int
    offset: int


class InvestRiskProfileReportResponse(BaseModel):
    assessment_id: str
    tier: str
    score: int
    cached: bool
    generated_at: Optional[str] = None
    filename: str
