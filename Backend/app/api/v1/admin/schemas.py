from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SecurityReviewItemResponse(BaseModel):
    id: UUID
    user_id: UUID
    user_email: str
    reason: str
    status: str
    metadata: dict
    review_notes: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime


class SecurityReviewListResponse(BaseModel):
    items: list[SecurityReviewItemResponse]


class ResolveSecurityReviewRequest(BaseModel):
    status: Literal["reviewed", "dismissed"]
    notes: Optional[str] = Field(default=None, max_length=2000)


class ResolveSecurityReviewResponse(BaseModel):
    id: UUID
    status: str
    reviewed_at: datetime


class AdminPermissionsResponse(BaseModel):
    permissions: list[str]


class AdminRoleResponse(BaseModel):
    key: str
    name: str
    description: str
    permissions: list[str]
    is_system: bool = False


class AdminRolesResponse(BaseModel):
    roles: list[AdminRoleResponse]


class AdminPermissionResponse(BaseModel):
    key: str
    description: str


class AdminPermissionsListResponse(BaseModel):
    permissions: list[AdminPermissionResponse]


class CreateAdminPermissionRequest(BaseModel):
    key: str = Field(min_length=3, max_length=64)
    description: str = Field(min_length=3, max_length=255)


class CreateAdminRoleRequest(BaseModel):
    key: str = Field(min_length=2, max_length=64)
    name: str = Field(min_length=2, max_length=128)
    description: str = Field(min_length=2, max_length=255)
    permissions: list[str] = Field(default_factory=list)


class UpdateAdminRoleRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=128)
    description: str | None = Field(default=None, min_length=2, max_length=255)
    permissions: list[str] | None = None


class RotateKeysResponse(BaseModel):
    target_version: int
    rotated: int
    skipped: int
    total: int
    available_versions: list[int]


class RetentionPolicyResponse(BaseModel):
    data_class: str
    min_retention_days: int
    legal_basis: str
    can_delete_on_request: bool
    notes: Optional[str] = None


class RetentionScheduleResponse(BaseModel):
    policies: list[RetentionPolicyResponse]


class PendingDeletionItemResponse(BaseModel):
    user_id: UUID
    email: str
    deletion_requested_at: Optional[datetime] = None
    deletion_scheduled_at: Optional[datetime] = None
    is_due: bool


class PendingDeletionsResponse(BaseModel):
    items: list[PendingDeletionItemResponse]


class DeletionExecutorRunResponse(BaseModel):
    processed: int
    executed: int
    failed: int
    results: list[dict]
    failures: list[dict]


class AdminUserSummaryResponse(BaseModel):
    user_id: UUID
    client_id: str
    email: str
    display_name: str
    status: str
    role: str
    has_invested: bool
    suspended_at: Optional[datetime] = None
    suspension_reason_code: Optional[str] = None
    mfa_enrolled: bool
    created_at: datetime


class AdminUserKycStepResponse(BaseModel):
    key: str
    label: str
    status: Optional[str] = None


class AdminUserKycPanResponse(BaseModel):
    pan_last4: Optional[str] = None
    full_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    pan_category: Optional[str] = None


class AdminUserKycAddressBlockResponse(BaseModel):
    line1: Optional[str] = None
    line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: Optional[str] = None


class AdminUserKycAddressResponse(BaseModel):
    permanent: Optional[AdminUserKycAddressBlockResponse] = None
    correspondence: Optional[AdminUserKycAddressBlockResponse] = None
    same_as_permanent: Optional[bool] = None


class AdminUserKycPersonalResponse(BaseModel):
    fathers_name: Optional[str] = None
    gender: Optional[str] = None
    income_slab: Optional[str] = None
    occupation: Optional[str] = None
    marital_status: Optional[str] = None
    pep_exposed: Optional[bool] = None
    place_of_birth: Optional[str] = None
    nationality: Optional[str] = None


class AdminUserKycBankDraftResponse(BaseModel):
    account_number_last4: Optional[str] = None
    ifsc_code: Optional[str] = None
    account_type: Optional[str] = None
    account_holder_name: Optional[str] = None
    bank_name: Optional[str] = None
    branch: Optional[str] = None
    readiness_verified: Optional[bool] = None


