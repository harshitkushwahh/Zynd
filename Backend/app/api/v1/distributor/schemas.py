from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class DistributorPartnerListItemResponse(BaseModel):
    id: str
    partner_id: str
    user_id: UUID
    client_id: str
    name: str
    email: str
    arn: str = ""
    client_count: int = 0
    aum: float = 0.0
    status: str
    onboarding_status: str
    joined_at: datetime
    profile_image_url: str | None = None


class DistributorPartnerAddressResponse(BaseModel):
    line1: str = ""
    line2: str = ""
    city: str = ""
    state: str = ""
    pincode: str = ""
    country: str = "India"


class DistributorPartnerDetailResponse(DistributorPartnerListItemResponse):
    mobile: str = ""
    mobile_masked: str = ""
    branch_id: str | None = None
    branch_name: str = ""
    euin: str = "—"
    pan_masked: str = ""
    address: DistributorPartnerAddressResponse
    active_sip_count: int = 0
    mtd_inflow: float = 0.0
    lumpsum_mtd: float = 0.0
    onboarding_complete_pct: int = 0


class DistributorBranchResponse(BaseModel):
    id: str
    name: str
    city: str | None = None


class DistributorConsoleContextResponse(BaseModel):
    persona: str
    client_id: str
    branch: DistributorBranchResponse | None = None


class DistributorPartnerListResponse(BaseModel):
    items: list[DistributorPartnerListItemResponse]


class PartnerOnboardingStartRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)


class PartnerOnboardingStartResponse(BaseModel):
    onboarding_token: str
    retry_after_seconds: int
    expires_in: int


class PartnerOnboardingTokenRequest(BaseModel):
    onboarding_token: str = Field(min_length=8, max_length=256)


class PartnerOnboardingVerifyOtpRequest(PartnerOnboardingTokenRequest):
    otp: str = Field(min_length=6, max_length=6)


class PartnerOnboardingMobileOtpRequest(PartnerOnboardingTokenRequest):
    mobile: str = Field(min_length=10, max_length=15)


class PartnerOnboardingDraftUpdateRequest(PartnerOnboardingTokenRequest):
    pan: str | None = None
    pan_verified_name: str | None = None
    first_name: str | None = None
    middle_name: str | None = None
    last_name: str | None = None
    bank: dict[str, Any] | None = None
    address: dict[str, Any] | None = None
    documents: dict[str, Any] | None = None


class PartnerOnboardingSubmitResponse(BaseModel):
    partner_id: UUID
    user_id: UUID
    email: str
    display_name: str
    status: str


class PartnerOnboardingProfilePhotoResponse(BaseModel):
    uploaded: bool = True
    file_name: str


class PartnerOnboardingPanVerifyRequest(PartnerOnboardingTokenRequest):
    pan: str = Field(min_length=10, max_length=10)


class PartnerOnboardingPanVerifyResponse(BaseModel):
    verified: bool = True
    verified_name: str


class PartnerOnboardingBankVerifyRequest(PartnerOnboardingTokenRequest):
    account_number: str = Field(min_length=9, max_length=18)
    account_type: str = Field(min_length=3, max_length=20)
    ifsc: str = Field(min_length=11, max_length=11)


class PartnerOnboardingBankVerifyResponse(BaseModel):
    verified: bool = True
    verified_holder_name: str
    bank_name: str = ""
    branch_name: str = ""
    account_type: str = ""
    verification_mode: str = "auto"


class PartnerOnboardingBankManualVerifyRequest(PartnerOnboardingTokenRequest):
    account_holder_name: str = Field(min_length=3, max_length=120)
    account_number: str = Field(min_length=9, max_length=18)
    confirm_account_number: str = Field(min_length=9, max_length=18)
    account_type: str = Field(min_length=3, max_length=20)
    ifsc: str = Field(min_length=11, max_length=11)
    bank_name: str = Field(min_length=2, max_length=120)
    branch_name: str = Field(min_length=2, max_length=120)


