from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DistributorBranchStatus(str, enum.Enum):
    pending_approval = "pending_approval"
    active = "active"
    rejected = "rejected"


class DistributorBranch(Base):
    __tablename__ = "distributor_branches"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    branch_code: Mapped[Optional[str]] = mapped_column(String(16), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    city: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    state_code: Mapped[str] = mapped_column(String(8), nullable=False, default="MH", server_default="MH")
    state_name: Mapped[str] = mapped_column(String(80), nullable=False, default="Maharashtra", server_default="Maharashtra")
    status: Mapped[DistributorBranchStatus] = mapped_column(
        Enum(DistributorBranchStatus, name="distributor_branch_status"),
        nullable=False,
        default=DistributorBranchStatus.active,
        server_default=DistributorBranchStatus.active.value,
        index=True,
    )
    manager_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=True,
        index=True,
    )
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(String(240), nullable=True)
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