class AdminUserKycNomineeResponse(BaseModel):
    full_name: Optional[str] = None
    name: Optional[str] = None
    relationship: Optional[str] = None
    share_percent: Optional[int] = None
    date_of_birth: Optional[str] = None
    document_type: Optional[str] = None
    document_number_last4: Optional[str] = None
    pan_last4: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_pan_last4: Optional[str] = None
    sync_status: Optional[str] = None


class AdminUserKycSignatureResponse(BaseModel):
    mode: Optional[str] = None
    has_upload: bool = False
    document_id: Optional[str] = None


class AdminUserInvestorAddressResponse(BaseModel):
    id: str
    is_primary: bool
    nature: str
    line1: str
    line2: Optional[str] = None
    line3: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: str
    country: str
    sync_status: str


class AdminUserKycDetailResponse(BaseModel):
    overall_status: str
    last_completed_step: Optional[str] = None
    active_step_index: int = 0
    step_statuses: dict[str, str]
    incomplete_steps: list[AdminUserKycStepResponse]
    pan: Optional[AdminUserKycPanResponse] = None
    address: Optional[AdminUserKycAddressResponse] = None
    investor_addresses: list[AdminUserInvestorAddressResponse] = []
    personal: Optional[AdminUserKycPersonalResponse] = None
    bank_draft: Optional[AdminUserKycBankDraftResponse] = None
    bank_accounts: list[dict] = []
    nominees: list[AdminUserKycNomineeResponse] = []
    signature: Optional[AdminUserKycSignatureResponse] = None
    signature_document_id: Optional[str] = None
    pan_verification_status: Optional[str] = None
    bank_verification_status: Optional[str] = None
    external_kyc_status: Optional[str] = None
    kyc_form_status: Optional[str] = None
    investor_profile_status: Optional[str] = None
    documents: list[AdminKycDocumentResponse]


class AdminUserInvestmentsDetailResponse(BaseModel):
    orders: list[dict]
    purchases: list[dict]
    cart: dict
    holdings: list[dict]
    sip_plans: list[dict]


class AdminUserProfileDetailResponse(BaseModel):
    user_id: UUID
    email: str
    kyc: Optional[AdminUserKycDetailResponse] = None
    investments: Optional[AdminUserInvestmentsDetailResponse] = None


class SuspendUserRequest(BaseModel):
    reason_code: Literal[
        "suspicious_activity",
        "kyc_mismatch",
        "user_requested",
        "compliance_hold",
        "repeated_auth_failures",
        "chargeback_dispute",
    ]
    notes: Optional[str] = Field(default=None, max_length=2000)


class UserStatusChangeResponse(BaseModel):
    user_id: UUID
    status: str
    suspension_reason_code: Optional[str] = None
    suspended_at: Optional[datetime] = None


class AdminActionRequestResponse(BaseModel):
    id: UUID
    action_type: str
    status: str
    target_type: Optional[str] = None
    target_id: Optional[UUID] = None
    target_email: Optional[str] = None
    payload: dict
    reason: Optional[str] = None
    requested_by: UUID
    requested_by_email: Optional[str] = None
    approved_by: Optional[UUID] = None
    approved_by_email: Optional[str] = None
    rejection_notes: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    outcome: Optional[dict] = None


class AdminActionListResponse(BaseModel):
    items: list[AdminActionRequestResponse]


class RejectAdminActionRequest(BaseModel):
    notes: Optional[str] = Field(default=None, max_length=2000)


class PendingActionResponse(BaseModel):
    status: Literal["pending"] = "pending"
    action_id: UUID
    message: str


class AdminUserListItemResponse(BaseModel):
    user_id: UUID
    client_id: str
    email: str
    display_name: str
    status: str
    role: str
    has_invested: bool
    kyc_compliant: bool
    suspended_at: Optional[datetime] = None
    mfa_enrolled: bool
    created_at: datetime


class AdminUserListResponse(BaseModel):
    items: list[AdminUserListItemResponse]


class AuditLogItemResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    event_type: str
    ip_address: Optional[str] = None
    metadata: dict
    created_at: datetime


