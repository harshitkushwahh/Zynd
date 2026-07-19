"""MF transactions — migrations 037_mf_transactions, 047_mf_payment_foundation."""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
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


def _mf_pg_enum(enum_cls: type[enum.Enum], *, name: str) -> Enum:
    """Bind SQLAlchemy enums to PostgreSQL types created by Alembic migrations."""
    return Enum(
        enum_cls,
        name=name,
        values_callable=lambda members: [member.value for member in members],
    )


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


class MfCheckoutType(str, enum.Enum):
    single = "SINGLE"
    cart = "CART"


class MfCartInvestmentType(str, enum.Enum):
    lumpsum = "lumpsum"
    sip = "sip"


class MfCheckoutStatus(str, enum.Enum):
    pending = "PENDING"
    payment_pending = "PAYMENT_PENDING"
    submitted = "SUBMITTED"
    processing = "PROCESSING"
    succeeded = "SUCCEEDED"
    failed = "FAILED"
    cancelled = "CANCELLED"


class MfWebhookProcessingStatus(str, enum.Enum):
    received = "RECEIVED"
    processed = "PROCESSED"
    ignored = "IGNORED"
    failed = "FAILED"


class MfMandateStatus(str, enum.Enum):
    pending = "PENDING"
    auth_pending = "AUTH_PENDING"
    approved = "APPROVED"
    failed = "FAILED"
    cancelled = "CANCELLED"


class MfSipPlanStatus(str, enum.Enum):
    pending = "PENDING"
    review = "REVIEW"
    consent_pending = "CONSENT_PENDING"
    active = "ACTIVE"
    cancelled = "CANCELLED"
    failed = "FAILED"


class MfInvestmentAccount(Base):
    __tablename__ = "mf_investment_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    fp_mfia_id: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True)
    fp_mfia_old_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[MfInvestmentAccountStatus] = mapped_column(
        _mf_pg_enum(MfInvestmentAccountStatus, name="mf_investment_account_status"),
        default=MfInvestmentAccountStatus.pending,
        nullable=False,
    )
    failure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    orders: Mapped[list["MfOrder"]] = relationship(back_populates="investment_account")


class MfCheckout(Base):
    __tablename__ = "mf_checkouts"
    __table_args__ = (UniqueConstraint("idempotency_key", name="uq_mf_checkouts_idempotency_key"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    checkout_type: Mapped[MfCheckoutType] = mapped_column(
        _mf_pg_enum(MfCheckoutType, name="mf_checkout_type"), nullable=False
    )
    status: Mapped[MfCheckoutStatus] = mapped_column(
        _mf_pg_enum(MfCheckoutStatus, name="mf_checkout_status"),
        default=MfCheckoutStatus.pending,
        nullable=False,
        index=True,
    )
    total_amount_inr: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    fp_payment_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    token_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    failure_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    failure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    orders: Mapped[list["MfOrder"]] = relationship(back_populates="checkout")


class MfCartItem(Base):
    __tablename__ = "mf_cart_items"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "product_id",
            "investment_type",
            name="uq_mf_cart_items_user_product_type",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    fund_id: Mapped[int] = mapped_column(ForeignKey("mutual_funds.id", ondelete="RESTRICT"), nullable=False)
    amount_inr: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    investment_type: Mapped[MfCartInvestmentType] = mapped_column(
        _mf_pg_enum(MfCartInvestmentType, name="mf_cart_investment_type"),
        default=MfCartInvestmentType.lumpsum,
        nullable=False,
    )
    installment_day: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    frequency: Mapped[str] = mapped_column(String(16), default="monthly", nullable=False)
    fp_scheme_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


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
    checkout_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mf_checkouts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    line_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    order_type: Mapped[MfOrderType] = mapped_column(
        _mf_pg_enum(MfOrderType, name="mf_order_type"), nullable=False
    )
    amount_inr: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    status: Mapped[MfOrderStatus] = mapped_column(
        _mf_pg_enum(MfOrderStatus, name="mf_order_status"),
        default=MfOrderStatus.pending,
        nullable=False,
        index=True,
    )
    fp_purchase_id: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True)
    fp_purchase_old_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
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
    checkout: Mapped[Optional[MfCheckout]] = relationship(back_populates="orders")
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


class MfMandate(Base):
    __tablename__ = "mf_mandates"
    __table_args__ = (UniqueConstraint("idempotency_key", name="uq_mf_mandates_idempotency_key"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    investor_bank_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("investor_bank_accounts.id", ondelete="SET NULL"), nullable=True
    )
    fp_mandate_id: Mapped[Optional[int]] = mapped_column(Integer, unique=True, nullable=True)
    bank_account_old_id: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[MfMandateStatus] = mapped_column(
        _mf_pg_enum(MfMandateStatus, name="mf_mandate_status"),
        default=MfMandateStatus.pending,
        nullable=False,
        index=True,
    )
    mandate_type: Mapped[str] = mapped_column(String(32), default="UPI", nullable=False)
    mandate_limit: Mapped[int] = mapped_column(Integer, nullable=False)
    fp_mandate_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    auth_token_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    failure_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    failure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    sip_plans: Mapped[list["MfSipPlan"]] = relationship(back_populates="mandate")


class MfSipPlan(Base):
    __tablename__ = "mf_sip_plans"
    __table_args__ = (UniqueConstraint("idempotency_key", name="uq_mf_sip_plans_idempotency_key"),)

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
    mf_mandate_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mf_mandates.id", ondelete="SET NULL"), nullable=True
    )
    amount_inr: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    frequency: Mapped[str] = mapped_column(String(16), nullable=False)
    installment_day: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    number_of_installments: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[MfSipPlanStatus] = mapped_column(
        _mf_pg_enum(MfSipPlanStatus, name="mf_sip_plan_status"),
        default=MfSipPlanStatus.pending,
        nullable=False,
        index=True,
    )
    fp_plan_id: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True)
    fp_state: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    next_installment_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    failure_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    failure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    activated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    mandate: Mapped[Optional[MfMandate]] = relationship(back_populates="sip_plans")
    events: Mapped[list["MfSipPlanEvent"]] = relationship(back_populates="plan", cascade="all, delete-orphan")


class MfSipPlanEvent(Base):
    __tablename__ = "mf_sip_plan_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mf_sip_plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    to_status: Mapped[str] = mapped_column(String(32), nullable=False)
    source: Mapped[str] = mapped_column(String(32), default="SYSTEM", nullable=False)
    payload: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    plan: Mapped[MfSipPlan] = relationship(back_populates="events")


class MfFinprimWebhookEvent(Base):
    __tablename__ = "mf_finprim_webhook_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fp_event_id: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    processing_status: Mapped[MfWebhookProcessingStatus] = mapped_column(
        _mf_pg_enum(MfWebhookProcessingStatus, name="mf_webhook_processing_status"),
        default=MfWebhookProcessingStatus.received,
        nullable=False,
    )
    processing_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class MfCasImport(Base):
    __tablename__ = "mf_cas_imports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[MfCasImportStatus] = mapped_column(
        _mf_pg_enum(MfCasImportStatus, name="mf_cas_import_status"),
        default=MfCasImportStatus.pending,
        nullable=False,
        index=True,
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
