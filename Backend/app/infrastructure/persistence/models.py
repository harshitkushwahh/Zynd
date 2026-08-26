from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"


class UserStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    deletion_pending = "deletion_pending"
    deleted = "deleted"


class OAuthProvider(str, enum.Enum):
    google = "google"
    apple = "apple"


class AuditEventType(str, enum.Enum):
    login_success = "login_success"
    login_failure = "login_failure"
    new_device_login = "new_device_login"
    session_created = "session_created"
    session_revoked = "session_revoked"
    logout = "logout"
    password_reset_requested = "password_reset_requested"
    mfa_enrolled = "mfa_enrolled"
    mfa_challenge_success = "mfa_challenge_success"
    mfa_challenge_failure = "mfa_challenge_failure"
    backup_code_used = "backup_code_used"
    oauth_link_requested = "oauth_link_requested"
    oauth_link_confirmed = "oauth_link_confirmed"
    oauth_connected = "oauth_connected"
    oauth_disconnected = "oauth_disconnected"
    login_velocity_flagged = "login_velocity_flagged"
    sessions_revoked_all = "sessions_revoked_all"
    email_change_requested = "email_change_requested"
    email_changed = "email_changed"
    password_changed = "password_changed"
    fund_gate_blocked_mfa = "fund_gate_blocked_mfa"
    fund_gate_blocked_pin = "fund_gate_blocked_pin"
    fund_gate_blocked_contact = "fund_gate_blocked_contact"
    login_sms_otp_sent = "login_sms_otp_sent"
    login_sms_otp_verified = "login_sms_otp_verified"
    step_up_sms_sent = "step_up_sms_sent"
    step_up_sms_used = "step_up_sms_used"
    refresh_token_reuse_detected = "refresh_token_reuse_detected"
    account_deletion_requested = "account_deletion_requested"
    account_deletion_cancelled = "account_deletion_cancelled"
    account_deletion_executed = "account_deletion_executed"
    mfa_disabled = "mfa_disabled"
    account_suspended = "account_suspended"
    account_unsuspended = "account_unsuspended"
    admin_account_removed = "admin_account_removed"
    transfer_requested = "transfer_requested"
    admin_action_requested = "admin_action_requested"
    admin_action_approved = "admin_action_approved"
    admin_action_rejected = "admin_action_rejected"
    login_ip_blocked = "login_ip_blocked"
    adaptive_auth_blocked = "adaptive_auth_blocked"
    pin_set = "pin_set"
    pin_verify_success = "pin_verify_success"
    pin_verify_failed = "pin_verify_failed"
    pin_reset_requested = "pin_reset_requested"
    pin_reset = "pin_reset"
    pin_biometric_enrolled = "pin_biometric_enrolled"
    pin_biometric_unlock_success = "pin_biometric_unlock_success"
    pin_biometric_unlock_failed = "pin_biometric_unlock_failed"
    document_uploaded = "document_uploaded"
    document_scan_passed = "document_scan_passed"
    document_scan_failed = "document_scan_failed"
    document_quarantined = "document_quarantined"
    document_download_requested = "document_download_requested"
    document_viewed_by_admin = "document_viewed_by_admin"
    document_verified = "document_verified"
    document_legal_hold_updated = "document_legal_hold_updated"
    document_deleted = "document_deleted"
    document_kyc_rejected = "document_kyc_rejected"
    notification_dispatched = "notification_dispatched"
    notification_push_failed = "notification_push_failed"
    mf_fund_catalog_updated = "mf_fund_catalog_updated"
    mf_amc_catalog_updated = "mf_amc_catalog_updated"
    mf_category_catalog_updated = "mf_category_catalog_updated"
    mf_product_content_updated = "mf_product_content_updated"
    mf_amc_content_updated = "mf_amc_content_updated"
    mf_compliance_settings_updated = "mf_compliance_settings_updated"
    mf_catalog_rule_created = "mf_catalog_rule_created"
    mf_catalog_rule_updated = "mf_catalog_rule_updated"
    mf_catalog_rules_applied = "mf_catalog_rules_applied"
    mf_catalog_bulk_submitted = "mf_catalog_bulk_submitted"
    mf_catalog_bulk_executed = "mf_catalog_bulk_executed"
    risk_category_created = "risk_category_created"
    risk_category_updated = "risk_category_updated"
    risk_question_created = "risk_question_created"
    risk_question_updated = "risk_question_updated"
    risk_question_deleted = "risk_question_deleted"
    risk_tier_config_updated = "risk_tier_config_updated"
    risk_profile_completed = "risk_profile_completed"
    risk_profile_message_sent = "risk_profile_message_sent"
    risk_question_bulk_imported = "risk_question_bulk_imported"
    risk_template_created = "risk_template_created"
    risk_template_updated = "risk_template_updated"
    risk_profile_locked = "risk_profile_locked"
    risk_profile_unlock_granted = "risk_profile_unlock_granted"
    family_group_created = "family_group_created"
    family_group_updated = "family_group_updated"
    family_group_archived = "family_group_archived"
    family_group_invite_sent = "family_group_invite_sent"
    family_group_invite_accepted = "family_group_invite_accepted"
    family_group_invite_declined = "family_group_invite_declined"
    family_group_invite_revoked = "family_group_invite_revoked"
    family_group_member_role_changed = "family_group_member_role_changed"
    family_group_member_removed = "family_group_member_removed"
    family_group_member_left = "family_group_member_left"
    family_group_head_transferred = "family_group_head_transferred"
    family_group_nominee_kyc_invited = "family_group_nominee_kyc_invited"
    family_group_nominee_kyc_skipped = "family_group_nominee_kyc_skipped"


