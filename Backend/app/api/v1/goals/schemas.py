from __future__ import annotations

from datetime import date
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class GoalTemplateResponse(BaseModel):
    id: UUID
    slug: str
    name: str
    description: Optional[str] = None
    icon_key: str
    image_url: Optional[str] = None
    default_tenure_months: int
    suggested_return_pct: Optional[float] = None
    is_active: bool
    sort_order: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class GoalTemplateListResponse(BaseModel):
    items: list[GoalTemplateResponse]


class GoalMilestoneResponse(BaseModel):
    date: str
    month_offset: int
    projected_value_inr: float


class GoalCalculatorRequest(BaseModel):
    target_amount_inr: float = Field(gt=0)
    target_date: date
    existing_savings_inr: float = Field(default=0, ge=0)
    expected_return_pct: Optional[float] = Field(default=None, ge=0, le=100)


class GoalCalculatorResponse(BaseModel):
    target_amount_inr: float
    target_date: str
    duration_months: int
    existing_savings_inr: float
    expected_return_pct: float
    required_monthly_sip_inr: float
    required_lumpsum_inr: float
    projected_value_inr: float
    progress_pct: float
    milestones: list[GoalMilestoneResponse]


class GoalResponse(BaseModel):
    id: UUID
    user_id: UUID
    family_group_id: Optional[UUID] = None
    template_id: Optional[UUID] = None
    template: Optional[GoalTemplateResponse] = None
    title: str
    tag: Optional[str] = None
    priority: int
    target_amount_inr: float
    target_date: str
    current_amount_inr: float
    existing_savings_inr: float
    expected_return_pct: Optional[float] = None
    status: Literal["draft", "active", "achieved", "paused", "archived"]
    progress_pct: float
    linked_product_id: Optional[UUID] = None
    linked_product_name: Optional[str] = None
    holdings_value_inr: Optional[float] = None
    invested_via_orders_inr: Optional[float] = None
    linked_sip_monthly_inr: Optional[float] = None
    effective_current_amount_inr: Optional[float] = None
    effective_progress_pct: Optional[float] = None
    projected_value_inr: Optional[float] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class GoalListResponse(BaseModel):
    items: list[GoalResponse]
    limit: int
    active_count: int


class CreateGoalRequest(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    target_amount_inr: float = Field(gt=0)
    target_date: date
    template_id: Optional[UUID] = None
    tag: Optional[str] = Field(default=None, max_length=32)
    priority: int = Field(default=3, ge=1, le=5)
    existing_savings_inr: float = Field(default=0, ge=0)
    expected_return_pct: Optional[float] = Field(default=None, ge=0, le=100)
    status: Literal["draft", "active"] = "active"
    linked_product_id: Optional[UUID] = None


class UpdateGoalRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=80)
    tag: Optional[str] = Field(default=None, max_length=32)
    priority: Optional[int] = Field(default=None, ge=1, le=5)
    target_amount_inr: Optional[float] = Field(default=None, gt=0)
    target_date: Optional[date] = None
    existing_savings_inr: Optional[float] = Field(default=None, ge=0)
    current_amount_inr: Optional[float] = Field(default=None, ge=0)
    expected_return_pct: Optional[float] = Field(default=None, ge=0, le=100)
    status: Optional[Literal["draft", "active", "achieved", "paused", "archived"]] = None
    linked_product_id: Optional[UUID] = None
    clear_linked_product: bool = False


class FamilyGoalResponse(GoalResponse):
    created_by_user_id: Optional[UUID] = None
    contribution_total_inr: Optional[float] = None


class FamilyGoalListResponse(BaseModel):
    items: list[FamilyGoalResponse]
    limit: int
    active_count: int


