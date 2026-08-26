from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class AdminReferralUserSummaryResponse(BaseModel):
    user_id: str
    client_id: str
    email: str
    display_name: str


class AdminReferralMetricsResponse(BaseModel):
    total_clicks: int
    total_attributions: int
    total_referrers: int
    stage_counts: dict[str, int]
    kyc_verified_count: int
    first_investment_count: int
    qualified_count: int
    engaged_count: int
    estimated_earnings_inr: int
    conversion_click_to_signup_pct: float
    conversion_signup_to_invest_pct: float


class AdminReferralSchemeResponse(BaseModel):
    reward_rate_pct: float
    min_first_investment_inr: int
    qualification_hold_days: int
    lumpsum_retention_days: int = 180
    min_referrals_to_redeem: int = 15
    default_qualification_hold_days: int | None = None
    min_engagement_investment_inr: int
    aum_milestone_inr: int
    timezone: str | None = None
    stages: list[str]
    reward_note: str
    rules: list["AdminReferralRewardRuleResponse"] = Field(default_factory=list)


class AdminReferralAttributionResponse(BaseModel):
    id: str
    referral_code: str
    current_stage: Literal[
        "signed_up",
        "kyc_verified",
        "first_investment",
        "qualified",
        "engaged",
    ]
    signup_channel: Literal["email", "google", "apple"]
    signed_up_at: datetime
    kyc_verified_at: datetime | None = None
    first_investment_at: datetime | None = None
    first_investment_product: Literal["mutual_fund", "fixed_deposit", "other"] | None = None
    first_investment_mode: Literal["lumpsum", "sip", "other"] | None = None
    first_investment_amount_inr: int | None = None
    first_investment_reversed_at: datetime | None = None
    qualified_at: datetime | None = None
    engaged_at: datetime | None = None
    estimated_reward_inr: int
    pending_qualification: bool = False
    qualification_due_at: datetime | None = None
    referrer: AdminReferralUserSummaryResponse | None = None
    referee: AdminReferralUserSummaryResponse | None = None


class AdminReferralAttributionListResponse(BaseModel):
    items: list[AdminReferralAttributionResponse]
    limit: int
    offset: int


class AdminReferralLeaderboardEntryResponse(BaseModel):
    rank: int
    referral_count: int
    estimated_earnings_inr: int
    referral_code: str | None = None
    display_name: str
    user: AdminReferralUserSummaryResponse | None = None


class AdminReferralLeaderboardResponse(BaseModel):
    period: str
    is_snapshot: bool = False
    is_final: bool = False
    items: list[AdminReferralLeaderboardEntryResponse]


class AdminReferralProgramSettingsResponse(BaseModel):
    min_referrals_to_redeem: int
    lumpsum_retention_days: int
    default_qualification_hold_days: int
    min_first_investment_inr: int
    timezone: str
    updated_at: datetime


class AdminReferralProgramSettingsUpdateRequest(BaseModel):
    min_referrals_to_redeem: int | None = Field(default=None, ge=1)
    lumpsum_retention_days: int | None = Field(default=None, ge=1)
    default_qualification_hold_days: int | None = Field(default=None, ge=1)
    min_first_investment_inr: int | None = Field(default=None, ge=1)
    timezone: str | None = None


class AdminReferralLeaderboardConfigResponse(BaseModel):
    primary_metric: Literal[
        "signup_count",
        "kyc_verified_count",
        "first_investment_count",
        "qualified_count",
    ]
    tie_breaker_1: Literal["earnings_inr_desc", "referral_count_desc", "earliest_referral_asc"]
    tie_breaker_2: Literal["earnings_inr_desc", "referral_count_desc", "earliest_referral_asc"]
    period_field: Literal["signed_up_at", "first_investment_at", "qualified_at"]
    auto_snapshot_enabled: bool
    updated_at: datetime


