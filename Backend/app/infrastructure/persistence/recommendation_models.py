"""Funds For You recommendation baskets, config, and user snapshots."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
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
from app.infrastructure.persistence.risk_profile_models import RiskTier, _pg_enum


class PortfolioRole(str, enum.Enum):
    growth_engine = "growth_engine"
    stability = "stability"
    diversifier = "diversifier"
    income_defensive = "income_defensive"
    hedge = "hedge"


class RecommendationBasket(Base):
    __tablename__ = "recommendation_baskets"
    __table_args__ = (UniqueConstraint("tier", "slug", name="uq_recommendation_baskets_tier_slug"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tier: Mapped[RiskTier] = mapped_column(_pg_enum(RiskTier), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(128), nullable=False)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    objective_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    portfolio_display_name: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    target_allocation: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    funds: Mapped[list["RecommendationBasketFund"]] = relationship(
        "RecommendationBasketFund",
        back_populates="basket",
        cascade="all, delete-orphan",
        order_by="RecommendationBasketFund.sort_order",
    )


class RecommendationBasketFund(Base):
    __tablename__ = "recommendation_basket_funds"
    __table_args__ = (UniqueConstraint("basket_id", "product_id", name="uq_recommendation_basket_funds"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    basket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("recommendation_baskets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    allocation_weight_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    portfolio_role: Mapped[Optional[PortfolioRole]] = mapped_column(
        _pg_enum(PortfolioRole),
        nullable=True,
    )
    is_anchor: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_alternative: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    alternative_for_product_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    basket: Mapped[RecommendationBasket] = relationship("RecommendationBasket", back_populates="funds")


class RecommendationConfig(Base):
    __tablename__ = "recommendation_config"
    __table_args__ = (CheckConstraint("id = 1", name="ck_recommendation_config_singleton"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    published_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    published_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)


class UserRecommendationSnapshot(Base):
    __tablename__ = "user_recommendation_snapshots"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tier: Mapped[RiskTier] = mapped_column(_pg_enum(RiskTier), nullable=False)
    basket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("recommendation_baskets.id", ondelete="RESTRICT"),
        nullable=False,
    )
    config_version: Mapped[int] = mapped_column(Integer, nullable=False)
    fund_product_ids: Mapped[list] = mapped_column(JSONB, nullable=False)
    fund_metadata: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    allocation_slices: Mapped[list] = mapped_column(JSONB, nullable=False)
    portfolio_story: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    portfolio_fit: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
