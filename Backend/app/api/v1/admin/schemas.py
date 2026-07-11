from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


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


class AdminRolesResponse(BaseModel):
    roles: list[AdminRoleResponse]


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
    email: str
    status: str
    role: str
    suspended_at: Optional[datetime] = None
    suspension_reason_code: Optional[str] = None
    mfa_enrolled: bool
    created_at: datetime


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
    email: str
    status: str
    role: str
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
