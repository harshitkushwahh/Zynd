"""Zero-Touch Lookup (ZTO) persistence  consents, encrypted fetches, registry, approved profile."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ZtoConsentRecord(Base):
    __tablename__ = "zto_consent_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    purpose: Mapped[str] = mapped_column(String(48), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    mode: Mapped[str] = mapped_column(String(24), nullable=False, default="checkbox")
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    signup_correlation_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ZtoLookupFetch(Base):
    __tablename__ = "zto_lookup_fetches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)  # bank | customer
    fp_lookup_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    source_ref_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending")
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    lookup_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    payload_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    key_version: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ZtoPhoneRegistry(Base):
    """Cybrilla limits: bank once per phone; customer once per phone + normalized name."""

    __tablename__ = "zto_phone_registry"
    __table_args__ = (
        Index(
            "uq_zto_phone_registry_bank",
            "phone",
            unique=True,
            postgresql_where=text("lookup_kind = 'bank'"),
        ),
        Index(
            "uq_zto_phone_registry_customer",
            "phone",
            "normalized_name",
            unique=True,
            postgresql_where=text("lookup_kind = 'customer'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lookup_kind: Mapped[str] = mapped_column(String(16), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    normalized_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    fetch_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("zto_lookup_fetches.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ZtoApprovedProfile(Base):
    """User-accepted snapshot used only for wizard input prefill (never written to KYC journey)."""

    __tablename__ = "zto_approved_profile"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    accepted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    bank_lookup_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("zto_lookup_fetches.id", ondelete="SET NULL"), nullable=True
    )
    customer_lookup_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("zto_lookup_fetches.id", ondelete="SET NULL"), nullable=True
    )

    name_from_lookup: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    name_approved: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    name_edited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    pan_from_lookup: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    pan_approved: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    pan_edited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    dob_from_lookup: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    dob_approved: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    dob_edited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    bank_account_from_lookup: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    bank_account_approved: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    bank_account_edited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    ifsc_from_lookup: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    ifsc_approved: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    ifsc_edited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    address_from_lookup: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    address_approved: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    address_edited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ZtoUserFlow(Base):
    __tablename__ = "zto_user_flow"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    phase: Mapped[str] = mapped_column(String(32), nullable=False, default="LOOKUP_PENDING")
    declined_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    signup_display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
