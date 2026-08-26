from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DistributorWorkSessionStatus(str, enum.Enum):
    active = "active"
    complete = "complete"


class DistributorLeaveRequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class DistributorSalaryPaymentStatus(str, enum.Enum):
    waiting = "waiting"
    done = "done"
    partial = "partial"
    failed = "failed"


class DistributorWorkConfig(Base):
    __tablename__ = "distributor_work_configs"

    branch_id: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("distributor_branches.id", ondelete="CASCADE"),
        primary_key=True,
    )
    config_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class DistributorWorkSession(Base):
    __tablename__ = "distributor_work_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mitra_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    branch_id: Mapped[Optional[str]] = mapped_column(
        String(32),
        ForeignKey("distributor_branches.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    signed_in_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    signed_out_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    work_site_id: Mapped[str] = mapped_column(String(32), nullable=False)
    work_mode_id: Mapped[str] = mapped_column(String(32), nullable=False)
    time_slot_id: Mapped[str] = mapped_column(String(64), nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    geolocation_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[DistributorWorkSessionStatus] = mapped_column(
        Enum(DistributorWorkSessionStatus),
        default=DistributorWorkSessionStatus.active,
        nullable=False,
        index=True,
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


class DistributorLeaveRequest(Base):
    __tablename__ = "distributor_leave_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mitra_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    branch_id: Mapped[Optional[str]] = mapped_column(
        String(32),
        ForeignKey("distributor_branches.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    leave_type: Mapped[str] = mapped_column(String(32), nullable=False)
    from_date: Mapped[date] = mapped_column(Date, nullable=False)
    to_date: Mapped[date] = mapped_column(Date, nullable=False)
    days: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[DistributorLeaveRequestStatus] = mapped_column(
        Enum(DistributorLeaveRequestStatus),
        default=DistributorLeaveRequestStatus.pending,
        nullable=False,
        index=True,
    )
    applied_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    review_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
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


class DistributorPartnerPromotion(Base):
    __tablename__ = "distributor_partner_promotions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mitra_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    granted_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    previous_base_salary: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    new_base_salary: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    hike_pct: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class DistributorPayrollPeriod(Base):
    __tablename__ = "distributor_payroll_periods"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    mitra_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    period_label: Mapped[str] = mapped_column(String(64), nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    basic_salary: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    performance_incentive: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    spot_bonus: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    deductions: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    take_home: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    payment_status: Mapped[DistributorSalaryPaymentStatus] = mapped_column(
        Enum(DistributorSalaryPaymentStatus),
        default=DistributorSalaryPaymentStatus.waiting,
        nullable=False,
    )
    paid_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    net_sales_target: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    net_sales_achieved: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    incentive_slab: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    calculated_incentive: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    adjustments: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    final_incentive: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
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
