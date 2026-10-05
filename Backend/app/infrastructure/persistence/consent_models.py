from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ConsentChannel(str, enum.Enum):
    web = "web"
    distributor = "distributor"
    all = "all"


class ConsentAcceptanceMode(str, enum.Enum):
    explicit_checkbox = "explicit_checkbox"
    implicit_proceed = "implicit_proceed"


class ConsentReacceptPolicy(str, enum.Enum):
    on_new_version = "on_new_version"
    never = "never"


class ConsentVersionStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    archived = "archived"


class UserConsentAction(str, enum.Enum):
    accepted = "accepted"
    revoked = "revoked"


class ConsentDefinition(Base):
    __tablename__ = "consent_definitions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    channel: Mapped[ConsentChannel] = mapped_column(
        Enum(ConsentChannel, name="consentchannel"),
        default=ConsentChannel.all,
        nullable=False,
    )
    acceptance_mode: Mapped[ConsentAcceptanceMode] = mapped_column(
        Enum(ConsentAcceptanceMode, name="consentacceptancemode"),
        default=ConsentAcceptanceMode.explicit_checkbox,
        nullable=False,
    )
    reaccept_policy: Mapped[ConsentReacceptPolicy] = mapped_column(
        Enum(ConsentReacceptPolicy, name="consentreacceptpolicy"),
        default=ConsentReacceptPolicy.on_new_version,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    versions: Mapped[list["ConsentVersion"]] = relationship(
        back_populates="definition",
        cascade="all, delete-orphan",
    )


class ConsentVersion(Base):
    __tablename__ = "consent_versions"
    __table_args__ = (
        UniqueConstraint("consent_definition_id", "version_label", name="uq_consent_version_label"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    consent_definition_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("consent_definitions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_label: Mapped[str] = mapped_column(String(64), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[ConsentVersionStatus] = mapped_column(
        Enum(ConsentVersionStatus, name="consentversionstatus"),
        default=ConsentVersionStatus.draft,
        nullable=False,
        index=True,
    )
    summary_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    body_markdown: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    document_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    published_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    definition: Mapped["ConsentDefinition"] = relationship(back_populates="versions")


class UserConsentRecord(Base):
    __tablename__ = "user_consent_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    consent_definition_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("consent_definitions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    consent_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("consent_versions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    action: Mapped[UserConsentAction] = mapped_column(
        Enum(UserConsentAction, name="userconsentaction"),
        nullable=False,
    )
    source: Mapped[str] = mapped_column(String(64), nullable=False, default="unknown")
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    device_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    definition: Mapped["ConsentDefinition"] = relationship()
    version: Mapped["ConsentVersion"] = relationship()
