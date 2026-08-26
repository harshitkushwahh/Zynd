from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DistributorPartnerStatus(str, enum.Enum):
    pending_ho_review = "pending_ho_review"
    pending_password = "pending_password"
    active = "active"
    rejected = "rejected"


class DistributorClientLink(Base):
    """Investor book entry: one investor client attached to one Zynd Mitra code."""

    __tablename__ = "distributor_client_links"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=False,
    )
    mitra_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    mitra_client_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    branch_id: Mapped[Optional[str]] = mapped_column(
        String(32),
        ForeignKey("distributor_branches.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    onboarded_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class DistributorPartner(Base):
    __tablename__ = "distributor_partners"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    onboarded_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    branch_id: Mapped[Optional[str]] = mapped_column(
        String(32),
        ForeignKey("distributor_branches.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    pan_masked: Mapped[Optional[str]] = mapped_column(String(12), nullable=True)
    profile_payload: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    status: Mapped[DistributorPartnerStatus] = mapped_column(
        Enum(DistributorPartnerStatus),
        default=DistributorPartnerStatus.pending_ho_review,
        nullable=False,
        index=True,
    )
    arn: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    euin: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    ho_reviewed_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    ho_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ho_rejection_reason: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