class PartnerOnboardingBankManualVerifyResponse(BaseModel):
    verified: bool = True
    verified_holder_name: str
    bank_name: str = ""
    branch_name: str = ""
    account_type: str = ""
    verification_mode: str = "manual"


class PartnerOnboardingDocumentResponse(BaseModel):
    uploaded: bool = True
    file_name: str
    doc_type: str


class PartnerOnboardingDraftDocumentsResponse(BaseModel):
    pan_file_name: str | None = None
    aadhaar_file_name: str | None = None
    pan_uploaded: bool = False
    aadhaar_uploaded: bool = False


class PartnerOnboardingDraftProfilePhotoResponse(BaseModel):
    uploaded: bool = False
    file_name: str | None = None


class PartnerOnboardingDraftResponse(BaseModel):
    email: str | None = None
    email_verified: bool = False
    mobile: str | None = None
    mobile_verified: bool = False
    pan: str | None = None
    pan_verified: bool = False
    pan_verified_name: str | None = None
    first_name: str | None = None
    middle_name: str | None = None
    last_name: str | None = None
    bank_verified: bool = False
    bank: dict[str, Any] | None = None
    address: dict[str, Any] | None = None
    documents: PartnerOnboardingDraftDocumentsResponse
    profile_photo: PartnerOnboardingDraftProfilePhotoResponse


class VerifiedResponse(BaseModel):
    verified: bool = True


class OtpSendResponse(BaseModel):
    retry_after_seconds: int
    expires_in: int


class OkResponse(BaseModel):
    ok: bool = True


class DistributorClientListItemResponse(BaseModel):
    user_id: UUID
    client_id: str | None = None
    display_name: str
    email_masked: str
    phone_masked: str | None = None
    pan_masked: str
    status: str
    kyc_compliant: bool
    has_invested: bool
    onboarding_status: str
    compliance_status: str
    investment_status: str
    investor_type: str
    aum: float | None = None
    created_at: datetime | None = None


class DistributorClientListResponse(BaseModel):
    items: list[DistributorClientListItemResponse]


class DistributorClientReferralsResponse(BaseModel):
    total_referrals: int
    kyc_verified: int
    first_investment: int
    qualified: int
    referral_code: str


class DistributorClientRiskProfileResponse(BaseModel):
    label: str
    tier: str | None = None
    score: int | None = None
    display_score: int | None = None


class DistributorClientFamilyMemberResponse(BaseModel):
    user_id: UUID
    display_name: str | None = None
    email_masked: str | None = None
    role: str | None = None
    badge_label: str | None = None
    profile_image_url: str | None = None


class DistributorClientFamilyGroupResponse(BaseModel):
    group_id: UUID
    name: str | None = None
    tag: str | None = None
    description: str | None = None
    avatar_url: str | None = None
    head_user_id: UUID | None = None
    head_display_name: str | None = None
    client_role: str
    member_count: int
    status: str | None = None
    members: list[DistributorClientFamilyMemberResponse] = Field(default_factory=list)


class DistributorClientFamilyGroupDetailResponse(DistributorClientFamilyGroupResponse):
    client_user_id: UUID
    client_display_name: str


class DistributorClientSessionResponse(BaseModel):
    id: str
    device_label: str
    os: str
    browser: str
    last_active_at: datetime | None = None
    is_current: bool


class DistributorClientDetailResponse(BaseModel):
    summary: DistributorClientListItemResponse
    display_name: str
    email_masked: str
    email_display: str
    phone_masked: str | None = None
    pan_masked: str
    risk_profile_label: str
    risk_profile: DistributorClientRiskProfileResponse | None = None
    mfa_enabled: bool
    profile_image_url: str | None = None
    kyc_overall_status: str
    kyc: dict[str, Any] | None = None
    connected_accounts: dict[str, Any] | None = None
    investments: dict[str, Any] | None = None
    goals: list[dict[str, Any]] = Field(default_factory=list)
    family_groups: list[DistributorClientFamilyGroupResponse] = Field(default_factory=list)
    referrals: DistributorClientReferralsResponse
    sessions: list[DistributorClientSessionResponse] = Field(default_factory=list)
    created_at: datetime | None = None
