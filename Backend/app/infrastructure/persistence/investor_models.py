"""Cybrilla investor profile objects — provisioned at first MF/payment flow (future).

Maps to Finprim v2 resources: investor_profile, bank_accounts, addresses,
email_addresses, phone_numbers, related_parties.
"""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
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


class InvestorProfileStatus(str, enum.Enum):
    """Local lifecycle before/after Cybrilla invp_* exists."""

    pending = "pending"
    provisioning = "provisioning"
    active = "active"
    failed = "failed"


class InvestorProvisionTrigger(str, enum.Enum):
    """What initiated Cybrilla profile creation (set when MF/payments land)."""

    payment = "payment"
    mf_order = "mf_order"
    mf_sip = "mf_sip"
    manual = "manual"


class InvestorObjectSyncStatus(str, enum.Enum):
    draft = "draft"
    pending_create = "pending_create"
    active = "active"
    failed = "failed"


class InvestorObjectSource(str, enum.Enum):
    kyc = "kyc"
    user = "user"
    cybrilla = "cybrilla"


class InvestorBankVerificationStatus(str, enum.Enum):
    pending = "pending"
    verified = "verified"
    manual_required = "manual_required"
    failed = "failed"


class InvestorProfile(Base):
    """One Cybrilla investor profile per Zynd user (invp_*)."""

    __tablename__ = "investor_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    external_profile_id: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True)
    external_old_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[InvestorProfileStatus] = mapped_column(
        Enum(InvestorProfileStatus),
        default=InvestorProfileStatus.pending,
        nullable=False,
    )
    provision_trigger: Mapped[Optional[InvestorProvisionTrigger]] = mapped_column(
        Enum(InvestorProvisionTrigger),
        nullable=True,
    )
    provider: Mapped[str] = mapped_column(String(32), default="cybrilla_fp", nullable=False)
    failure_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    failure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    provisioned_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="investor_profile")
    bank_accounts: Mapped[list["InvestorBankAccount"]] = relationship(
        back_populates="investor_profile",
        cascade="all, delete-orphan",
    )
    addresses: Mapped[list["InvestorAddress"]] = relationship(
        back_populates="investor_profile",
        cascade="all, delete-orphan",
    )
    email_addresses: Mapped[list["InvestorEmailAddress"]] = relationship(
        back_populates="investor_profile",
        cascade="all, delete-orphan",
    )
    phone_numbers: Mapped[list["InvestorPhoneNumber"]] = relationship(
        back_populates="investor_profile",
        cascade="all, delete-orphan",
    )
    related_parties: Mapped[list["InvestorRelatedParty"]] = relationship(
        back_populates="investor_profile",
        cascade="all, delete-orphan",
    )


