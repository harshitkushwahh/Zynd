from __future__ import annotations

from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class RiskQuestionOptionInput(BaseModel):
    label: str = Field(min_length=1, max_length=512)
    score_value: int = Field(ge=0, le=100)
    sort_order: int = Field(default=0, ge=0, le=3)


class RiskQuestionOptionResponse(BaseModel):
    id: str
    label: str
    score_value: int
    sort_order: int


class RiskCategoryResponse(BaseModel):
    id: str
    slug: str
    name: str
    description: Optional[str] = None
    weight: float
    sort_order: int
    is_active: bool
    question_count: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class RiskCategoryListResponse(BaseModel):
    categories: list[RiskCategoryResponse]


class CreateRiskCategoryRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: Optional[str] = None
    weight: Decimal = Field(ge=0, le=1)
    sort_order: int = Field(default=0, ge=0)


class UpdateRiskCategoryRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    description: Optional[str] = None
    weight: Optional[Decimal] = Field(default=None, ge=0, le=1)
    sort_order: Optional[int] = Field(default=None, ge=0)
    is_active: Optional[bool] = None


class RiskQuestionResponse(BaseModel):
    id: str
    category_id: str
    category_slug: Optional[str] = None
    category_name: Optional[str] = None
    prompt: str
    help_text: Optional[str] = None
    sort_order: int
    is_active: bool
    options: list[RiskQuestionOptionResponse]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class RiskQuestionListResponse(BaseModel):
    questions: list[RiskQuestionResponse]


class CreateRiskQuestionRequest(BaseModel):
    category_id: UUID
    prompt: str = Field(min_length=1)
    help_text: Optional[str] = None
    sort_order: Optional[int] = Field(default=None, ge=0)
    options: list[RiskQuestionOptionInput] = Field(min_length=1, max_length=4)


class UpdateRiskQuestionRequest(BaseModel):
    category_id: Optional[UUID] = None
    prompt: Optional[str] = Field(default=None, min_length=1)
    help_text: Optional[str] = None
    sort_order: Optional[int] = Field(default=None, ge=0)
    is_active: Optional[bool] = None
    options: Optional[list[RiskQuestionOptionInput]] = Field(default=None, min_length=1, max_length=4)


class RiskTierResponse(BaseModel):
    tier: str
    min_score: int
    max_score: int
    title: str
    message_body: str
    sort_order: int
    updated_at: Optional[str] = None


class RiskTierListResponse(BaseModel):
    tiers: list[RiskTierResponse]


class UpdateRiskTierRequest(BaseModel):
    min_score: Optional[int] = Field(default=None, ge=0, le=1000)
    max_score: Optional[int] = Field(default=None, ge=0, le=1000)
    title: Optional[str] = Field(default=None, min_length=1, max_length=128)
    message_body: Optional[str] = Field(default=None, min_length=1)
    sort_order: Optional[int] = Field(default=None, ge=0)


class RiskScoreAnswerInput(BaseModel):
    question_id: UUID
    option_id: UUID


class RiskScorePreviewRequest(BaseModel):
    answers: list[RiskScoreAnswerInput] = Field(min_length=1)


class RiskScorePreviewResponse(BaseModel):
    score: int
    tier: str
    tier_title: str
    tier_message: str
    category_scores: dict[str, float]


class UserRiskProfileItemResponse(BaseModel):
    user_id: str
    client_id: str
    email: str
    display_name: str
    profile_image_url: Optional[str] = None
    assessment_count: int
    score: int
    tier: str
    assessment_id: str
    computed_at: Optional[str] = None
    updated_at: Optional[str] = None


class UserRiskProfileAssessmentItemResponse(BaseModel):
    assessment_id: str
    score: int
    display_score: int
    tier: str
    tier_config: RiskTierResponse
    completed_at: Optional[str] = None
    questions_answered: int
    total_questions: int


class UserRiskProfileAssessmentListResponse(BaseModel):
    items: list[UserRiskProfileAssessmentItemResponse]
    limit: int
    offset: int


class UserRiskProfileAssessmentAnswerResponse(BaseModel):
    question_id: str
    category_name: Optional[str] = None
    prompt: str
    help_text: Optional[str] = None
    sort_order: int
    selected_option_id: str
    selected_option_label: str
    options: list[dict] = Field(default_factory=list)


class UserRiskProfileScoringCategoryResponse(BaseModel):
    category_id: str
    category_name: str
    weight: float
    normalized_score: float
    weight_share: float
    weighted_contribution: float
    questions_answered: int


class UserRiskProfileScoringBreakdownResponse(BaseModel):
    final_score: int
    formula_summary: str
    categories: list[UserRiskProfileScoringCategoryResponse]