class AuditLogListResponse(BaseModel):
    items: list[AuditLogItemResponse]


class ZyndLogItemResponse(BaseModel):
    id: UUID
    source: str
    user_id: Optional[UUID] = None
    user_email: Optional[str] = None
    action: str
    method: str
    path: str
    status_code: Optional[int] = None
    success: bool
    duration_ms: Optional[int] = None
    error_code: Optional[str] = None
    request_summary: dict = Field(default_factory=dict)
    response_summary: dict = Field(default_factory=dict)
    metadata: dict = Field(default_factory=dict)
    created_at: datetime


class ZyndLogListResponse(BaseModel):
    items: list[ZyndLogItemResponse]
    total: int
    has_more: bool
    latest_at: Optional[datetime] = None


class SecurityConfigItemResponse(BaseModel):
    key: str
    value: object
    scope: str
    version: int
    updated_at: datetime


class SecurityConfigListResponse(BaseModel):
    items: list[SecurityConfigItemResponse]


class SecurityConfigUpdateRequest(BaseModel):
    key: str = Field(min_length=3, max_length=120)
    value: object
    reason: Optional[str] = Field(default=None, max_length=2000)


class AdminUserRolesResponse(BaseModel):
    user_id: UUID
    roles: list[str]


class AssignAdminRoleRequest(BaseModel):
    role_key: str = Field(min_length=2, max_length=64)


class SetAdminUserRolesRequest(BaseModel):
    role_keys: list[str] = Field(min_length=1, max_length=20)


class CreateAdminUserRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    first_name: str = Field(min_length=1, max_length=50)
    last_name: Optional[str] = Field(default=None, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    role_keys: list[str] = Field(min_length=1, max_length=10)


class CreateAdminUserResponse(AdminUserSummaryResponse):
    roles: list[str] = Field(default_factory=list)


class AdminTransferRequest(BaseModel):
    user_id: UUID
    amount_inr: int = Field(gt=0, le=10_000_000)
    destination_label: str = Field(min_length=2, max_length=120)
    note: str | None = Field(default=None, max_length=240)


class AdminTransferResponse(BaseModel):
    transfer_id: str
    status: str
    user_id: UUID
    amount_inr: int
    destination_label: str
    message: str


class AdminDocumentResponse(BaseModel):
    id: UUID
    user_id: UUID
    client_id: str
    doc_type: str
    version: int
    original_filename: str
    mime_type: str
    size_bytes: int
    sha256: str
    status: str
    storage_provider: str
    storage_bucket: str
    immutable_at: Optional[datetime] = None
    legal_hold: bool = False
    deletion_scheduled_at: Optional[datetime] = None
    created_at: datetime


class AdminDocumentListResponse(BaseModel):
    documents: list[AdminDocumentResponse]


class AdminDocumentDownloadResponse(BaseModel):
    download_url: str
    expires_in: int = Field(ge=1)
    mime_type: str
    filename: str


class AdminDocumentWormResponse(BaseModel):
    id: UUID
    user_id: UUID
    client_id: str
    doc_type: str
    version: int
    status: str
    immutable_at: Optional[datetime] = None
    legal_hold: bool
    kyc_review_status: Optional[str] = None
    created_at: datetime


class AdminVerifyKycDocumentsResponse(BaseModel):
    verified_count: int
    skipped_count: int
    documents: list[AdminDocumentWormResponse]


class AdminLegalHoldRequest(BaseModel):
    enabled: bool


class AdminDeleteDocumentRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class AdminRejectKycDocumentRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class AdminKycDocumentResponse(BaseModel):
    id: UUID
    doc_type: str
    version: int
    status: str
    kyc_review_status: Optional[str] = None
    immutable_at: Optional[datetime] = None
    original_filename: str
    mime_type: str
    created_at: datetime


class AdminKycReviewResponse(BaseModel):
    user_id: UUID
    client_id: str
    email: str
    documents: list[AdminKycDocumentResponse]


class MfJobLastRunResponse(BaseModel):
    run_uuid: Optional[str] = None
    status: Optional[str] = None
    triggered_by: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    records_processed: Optional[int] = None
    records_inserted: Optional[int] = None
    records_skipped: Optional[int] = None
    error_message: Optional[str] = None
    metadata: Optional[dict] = None


class MfJobResponse(BaseModel):
    name: str
    phase: int
    cron: str
    enabled: bool
    description: str
    depends_on: list[str]
    last_run: Optional[MfJobLastRunResponse] = None


class MfJobListResponse(BaseModel):
    jobs: list[MfJobResponse]


class MfRunJobResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    job: str
    skipped: Optional[int] = None
    reason: Optional[str] = None
    processed: Optional[int] = None
    inserted: Optional[int] = None
    duration_seconds: Optional[float] = None
    run_uuid: Optional[str] = None
    result: dict = Field(default_factory=dict)


class MfIngestionRunResponse(BaseModel):
    job_name: Optional[str] = None
    run_uuid: Optional[str] = None
    status: Optional[str] = None
    triggered_by: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    records_processed: Optional[int] = None
    records_inserted: Optional[int] = None
    records_skipped: Optional[int] = None
    error_message: Optional[str] = None
    metadata: Optional[dict] = None


class MfIngestionRunListResponse(BaseModel):
    runs: list[MfIngestionRunResponse]


class MfAmcResponse(BaseModel):
    id: int
    name: str
    slug: str
    amc_code: Optional[str] = None
    fp_amc_id: Optional[str] = None
    is_active: bool
    admin_kill_switch: bool = False
    logo_url: Optional[str] = None


class MfAmcListResponse(BaseModel):
    amcs: list[MfAmcResponse]


class MfUpdateAmcRequest(BaseModel):
    is_active: Optional[bool] = None
    amc_code: Optional[str] = Field(default=None, max_length=32)
    admin_kill_switch: Optional[bool] = None
    reason: Optional[str] = Field(default=None, max_length=500)


class MfCatalogOverviewResponse(BaseModel):
    total_funds: int
    total_products: int
    active_products: int
    empanelled_amcs: int
    total_amcs: int
    total_categories: int
    nav_rows: int


class MfCategoryAdminResponse(BaseModel):
    id: int
    slug: str
    name: str
    fund_count: int
    active_fund_count: int
    display_order: int = 0
    is_visible: bool = True
    min_funds_to_show: int = 1


class MfCategoryAdminListResponse(BaseModel):
    categories: list[MfCategoryAdminResponse]


class MfUpdateCategoryRequest(BaseModel):
    name: Optional[str] = Field(default=None, max_length=128)
    is_visible: Optional[bool] = None
    display_order: Optional[int] = None
    min_funds_to_show: Optional[int] = Field(default=None, ge=0, le=1000)


class MfCategoryFundCurationItem(BaseModel):
    product_id: str
    fund_id: int
    scheme_name: str
    isin: Optional[str] = None
    amc_id: int
    amc_name: str
    lifecycle_status: str
    display_order: Optional[int] = None
    is_featured: bool = False
    featured_rank: Optional[int] = None
    effective_from: Optional[str] = None
    effective_until: Optional[str] = None
    return_3y: Optional[float] = None
    rank_position: Optional[int] = None
    amc_logo_url: Optional[str] = None


class MfCategoryFundsCurationResponse(BaseModel):
    category: MfCategoryAdminResponse
    items: list[MfCategoryFundCurationItem]


class MfCategoryFundOrderItemRequest(BaseModel):
    product_id: str
    display_order: Optional[int] = None
    is_featured: bool = False
    featured_rank: Optional[int] = None
    effective_from: Optional[str] = None
    effective_until: Optional[str] = None


class MfSetCategoryOrderRequest(BaseModel):
    items: list[MfCategoryFundOrderItemRequest]


class MfAddCategoryFundRequest(BaseModel):
    product_id: str
    display_order: Optional[int] = None
    is_featured: bool = False
    featured_rank: Optional[int] = None


class MfBulkAddAmcFundsRequest(BaseModel):
    amc_id: int = Field(ge=1)


class MfBulkAddAmcFundsResponse(BaseModel):
    added: int
    category: MfCategoryFundsCurationResponse


class MfCatalogHealthCheckResponse(BaseModel):
    key: str
    severity: str
    label: str
    count: int


class MfCatalogHealthSummaryResponse(BaseModel):
    generated_at: str
    config: dict
    summary: dict
    checks: list[MfCatalogHealthCheckResponse]
    amc_zero_active: list[dict] = Field(default_factory=list)


class MfCatalogHealthIssueResponse(BaseModel):
    check: Optional[str] = None
    fund_id: Optional[int] = None
    product_id: Optional[str] = None
    scheme_name: Optional[str] = None
    amc_id: Optional[int] = None
    amc_name: Optional[str] = None
    health_flags: list[str] = Field(default_factory=list)
    latest_nav_date: Optional[str] = None
    nav_row_count: Optional[int] = None
    public_blocked: Optional[bool] = None


class MfCatalogHealthIssueListResponse(BaseModel):
    items: list[MfCatalogHealthIssueResponse]
    page: int
    page_size: int
    total: int
    has_more: bool


class MfFundAdminResponse(BaseModel):
    fund_id: int
    product_id: Optional[str] = None
    product_code: Optional[str] = None
    scheme_name: str
    isin: Optional[str] = None
    scheme_code: Optional[str] = None
    amc_id: int
    amc_name: str
    amc_slug: str
    amc_logo_url: Optional[str] = None
    amc_empanelled: bool
    category_slug: Optional[str] = None
    category_name: Optional[str] = None
    lifecycle_status: Optional[str] = None
    fund_active: bool
    fp_oms_purchase_allowed: Optional[bool] = None
    fp_oms_active: Optional[bool] = None
    fp_scheme_id: Optional[str] = None
    sebi_category: Optional[str] = None
    min_sip_amount_inr: Optional[float] = None
    min_lumpsum_amount_inr: Optional[float] = None
    return_3y: Optional[float] = None
    rank_position: Optional[int] = None
    latest_nav: Optional[float] = None
    latest_nav_date: Optional[str] = None
    nav_row_count: Optional[int] = None
    catalog_flags: list[str] = Field(default_factory=list)
    health_flags: list[str] = Field(default_factory=list)
    admin_visibility: Optional[str] = None
    admin_investability: Optional[str] = None
    disabled_reason: Optional[str] = None
    disabled_at: Optional[str] = None
    is_visible: bool = False
    is_investable: bool = False
    amc_kill_switch: bool = False


class MfFundAdminListResponse(BaseModel):
    items: list[MfFundAdminResponse]
    page: int
    page_size: int
    total: int
    has_more: bool


class MfFundReturnsResponse(BaseModel):
    return_1d: Optional[float] = None
    return_1w: Optional[float] = None
    return_1m: Optional[float] = None
    return_3m: Optional[float] = None
    return_6m: Optional[float] = None
    return_1y: Optional[float] = None
    return_3y: Optional[float] = None
    return_5y: Optional[float] = None


class MfFundAdminDetailResponse(MfFundAdminResponse):
    returns: MfFundReturnsResponse
    metrics_as_of: Optional[str] = None


class MfNavPointResponse(BaseModel):
    date: str
    nav: Optional[float] = None


class MfFundNavHistoryResponse(BaseModel):
    fund_id: int
    from_date: str
    to_date: str
    count: int
    points: list[MfNavPointResponse]


class MfUpdateFundRequest(BaseModel):
    is_active: Optional[bool] = None
    admin_visibility: Optional[Literal["AUTO", "FORCE_SHOW", "FORCE_HIDE"]] = None
    admin_investability: Optional[Literal["AUTO", "BLOCK_ORDERS"]] = None
    reason: Optional[str] = Field(default=None, max_length=500)


class MfProductContentResponse(BaseModel):
    tagline: Optional[str] = None
    hero_badge: Optional[str] = None
    risk_label: Optional[str] = None
    benchmark_name: Optional[str] = None
    fund_manager_name: Optional[str] = None
    disclaimer_text: Optional[str] = None
    seo_slug: Optional[str] = None
    seo_meta_description: Optional[str] = None
    updated_at: Optional[str] = None


class MfFundContentResponse(BaseModel):
    fund_id: int
    product_id: Optional[str] = None
    content: MfProductContentResponse


class MfUpdateFundContentRequest(BaseModel):
    tagline: Optional[str] = Field(default=None, max_length=256)
    hero_badge: Optional[str] = Field(default=None, max_length=64)
    risk_label: Optional[str] = Field(default=None, max_length=64)
    benchmark_name: Optional[str] = Field(default=None, max_length=255)
    fund_manager_name: Optional[str] = Field(default=None, max_length=255)
    disclaimer_text: Optional[str] = Field(default=None, max_length=4000)
    seo_slug: Optional[str] = Field(default=None, max_length=128)
    seo_meta_description: Optional[str] = Field(default=None, max_length=512)


class MfAmcContentFieldsResponse(BaseModel):
    marketing_name: Optional[str] = None
    description: Optional[str] = None
    website_url: Optional[str] = None
    updated_at: Optional[str] = None


class MfAmcContentResponse(BaseModel):
    amc_id: int
    amc_name: str
    content: MfAmcContentFieldsResponse


class MfUpdateAmcContentRequest(BaseModel):
    marketing_name: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = Field(default=None, max_length=4000)
    website_url: Optional[str] = Field(default=None, max_length=512)


class MfComplianceSettingsResponse(BaseModel):
    default_disclaimer: str
    distributor_arn: Optional[str] = None
    distributor_euin: Optional[str] = None
    updated_at: Optional[str] = None
    source: dict[str, str]


class MfUpdateComplianceSettingsRequest(BaseModel):
    default_disclaimer: Optional[str] = Field(default=None, max_length=4000)
    distributor_arn: Optional[str] = Field(default=None, max_length=64)
    distributor_euin: Optional[str] = Field(default=None, max_length=64)
    clear_default_disclaimer: bool = False
    clear_distributor_arn: bool = False
    clear_distributor_euin: bool = False


class MfCatalogRuleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    priority: int
    enabled: bool
    conditions: dict
    actions: dict
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class MfCatalogRuleListResponse(BaseModel):
    rules: list[MfCatalogRuleResponse]


class MfCreateCatalogRuleRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: Optional[str] = Field(default=None, max_length=2000)
    priority: int = 100
    enabled: bool = False
    conditions: dict
    actions: dict


class MfUpdateCatalogRuleRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    description: Optional[str] = Field(default=None, max_length=2000)
    priority: Optional[int] = None
    enabled: Optional[bool] = None
    conditions: Optional[dict] = None
    actions: Optional[dict] = None


class MfCatalogRulesPreviewRequest(BaseModel):
    rule_ids: Optional[list[int]] = None


class MfCatalogRulesPreviewResponse(BaseModel):
    affected_count: int
    items: list[dict]
    rules: list[MfCatalogRuleResponse]
    run_id: Optional[int] = None
    pending_action_id: Optional[str] = None


class MfCatalogRulesApplyRequest(BaseModel):
    rule_ids: Optional[list[int]] = None
    dry_run: bool = False
    reason: Optional[str] = Field(default=None, max_length=500)


class MfBulkCatalogPreviewRequest(BaseModel):
    csv: str = Field(min_length=1)


class MfBulkCatalogSubmitRequest(BaseModel):
    csv: str = Field(min_length=1)
    dry_run: bool = True
    reason: Optional[str] = Field(default=None, max_length=500)


class MfBulkCatalogJobResponse(BaseModel):
    job_id: str
    status: str
    dry_run: Optional[bool] = None
    row_count: Optional[int] = None
    affected_count: Optional[int] = None
    result: Optional[dict] = None
    failure_reason: Optional[str] = None
    admin_action_id: Optional[str] = None
    requires_maker_checker: Optional[bool] = None
    preview: Optional[dict] = None
    created_at: Optional[str] = None
    completed_at: Optional[str] = None


class MfBulkCatalogJobListResponse(BaseModel):
    jobs: list[MfBulkCatalogJobResponse]


class MfStagingBatchStatsResponse(BaseModel):
    pages: int = 0
    raw_rows: int = 0
    normalized: int = 0
    excluded: int = 0
    invalid: int = 0
    promoted: int = 0
    updated: int = 0
    inserted: int = 0
    skipped: int = 0


class MfStagingBatchResponse(BaseModel):
    batch_uuid: str
    source: Optional[str] = None
    status: str
    triggered_by: Optional[str] = None
    stats: MfStagingBatchStatsResponse = Field(default_factory=MfStagingBatchStatsResponse)
    validation_errors: list[str] = Field(default_factory=list)
    rejection_reason: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    created_at: Optional[str] = None
    finished_at: Optional[str] = None


class MfStagingBatchListResponse(BaseModel):
    batches: list[MfStagingBatchResponse]


class MfStagingRowResponse(BaseModel):
    mongo_id: Optional[str] = None
    isin_growth: Optional[str] = None
    scheme_name: Optional[str] = None
    amc_name: Optional[str] = None
    validation_status: Optional[str] = None
    validation_reason: Optional[str] = None
    validation_flags: list[str] = Field(default_factory=list)
    promote_status: Optional[str] = None
    product_id: Optional[str] = None
    fund_id: Optional[int] = None
    amc_id: Optional[int] = None
    promote_error: Optional[str] = None


class MfStagingRowListResponse(BaseModel):
    items: list[MfStagingRowResponse]
    page: int
    page_size: int
    total: int
    has_more: bool


class MfStagingRejectRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class MfTransactionOverviewResponse(BaseModel):
    order_counts: dict[str, int] = Field(default_factory=dict)
    stuck_orders: int
    stuck_checkouts: int
    stuck_mandates: int
    stuck_sip_plans: int
    failed_orders_24h: int
    failed_webhooks_24h: int
    stuck_threshold_minutes: int
    payment_expiry_minutes: int


class MfTransactionOrderListResponse(BaseModel):
    orders: list[dict[str, Any]]


class MfTransactionSipPlanListResponse(BaseModel):
    plans: list[dict[str, Any]]


class MfTransactionMandateListResponse(BaseModel):
    mandates: list[dict[str, Any]]
    summary: dict[str, int] = Field(default_factory=dict)


class MfTransactionCheckoutListResponse(BaseModel):
    checkouts: list[dict[str, Any]]


class MfTransactionSipBatchListResponse(BaseModel):
    batches: list[dict[str, Any]]


class MfTransactionOrderDetailResponse(BaseModel):
    order: dict[str, Any]
    events: list[dict[str, Any]] = Field(default_factory=list)


class MfTransactionWebhookListResponse(BaseModel):
    events: list[dict[str, Any]]


class MfTransactionReconcileResponse(BaseModel):
    synced: Optional[bool] = None
    advanced: Optional[bool] = None
    order: Optional[dict[str, Any]] = None
    plan: Optional[dict[str, Any]] = None
    mandate: Optional[dict[str, Any]] = None


class MfTransactionWebhookReplayResponse(BaseModel):
    status: str
    event_id: int
    event_type: str
    handled: bool


class MfTransactionReplayResponse(BaseModel):
    expired_checkouts: Optional[int] = None
    processed: Optional[int] = None
    replayed: Optional[int] = None


class MfIntegrationEnvironmentUpdateRequest(BaseModel):
    environment: Literal["test", "live"]


class MfIntegrationProviderResponse(BaseModel):
    id: Literal["finprim", "cybrilla", "kyckart"]
    active_environment: Literal["test", "live"]
    active_configured: bool
    profiles: dict[str, dict[str, Any]]
    notes: list[str] = Field(default_factory=list)


class MfIntegrationsListResponse(BaseModel):
    items: list[MfIntegrationProviderResponse]


class AdminInvitationResponse(BaseModel):
    id: UUID
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role_key: str
    role_name: Optional[str] = None
    status: str
    invited_by: Optional[UUID] = None
    inviter_name: Optional[str] = None
    accepted_user_id: Optional[UUID] = None
    expires_at: datetime
    accepted_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class AdminInvitationListResponse(BaseModel):
    items: list[AdminInvitationResponse]


class CreateAdminInvitationRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    role_key: str = Field(min_length=2, max_length=64)
    first_name: Optional[str] = Field(default=None, max_length=50)
    last_name: Optional[str] = Field(default=None, max_length=50)
