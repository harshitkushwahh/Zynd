from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ReferralMeResponse(BaseModel):
    code: str
    share_url: str
    click_count: int
    signup_count: int
    kyc_verified_count: int
    first_investment_count: int
    qualified_count: int
    engaged_count: int
    created_at: datetime


class ReferralClickRequest(BaseModel):
    code: str = Field(min_length=6, max_length=16)


class ReferralClickResponse(BaseModel):
    ok: bool = True
    code: str
    share_path: str


class ReferralListItemResponse(BaseModel):
    id: str
    name: str
    masked_email: str
    current_stage: Literal["signed_up", "kyc_verified", "first_investment", "qualified", "engaged"]
    signup_channel: Literal["email", "google", "apple"]
    signed_up_at: datetime
    kyc_verified_at: datetime | None = None
    first_investment_at: datetime | None = None
    first_investment_product: Literal["mutual_fund", "fixed_deposit", "other"] | None = None
    first_investment_amount_inr: int | None = None
    qualified_at: datetime | None = None
    engaged_at: datetime | None = None
    profile_image_url: str | None = None


class ReferralListResponse(BaseModel):
    items: list[ReferralListItemResponse]


ReferralLeaderboardPeriod = Literal["this_month", "last_3_months", "all_time"]


class ReferralLeaderboardEntryResponse(BaseModel):
    rank: int
    name: str
    referral_count: int
    earnings_inr: int
    is_current_user: bool = False
    profile_image_url: str | None = None


class ReferralLeaderboardCurrentUserResponse(BaseModel):
    rank: int | None = None
    referral_count: int
    earnings_inr: int
    top_percent: int | None = None


class ReferralLeaderboardResponse(BaseModel):
    period: ReferralLeaderboardPeriod
    entries: list[ReferralLeaderboardEntryResponse]
    current_user: ReferralLeaderboardCurrentUserResponse
