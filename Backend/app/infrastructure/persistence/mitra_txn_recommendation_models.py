from __future__ import annotations

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class MitraTxnRecommendationStatus(str, enum.Enum):
    sent = "sent"
    opened = "opened"
    invested = "invested"
    expired = "expired"
    cancelled = "cancelled"


class MitraTxnInvestmentType(str, enum.Enum):
    one_time = "one_time"
    sip = "sip"


class MitraTxnPaymentMethod(str, enum.Enum):
    upi = "upi"
    netbanking = "netbanking"


class MitraTxnRecommendation(Base):
    __tablename__ = "mitra_txn_recommendations"
    __table_args__ = (
        UniqueConstraint("token", name="uq_mitra_txn_recommendations_token"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    mitra_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    investment_type: Mapped[MitraTxnInvestmentType] = mapped_column(
        Enum(MitraTxnInvestmentType),
        nullable=False,
    )
    amount_inr: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    number_of_installments: Mapped[Optional[int]] = mapped_column(nullable=True)
    installment_day: Mapped[Optional[int]] = mapped_column(nullable=True)
    sip_frequency: Mapped[str] = mapped_column(String(32), nullable=False, server_default="monthly")
    payment_method: Mapped[MitraTxnPaymentMethod] = mapped_column(
        Enum(MitraTxnPaymentMethod),
        nullable=False,
    )
    status: Mapped[MitraTxnRecommendationStatus] = mapped_column(
        Enum(MitraTxnRecommendationStatus),
        nullable=False,
        index=True,
        server_default=MitraTxnRecommendationStatus.sent.value,
    )
    fund_name: Mapped[str] = mapped_column(String(512), nullable=False)
    product_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    fund_slug: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    opened_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    invested_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    cancelled_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


MITRA_TXN_RECOMMENDATION_MAX_ITEMS = 10


class MitraTxnRecommendationItem(Base):
    __tablename__ = "mitra_txn_recommendation_items"
    __table_args__ = (
        UniqueConstraint(
            "recommendation_id",
            "product_id",
            name="uq_mitra_txn_recommendation_items_rec_product",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recommendation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("mitra_txn_recommendations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    amount_inr: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    number_of_installments: Mapped[Optional[int]] = mapped_column(nullable=True)
    installment_day: Mapped[Optional[int]] = mapped_column(nullable=True)
    fund_name: Mapped[str] = mapped_column(String(512), nullable=False)
    product_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    fund_slug: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