class CreateFamilyGoalRequest(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    target_amount_inr: float = Field(gt=0)
    target_date: date
    template_id: Optional[UUID] = None
    tag: Optional[str] = Field(default=None, max_length=32)
    priority: int = Field(default=3, ge=1, le=5)
    existing_savings_inr: float = Field(default=0, ge=0)
    expected_return_pct: Optional[float] = Field(default=None, ge=0, le=100)
    status: Literal["draft", "active"] = "active"


class UpdateFamilyGoalRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=80)
    tag: Optional[str] = Field(default=None, max_length=32)
    priority: Optional[int] = Field(default=None, ge=1, le=5)
    target_amount_inr: Optional[float] = Field(default=None, gt=0)
    target_date: Optional[date] = None
    existing_savings_inr: Optional[float] = Field(default=None, ge=0)
    expected_return_pct: Optional[float] = Field(default=None, ge=0, le=100)
    status: Optional[Literal["draft", "active", "achieved", "paused", "archived"]] = None


class AddFamilyGoalContributionRequest(BaseModel):
    amount_inr: float = Field(gt=0)
    note: Optional[str] = Field(default=None, max_length=120)


class FamilyGoalContributionItemResponse(BaseModel):
    id: UUID
    user_id: UUID
    display_name: str
    amount_inr: float
    source_type: str
    note: Optional[str] = None
    contributed_at: Optional[str] = None


class FamilyGoalMemberTotalResponse(BaseModel):
    user_id: UUID
    display_name: str
    total_inr: float
    contribution_count: int


class FamilyGoalContributionsResponse(BaseModel):
    goal_id: UUID
    total_contributed_inr: float
    member_totals: list[FamilyGoalMemberTotalResponse]
    items: list[FamilyGoalContributionItemResponse]


class LinkableFamilyGoalItemResponse(BaseModel):
    goal_id: UUID
    goal_title: str
    target_amount_inr: float
    progress_pct: float
    group_id: UUID
    group_title: str
    my_role: str
    can_create_goals: bool


class LinkableFamilyGoalListResponse(BaseModel):
    items: list[LinkableFamilyGoalItemResponse]


class AdminGoalLinkedProductResponse(BaseModel):
    product_id: str
    product_name: Optional[str] = None
    isin: Optional[str] = None


class AdminGoalInvestmentHoldingResponse(BaseModel):
    holding_id: int
    user_id: str
    owner_display_name: str
    scheme_name: str
    matched_scheme_name: Optional[str] = None
    folio_number: str
    isin: str
    units: float
    nav_value: Optional[float] = None
    market_value_inr: Optional[float] = None
    as_of_date: Optional[str] = None
    amc_name: Optional[str] = None
    source: str


class AdminGoalInvestmentSipPlanResponse(BaseModel):
    plan_id: str
    user_id: str
    owner_display_name: str
    product_id: str
    product_name: Optional[str] = None
    amount_inr: float
    frequency: str
    installment_day: Optional[int] = None
    status: str
    next_installment_date: Optional[str] = None
    is_goal_linked: bool
    created_at: Optional[str] = None
    activated_at: Optional[str] = None


class AdminGoalInvestmentOrderResponse(BaseModel):
    order_id: str
    user_id: str
    owner_display_name: str
    product_id: str
    product_name: Optional[str] = None
    order_type: str
    amount_inr: float
    status: str
    is_goal_linked: bool
    created_at: Optional[str] = None
    settled_at: Optional[str] = None


class AdminGoalInvestmentContributionResponse(BaseModel):
    id: str
    user_id: str
    owner_display_name: str
    amount_inr: float
    source_type: str
    note: Optional[str] = None
    contributed_at: Optional[str] = None


class AdminGoalInvestmentsSummaryResponse(BaseModel):
    holdings_value_inr: float
    invested_via_orders_inr: float
    linked_sip_monthly_inr: float
    contributions_total_inr: float
    has_linked_investment: bool


class AdminGoalInvestmentsResponse(BaseModel):
    goal_id: UUID
    linked_product: Optional[AdminGoalLinkedProductResponse] = None
    holdings: list[AdminGoalInvestmentHoldingResponse]
    sip_plans: list[AdminGoalInvestmentSipPlanResponse]
    orders: list[AdminGoalInvestmentOrderResponse]
    contributions: list[AdminGoalInvestmentContributionResponse]
    summary: AdminGoalInvestmentsSummaryResponse