class UserRiskProfileAssessmentDetailResponse(BaseModel):
    user_id: str
    assessment_id: str
    score: int
    display_score: int
    tier: str
    tier_config: RiskTierResponse
    completed_at: Optional[str] = None
    questions_answered: int
    total_questions: int
    answers: list[UserRiskProfileAssessmentAnswerResponse]
    scoring: UserRiskProfileScoringBreakdownResponse


class UserRiskProfileListResponse(BaseModel):
    items: list[UserRiskProfileItemResponse]
    limit: int
    offset: int


class UserRiskProfileDetailResponse(UserRiskProfileItemResponse):
    tier_config: RiskTierResponse


class RiskAuditLogItemResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    event_type: str
    ip_address: Optional[str] = None
    metadata: dict
    created_at: str


class RiskAuditLogListResponse(BaseModel):
    items: list[RiskAuditLogItemResponse]
    limit: int
    offset: int


class RiskTemplateRuleInput(BaseModel):
    category_id: UUID
    question_count: int = Field(ge=1, le=50)
    sort_order: int = Field(default=0, ge=0)


class RiskTemplateRuleResponse(BaseModel):
    category_id: str
    category_slug: Optional[str] = None
    category_name: Optional[str] = None
    question_count: int
    sort_order: int


class RiskTemplateResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    is_default: bool
    is_active: bool
    selection_mode: str
    sort_order: int
    total_questions: int
    rules: list[RiskTemplateRuleResponse]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class RiskTemplateListResponse(BaseModel):
    templates: list[RiskTemplateResponse]


class CreateRiskTemplateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: Optional[str] = None
    is_default: bool = False
    selection_mode: str = Field(default="manual", pattern="^(manual|auto)$")
    sort_order: int = Field(default=0, ge=0)
    rules: list[RiskTemplateRuleInput] = Field(min_length=1)


class UpdateRiskTemplateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    description: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None
    selection_mode: Optional[str] = Field(default=None, pattern="^(manual|auto)$")
    sort_order: Optional[int] = Field(default=None, ge=0)
    rules: Optional[list[RiskTemplateRuleInput]] = Field(default=None, min_length=1)


class RiskTemplateQuestionsResponse(BaseModel):
    template: RiskTemplateResponse
    questions: list[RiskQuestionResponse]
    total_questions: int


class RiskTemplateAutoSelectRequest(BaseModel):
    user_id: Optional[UUID] = None
    target_question_count: Optional[int] = Field(default=None, ge=1, le=100)


class RiskTemplateAutoSelectResponse(BaseModel):
    selection_reason: str
    preferred_question_count: int
    template: RiskTemplateResponse
    questions: list[RiskQuestionResponse]
    total_questions: int


class RiskBulkPreviewRowResponse(BaseModel):
    line: str
    category_slug: str
    prompt: str
    help_text: Optional[str] = None
    sort_order: int
    options: list[RiskQuestionOptionInput]
    category_exists: bool
    status: str


class RiskBulkPreviewErrorResponse(BaseModel):
    line: str
    code: str
    message: str


class RiskBulkPreviewResponse(BaseModel):
    row_count: int
    valid_count: int
    error_count: int
    rows: list[RiskBulkPreviewRowResponse]
    errors: list[RiskBulkPreviewErrorResponse]
    ready: bool


class RiskBulkSubmitRequest(BaseModel):
    csv: str = Field(min_length=1)
    create_missing_categories: bool = False
    default_category_weight: Decimal = Field(default=Decimal("0.1"), ge=0, le=1)


class RiskBulkSubmitResponse(BaseModel):
    row_count: int
    created_categories: int
    created_questions: int
    question_ids: list[str]


class LockedRiskProfileUserResponse(BaseModel):
    user_id: str
    client_id: str
    email: str
    display_name: str
    profile_image_url: Optional[str] = None
    completed_count: int
    granted_attempts: int
    attempts_remaining: int
    is_locked: bool
    locked_at: Optional[str] = None
    updated_at: Optional[str] = None


class LockedRiskProfileListResponse(BaseModel):
    items: list[LockedRiskProfileUserResponse]
    limit: int
    offset: int


class RiskProfileUnlockConfirmRequest(BaseModel):
    otp_code: str = Field(min_length=4, max_length=12)


class RiskProfileUnlockResponse(BaseModel):
    completed_count: int
    granted_attempts: int
    attempts_remaining: int
    is_locked: bool
    locked_at: Optional[str] = None
    updated_at: Optional[str] = None


class RiskProfileUnlockJourneyStepResponse(BaseModel):
    id: str
    kind: str
    title: str
    description: Optional[str] = None
    status: str
    created_at: str
    admin_id: Optional[str] = None
    admin_email: Optional[str] = None
    admin_display_name: Optional[str] = None
    attempts_granted: Optional[int] = None
    metadata: dict = Field(default_factory=dict)


class RiskProfileUnlockJourneyResponse(BaseModel):
    user_id: str
    attempt_state: dict
    steps: list[RiskProfileUnlockJourneyStepResponse]