class InvestorBankAccount(Base):
    __tablename__ = "investor_bank_accounts"
    __table_args__ = (
        UniqueConstraint(
            "investor_profile_id",
            "account_number_last4",
            "ifsc_code",
            name="uq_investor_bank_account_fingerprint",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    investor_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("investor_profiles.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    external_bank_account_id: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True)
    external_old_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sync_status: Mapped[InvestorObjectSyncStatus] = mapped_column(
        Enum(InvestorObjectSyncStatus),
        default=InvestorObjectSyncStatus.draft,
        nullable=False,
    )
    source: Mapped[InvestorObjectSource] = mapped_column(
        Enum(InvestorObjectSource),
        default=InvestorObjectSource.kyc,
        nullable=False,
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    account_type: Mapped[str] = mapped_column(String(32), nullable=False)
    account_number_last4: Mapped[str] = mapped_column(String(4), nullable=False)
    ifsc_code: Mapped[str] = mapped_column(String(11), nullable=False)
    primary_account_holder_name: Mapped[str] = mapped_column(String(120), nullable=False)
    bank_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    branch_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    cancelled_cheque_file_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    poa_preverify_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    pan_account_holder_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    verification_status: Mapped[InvestorBankVerificationStatus] = mapped_column(
        Enum(InvestorBankVerificationStatus),
        default=InvestorBankVerificationStatus.pending,
        nullable=False,
    )
    verification_failure_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    account_number_ciphertext: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    account_number_key_version: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    failure_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    failure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    external_payload_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    investor_profile: Mapped[InvestorProfile] = relationship(back_populates="bank_accounts")


class InvestorAddress(Base):
    __tablename__ = "investor_addresses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    investor_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("investor_profiles.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    external_address_id: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True)
    sync_status: Mapped[InvestorObjectSyncStatus] = mapped_column(
        Enum(InvestorObjectSyncStatus),
        default=InvestorObjectSyncStatus.draft,
        nullable=False,
    )
    source: Mapped[InvestorObjectSource] = mapped_column(
        Enum(InvestorObjectSource),
        default=InvestorObjectSource.kyc,
        nullable=False,
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    nature: Mapped[str] = mapped_column(String(32), default="residential", nullable=False)
    line1: Mapped[str] = mapped_column(String(255), nullable=False)
    line2: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    line3: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    postal_code: Mapped[str] = mapped_column(String(16), nullable=False)
    country: Mapped[str] = mapped_column(String(8), default="IN", nullable=False)
    external_payload_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    investor_profile: Mapped[InvestorProfile] = relationship(back_populates="addresses")


class InvestorEmailAddress(Base):
    __tablename__ = "investor_email_addresses"
    __table_args__ = (
        UniqueConstraint("investor_profile_id", "email", name="uq_investor_profile_email"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    investor_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("investor_profiles.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    external_email_id: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True)
    sync_status: Mapped[InvestorObjectSyncStatus] = mapped_column(
        Enum(InvestorObjectSyncStatus),
        default=InvestorObjectSyncStatus.draft,
        nullable=False,
    )
    source: Mapped[InvestorObjectSource] = mapped_column(
        Enum(InvestorObjectSource),
        default=InvestorObjectSource.user,
        nullable=False,
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email: Mapped[str] = mapped_column(String(254), nullable=False)
    belongs_to: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    external_payload_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    investor_profile: Mapped[InvestorProfile] = relationship(back_populates="email_addresses")


class InvestorPhoneNumber(Base):
    __tablename__ = "investor_phone_numbers"
    __table_args__ = (
        UniqueConstraint("investor_profile_id", "isd", "number", name="uq_investor_profile_phone"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    investor_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("investor_profiles.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    external_phone_id: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True)
    sync_status: Mapped[InvestorObjectSyncStatus] = mapped_column(
        Enum(InvestorObjectSyncStatus),
        default=InvestorObjectSyncStatus.draft,
        nullable=False,
    )
    source: Mapped[InvestorObjectSource] = mapped_column(
        Enum(InvestorObjectSource),
        default=InvestorObjectSource.user,
        nullable=False,
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    isd: Mapped[str] = mapped_column(String(8), nullable=False)
    number: Mapped[str] = mapped_column(String(20), nullable=False)
    belongs_to: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    external_payload_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    investor_profile: Mapped[InvestorProfile] = relationship(back_populates="phone_numbers")


class InvestorRelatedParty(Base):
    """Nominee / related party (Cybrilla relp_*)."""

    __tablename__ = "investor_related_parties"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    investor_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("investor_profiles.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    external_related_party_id: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True)
    local_nominee_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    sync_status: Mapped[InvestorObjectSyncStatus] = mapped_column(
        Enum(InvestorObjectSyncStatus),
        default=InvestorObjectSyncStatus.draft,
        nullable=False,
    )
    source: Mapped[InvestorObjectSource] = mapped_column(
        Enum(InvestorObjectSource),
        default=InvestorObjectSource.kyc,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    party_relationship: Mapped[str] = mapped_column(String(64), nullable=False)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    pan: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    guardian_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    guardian_pan: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    share_percent: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    external_payload_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    investor_profile: Mapped[InvestorProfile] = relationship(back_populates="related_parties")