class DeletionEventType(str, enum.Enum):
    deletion_requested = "deletion_requested"
    deletion_cancelled = "deletion_cancelled"
    deletion_executed = "deletion_executed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True, nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20), unique=True, index=True, nullable=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    first_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    middle_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.user, nullable=False)
    country_code: Mapped[str] = mapped_column(String(5), default="IN", nullable=False)
    email_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    phone_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    mfa_enrolled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    mfa_required_for_funds: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    status: Mapped[UserStatus] = mapped_column(Enum(UserStatus), default=UserStatus.active, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    deletion_requested_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    deletion_scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    suspended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    suspension_reason_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    suspended_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    password_changed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    email_changed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    pin_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    pin_set_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    pin_failed_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pin_locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    client_id: Mapped[str] = mapped_column(
        String(128),
        unique=True,
        index=True,
        nullable=False,
        default=lambda: f"test-{uuid.uuid4().hex}@zynd",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    oauth_accounts: Mapped[list[OAuthAccount]] = relationship(back_populates="user")
    sessions: Mapped[list[Session]] = relationship(back_populates="user")
    devices: Mapped[list[Device]] = relationship(back_populates="user")
    audit_logs: Mapped[list[AuditLog]] = relationship(back_populates="user")
    mfa_secret: Mapped[Optional["UserMfaSecret"]] = relationship(back_populates="user", uselist=False)
    backup_codes: Mapped[list["UserBackupCode"]] = relationship(back_populates="user")
    documents: Mapped[list["UserDocument"]] = relationship(back_populates="user")
    kyc_journey_state: Mapped[Optional["KycJourneyState"]] = relationship(
        back_populates="user", uselist=False
    )
    kyc_status: Mapped[Optional["UserKycStatus"]] = relationship(back_populates="user", uselist=False)
    investor_profile: Mapped[Optional["InvestorProfile"]] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    notifications: Mapped[list["UserNotification"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    notification_preferences: Mapped[list["UserNotificationPreference"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    push_devices: Mapped[list["UserPushDevice"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"
    __table_args__ = (UniqueConstraint("provider", "provider_user_id", name="uq_oauth_provider_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[OAuthProvider] = mapped_column(Enum(OAuthProvider), nullable=False)
    provider_user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(254), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="oauth_accounts")


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (UniqueConstraint("user_id", "fingerprint_hash", name="uq_user_device_fingerprint"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    fingerprint_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    os: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    browser: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    is_trusted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped[User] = relationship(back_populates="devices")
    sessions: Mapped[list[Session]] = relationship(back_populates="device")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    device_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("devices.id", ondelete="SET NULL"), nullable=True
    )
    refresh_token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    token_family_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True, default=uuid.uuid4
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_used_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="sessions")
    device: Mapped[Optional["Device"]] = relationship(back_populates="sessions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    event_type: Mapped[AuditEventType] = mapped_column(Enum(AuditEventType), nullable=False, index=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    user: Mapped[Optional["User"]] = relationship(back_populates="audit_logs")


class UserMfaSecret(Base):
    __tablename__ = "user_mfa_secrets"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    secret_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)
    secret_key_version: Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="mfa_secret")


class UserBackupCode(Base):
    __tablename__ = "user_backup_codes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    code_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="backup_codes")


class OAuthLinkRequest(Base):
    __tablename__ = "oauth_link_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[OAuthProvider] = mapped_column(Enum(OAuthProvider), nullable=False)
    provider_user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    provider_email: Mapped[Optional[str]] = mapped_column(String(254), nullable=True)
    confirmation_token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class DeletionLedger(Base):
    __tablename__ = "deletion_ledger"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    event_type: Mapped[DeletionEventType] = mapped_column(Enum(DeletionEventType), nullable=False)
    retention_policy: Mapped[str] = mapped_column(String(64), nullable=False)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class SecurityReviewStatus(str, enum.Enum):
    open = "open"
    reviewed = "reviewed"
    dismissed = "dismissed"


class SecurityReviewReason(str, enum.Enum):
    new_device_login = "new_device_login"
    login_velocity_flagged = "login_velocity_flagged"


class SecurityReviewItem(Base):
    __tablename__ = "security_review_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reason: Mapped[SecurityReviewReason] = mapped_column(Enum(SecurityReviewReason), nullable=False, index=True)
    status: Mapped[SecurityReviewStatus] = mapped_column(
        Enum(SecurityReviewStatus), default=SecurityReviewStatus.open, nullable=False, index=True
    )
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    reviewer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    review_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    user: Mapped[User] = relationship(foreign_keys=[user_id])
    reviewer: Mapped[Optional[User]] = relationship(foreign_keys=[reviewer_id])


class DataRetentionSchedule(Base):
    __tablename__ = "data_retention_schedule"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    data_class: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    min_retention_days: Mapped[int] = mapped_column(Integer, nullable=False)
    legal_basis: Mapped[str] = mapped_column(String(128), nullable=False)
    can_delete_on_request: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class PIIFieldTypeEnum(str, enum.Enum):
    pan = "pan"
    aadhaar = "aadhaar"
    bank_account = "bank_account"


class EncryptedPIIRecord(Base):
    __tablename__ = "encrypted_pii_records"
    __table_args__ = (UniqueConstraint("user_id", "field_type", name="uq_encrypted_pii_user_field"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    field_type: Mapped[PIIFieldTypeEnum] = mapped_column(Enum(PIIFieldTypeEnum), nullable=False)
    ciphertext: Mapped[str] = mapped_column(Text, nullable=False)
    key_version: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped[User] = relationship()


class AdminPermission(Base):
    __tablename__ = "admin_permissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(255), nullable=False)


class AdminRole(Base):
    __tablename__ = "admin_roles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)


class AdminRolePermission(Base):
    __tablename__ = "admin_role_permissions"
    __table_args__ = (UniqueConstraint("role_id", "permission_id", name="uq_admin_role_permission"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admin_roles.id", ondelete="CASCADE"), nullable=False
    )
    permission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admin_permissions.id", ondelete="CASCADE"), nullable=False
    )


class AdminUserRoleAssignment(Base):
    __tablename__ = "admin_user_role_assignments"
    __table_args__ = (UniqueConstraint("user_id", "role_id", name="uq_admin_user_role"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admin_roles.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AdminActionType(str, enum.Enum):
    account_suspend = "account_suspend"
    account_unsuspend = "account_unsuspend"
    encryption_rotate_mfa = "encryption_rotate_mfa"
    deletion_executor_run = "deletion_executor_run"
    security_config_update = "security_config_update"
    mf_catalog_bulk_apply = "mf_catalog_bulk_apply"
    mf_catalog_rules_apply = "mf_catalog_rules_apply"


class AdminActionStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    expired = "expired"


class AdminActionRequest(Base):
    __tablename__ = "admin_action_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    action_type: Mapped[AdminActionType] = mapped_column(Enum(AdminActionType), nullable=False, index=True)
    status: Mapped[AdminActionStatus] = mapped_column(
        Enum(AdminActionStatus), default=AdminActionStatus.pending, nullable=False, index=True
    )
    target_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    target_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    requested_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    rejection_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    requester: Mapped[User] = relationship(foreign_keys=[requested_by])
    approver: Mapped[Optional[User]] = relationship(foreign_keys=[approved_by])


class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(254), nullable=False, index=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True, index=True)
    success: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    failure_reason: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    captcha_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )


class SecurityConfig(Base):
    __tablename__ = "security_config"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    value: Mapped[dict] = mapped_column(JSONB, nullable=False)
    scope: Mapped[str] = mapped_column(String(64), default="global", nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class SecurityConfigHistory(Base):
    __tablename__ = "security_config_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    config_key: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    old_value: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    new_value: Mapped[dict] = mapped_column(JSONB, nullable=False)
    changed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )


class WebAuthnCredentialPurpose(str, enum.Enum):
    passkey = "passkey"
    pin_biometric = "pin_biometric"


class WebAuthnCredential(Base):
    __tablename__ = "webauthn_credentials"
    __table_args__ = (UniqueConstraint("credential_id", name="uq_webauthn_credential_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    credential_id: Mapped[str] = mapped_column(String(512), nullable=False)
    public_key: Mapped[str] = mapped_column(Text, nullable=False)
    sign_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    device_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    purpose: Mapped[WebAuthnCredentialPurpose] = mapped_column(
        Enum(WebAuthnCredentialPurpose, native_enum=False, length=32),
        default=WebAuthnCredentialPurpose.passkey,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship()


class OutboxEventStatus(str, enum.Enum):
    pending = "pending"
    published = "published"
    failed = "failed"


class OutboxEvent(Base):
    __tablename__ = "outbox_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[str] = mapped_column(String(36), unique=True, nullable=False, index=True)
    stream: Mapped[str] = mapped_column(String(128), nullable=False)
    event_type: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[OutboxEventStatus] = mapped_column(
        Enum(OutboxEventStatus), default=OutboxEventStatus.pending, nullable=False, index=True
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class ProcessedDomainEvent(Base):
    __tablename__ = "processed_domain_events"

    event_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    processed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class DocumentType(str, enum.Enum):
    aadhaar = "aadhaar"
    pan = "pan"
    profile_image = "profile_image"
    bank_statement = "bank_statement"
    signature = "signature"
    address_proof = "address_proof"
    nominee_id = "nominee_id"
    family_group_avatar = "family_group_avatar"


class KycReviewStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class DocumentStatus(str, enum.Enum):
    pending_scan = "pending_scan"
    active = "active"
    rejected = "rejected"
    quarantined = "quarantined"


class DocumentStorageProvider(str, enum.Enum):
    local = "local"
    s3 = "s3"


class UserDocument(Base):
    __tablename__ = "user_documents"
    __table_args__ = (
        UniqueConstraint("user_id", "doc_type", "version", name="uq_user_documents_type_version"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    client_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    doc_type: Mapped[DocumentType] = mapped_column(Enum(DocumentType), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(127), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    storage_provider: Mapped[DocumentStorageProvider] = mapped_column(
        Enum(DocumentStorageProvider), nullable=False
    )
    storage_bucket: Mapped[str] = mapped_column(String(128), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus), default=DocumentStatus.pending_scan, nullable=False
    )
    immutable_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    legal_hold: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deletion_scheduled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    kyc_review_status: Mapped[Optional["KycReviewStatus"]] = mapped_column(
        Enum(KycReviewStatus), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="documents")


class KycStepStatus(str, enum.Enum):
    pending = "pending"
    verified = "verified"
    failed = "failed"
    skipped = "skipped"
    saved = "saved"


class KycOverallStatus(str, enum.Enum):
    none = "none"
    in_progress = "in_progress"
    phase1_complete = "phase1_complete"
    phase2_complete = "phase2_complete"
    submitted = "submitted"
    completed = "completed"


class KycJourneyState(Base):
    __tablename__ = "kyc_journey_states"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    last_completed_step: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    pan_draft_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    contact_draft_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    personal_draft_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    kyc_already_registered: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    readiness_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    readiness_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pan_verification_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    pan_verification_failure_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    external_kyc_request_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    external_identity_document_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    external_kyc_status: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    digilocker_failure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    poa_readiness_preverify_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    poa_pan_preverify_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    nominee_draft_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    bank_draft_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    poa_bank_preverify_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    poa_bank_proof_file_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    bank_verification_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    bank_verification_failure_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    signature_draft_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    external_kyc_form_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    kyc_form_status: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    kyc_form_type: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    kyc_form_failure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    proof_details_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    esign_details_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    geolocation_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="kyc_journey_state")


class UserKycStatus(Base):
    __tablename__ = "user_kyc_status"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    pan_step_status: Mapped[KycStepStatus] = mapped_column(
        Enum(KycStepStatus), default=KycStepStatus.pending, nullable=False
    )
    digilocker_step_status: Mapped[KycStepStatus] = mapped_column(
        Enum(KycStepStatus), default=KycStepStatus.pending, nullable=False
    )
    address_step_status: Mapped[KycStepStatus] = mapped_column(
        Enum(KycStepStatus), default=KycStepStatus.pending, nullable=False
    )
    personal_step_status: Mapped[KycStepStatus] = mapped_column(
        Enum(KycStepStatus), default=KycStepStatus.pending, nullable=False
    )
    nominee_step_status: Mapped[KycStepStatus] = mapped_column(
        Enum(KycStepStatus), default=KycStepStatus.pending, nullable=False
    )
    bank_step_status: Mapped[KycStepStatus] = mapped_column(
        Enum(KycStepStatus), default=KycStepStatus.pending, nullable=False
    )
    signature_step_status: Mapped[KycStepStatus] = mapped_column(
        Enum(KycStepStatus), default=KycStepStatus.pending, nullable=False
    )
    review_step_status: Mapped[KycStepStatus] = mapped_column(
        Enum(KycStepStatus), default=KycStepStatus.pending, nullable=False
    )
    overall_status: Mapped[KycOverallStatus] = mapped_column(
        Enum(KycOverallStatus), default=KycOverallStatus.none, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="kyc_status")


class AdminInvitationStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    revoked = "revoked"
    expired = "expired"


class AdminInvitation(Base):
    __tablename__ = "admin_invitations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(254), index=True, nullable=False)
    first_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    role_key: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[AdminInvitationStatus] = mapped_column(
        Enum(AdminInvitationStatus),
        default=AdminInvitationStatus.pending,
        nullable=False,
        index=True,
    )
    invited_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    accepted_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


from app.infrastructure.persistence import distributor_partner_models as _distributor_partner_models  # noqa: F401,E402
from app.infrastructure.persistence import distributor_branch_models as _distributor_branch_models  # noqa: F401,E402
from app.infrastructure.persistence import distributor_state_head_models as _distributor_state_head_models  # noqa: F401,E402
from app.infrastructure.persistence import distributor_work_models as _distributor_work_models  # noqa: F401,E402
from app.infrastructure.persistence import family_group_models as _family_group_models  # noqa: F401,E402
from app.infrastructure.persistence import investor_models as _investor_profile_models  # noqa: F401,E402
from app.infrastructure.persistence import mf_models as _mf_models  # noqa: F401,E402
from app.infrastructure.persistence import mf_transaction_models as _mf_transaction_models  # noqa: F401,E402
from app.infrastructure.persistence import notification_models as _notification_models  # noqa: F401,E402
from app.infrastructure.persistence import referral_models as _referral_models  # noqa: F401,E402
from app.infrastructure.persistence import referral_reward_models as _referral_reward_models  # noqa: F401,E402