class AdminReferralLeaderboardConfigUpdateRequest(BaseModel):
    primary_metric: Literal[
        "signup_count",
        "kyc_verified_count",
        "first_investment_count",
        "qualified_count",
    ] | None = None
    tie_breaker_1: Literal["earnings_inr_desc", "referral_count_desc", "earliest_referral_asc"] | None = None
    tie_breaker_2: Literal["earnings_inr_desc", "referral_count_desc", "earliest_referral_asc"] | None = None
    period_field: Literal["signed_up_at", "first_investment_at", "qualified_at"] | None = None
    auto_snapshot_enabled: bool | None = None


class AdminReferralLeaderboardMonthResponse(BaseModel):
    period_key: str
    label: str
    has_snapshot: bool
    is_current: bool


class AdminReferralLeaderboardMonthsResponse(BaseModel):
    items: list[AdminReferralLeaderboardMonthResponse]


class AdminReferralUserCountsResponse(BaseModel):
    signup_count: int
    kyc_verified_count: int
    first_investment_count: int
    qualified_count: int
    engaged_count: int


class AdminUserReferralsResponse(BaseModel):
    user: AdminReferralUserSummaryResponse
    referral_code: str | None = None
    referral_code_active: bool = False
    share_url: str | None = None
    click_count: int = 0
    counts: AdminReferralUserCountsResponse
    total_estimated_earnings_inr: int = 0
    referrals: list[AdminReferralAttributionResponse] = Field(default_factory=list)
    referred_by: AdminReferralAttributionResponse | None = None


class AdminReferralRewardRuleResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    trigger: Literal["first_investment", "kyc_verified", "qualified", "engaged"]
    reward_type: Literal["flat_inr", "percent"]
    reward_value: int
    min_investment_inr: int | None = None
    valid_from: datetime | None = None
    valid_to: datetime | None = None
    is_active: bool
    sort_order: int = 0


class AdminReferralRewardRuleListResponse(BaseModel):
    items: list[AdminReferralRewardRuleResponse]


class AdminReferralRewardRuleCreateRequest(BaseModel):
    name: str
    description: str | None = None
    trigger: Literal["first_investment", "kyc_verified", "qualified", "engaged"]
    reward_type: Literal["flat_inr", "percent"]
    reward_value: int = Field(ge=0)
    min_investment_inr: int | None = Field(default=None, ge=0)
    valid_from: datetime | None = None
    valid_to: datetime | None = None
    is_active: bool = True
    sort_order: int = 0


class AdminReferralRewardRuleUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    trigger: Literal["first_investment", "kyc_verified", "qualified", "engaged"] | None = None
    reward_type: Literal["flat_inr", "percent"] | None = None
    reward_value: int | None = Field(default=None, ge=0)
    min_investment_inr: int | None = Field(default=None, ge=0)
    valid_from: datetime | None = None
    valid_to: datetime | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class AdminReferralRewardLedgerEntryResponse(BaseModel):
    id: str
    attribution_id: str
    rule_id: str | None = None
    rule_name: str
    trigger: Literal["first_investment", "kyc_verified", "qualified", "engaged"]
    amount_inr: int
    status: Literal["pending", "approved", "paid", "reversed", "cancelled"]
    earned_at: datetime
    paid_at: datetime | None = None
    notes: str | None = None
    referrer: AdminReferralUserSummaryResponse | None = None
    referee: AdminReferralUserSummaryResponse | None = None


class AdminReferralRewardLedgerListResponse(BaseModel):
    items: list[AdminReferralRewardLedgerEntryResponse]
    limit: int
    offset: int


class AdminReferralRewardLedgerStatusUpdateRequest(BaseModel):
    status: Literal["pending", "approved", "paid", "reversed", "cancelled"]
    notes: str | None = None


class AdminReferralReferrerDirectoryEntryResponse(BaseModel):
    referral_count: int
    click_count: int
    estimated_earnings_inr: int
    paid_earnings_inr: int
    referral_code: str | None = None
    referral_code_active: bool = False
    display_name: str
    user: AdminReferralUserSummaryResponse | None = None


class AdminReferralReferrerDirectoryListResponse(BaseModel):
    items: list[AdminReferralReferrerDirectoryEntryResponse]
    limit: int
    offset: int
