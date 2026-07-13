"""MF transactions — migration 037_mf_transactions."""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class MfInvestmentAccountStatus(str, enum.Enum):
    pending = "PENDING"
    active = "ACTIVE"
    failed = "FAILED"


class MfOrderType(str, enum.Enum):
    lumpsum = "LUMPSUM"
    sip = "SIP"
    redemption = "REDEMPTION"


class MfOrderStatus(str, enum.Enum):
    pending = "PENDING"
    submitted = "SUBMITTED"
    payment_pending = "PAYMENT_PENDING"
    processing = "PROCESSING"
    succeeded = "SUCCEEDED"
    failed = "FAILED"
    cancelled = "CANCELLED"


class MfCasImportStatus(str, enum.Enum):
    pending = "PENDING"
    processing = "PROCESSING"
    succeeded = "SUCCEEDED"
    failed = "FAILED"


class MfInvestmentAccount(Base):
    __tablename__ = "mf_investment_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    fp_mfia_id: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True)
    status: Mapped[MfInvestmentAccountStatus] = mapped_column(
        Enum(MfInvestmentAccountStatus), default=MfInvestmentAccountStatus.pending, nullable=False
    )
    failure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    orders: Mapped[list["MfOrder"]] = relationship(back_populates="investment_account")


class MfOrder(Base):
    __tablename__ = "mf_orders"
    __table_args__ = (UniqueConstraint("idempotency_key", name="uq_mf_orders_idempotency_key"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    fund_id: Mapped[int] = mapped_column(ForeignKey("mutual_funds.id", ondelete="RESTRICT"), nullable=False)
    mf_investment_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mf_investment_accounts.id", ondelete="SET NULL"), nullable=True
    )
    order_type: Mapped[MfOrderType] = mapped_column(Enum(MfOrderType), nullable=False)
    amount_inr: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    status: Mapped[MfOrderStatus] = mapped_column(
        Enum(MfOrderStatus), default=MfOrderStatus.pending, nullable=False, index=True
    )
    fp_purchase_id: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True)
    fp_scheme_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    fp_state: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    failure_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    failure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    settled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    investment_account: Mapped[Optional[MfInvestmentAccount]] = relationship(back_populates="orders")
    events: Mapped[list["MfOrderEvent"]] = relationship(back_populates="order", cascade="all, delete-orphan")


class MfOrderEvent(Base):
    __tablename__ = "mf_order_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mf_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    to_status: Mapped[str] = mapped_column(String(32), nullable=False)
    source: Mapped[str] = mapped_column(String(32), default="SYSTEM", nullable=False)
    payload: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    order: Mapped[MfOrder] = relationship(back_populates="events")


class MfCasImport(Base):
    __tablename__ = "mf_cas_imports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[MfCasImportStatus] = mapped_column(
        Enum(MfCasImportStatus), default=MfCasImportStatus.pending, nullable=False, index=True
    )
    external_request_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    failure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    holdings_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class MfExternalHolding(Base):
    __tablename__ = "mf_external_holdings"
    __table_args__ = (UniqueConstraint("user_id", "isin", "folio_number", name="uq_mf_external_holdings"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cas_import_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mf_cas_imports.id", ondelete="SET NULL"), nullable=True
    )
    isin: Mapped[str] = mapped_column(String(24), nullable=False)
    scheme_name: Mapped[str] = mapped_column(String(512), nullable=False)
    folio_number: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    units: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    nav_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 6), nullable=True)
    market_value_inr: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    as_of_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    amc_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    source: Mapped[str] = mapped_column(String(32), default="MF_CENTRAL", nullable=False)
    matched_fund_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("mutual_funds.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
