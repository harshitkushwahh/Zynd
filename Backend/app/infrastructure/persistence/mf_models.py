"""Mutual fund master, NAV history, product catalog, and ingestion audit."""

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
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _pg_enum(enum_cls: type[enum.Enum]):
    return Enum(enum_cls, values_callable=lambda members: [member.value for member in members])


class ProductType(str, enum.Enum):
    mutual_fund = "MUTUAL_FUND"


class ProductLifecycleStatus(str, enum.Enum):
    draft = "DRAFT"
    active = "ACTIVE"
    inactive = "INACTIVE"


class AdminVisibility(str, enum.Enum):
    auto = "AUTO"
    force_show = "FORCE_SHOW"
    force_hide = "FORCE_HIDE"


class AdminInvestability(str, enum.Enum):
    auto = "AUTO"
    block_orders = "BLOCK_ORDERS"


class IngestionRunStatus(str, enum.Enum):
    running = "RUNNING"
    succeeded = "SUCCEEDED"
    failed = "FAILED"
    partial = "PARTIAL"


class FundAmc(Base):
    __tablename__ = "fund_amcs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    amc_code: Mapped[Optional[str]] = mapped_column(String(32), unique=True, nullable=True)
    fp_amc_id: Mapped[Optional[str]] = mapped_column(String(64), unique=True, nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    admin_kill_switch: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    logo_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    funds: Mapped[list["MutualFund"]] = relationship(back_populates="amc")
    display_content: Mapped[Optional["AmcDisplayContent"]] = relationship(
        back_populates="amc", uselist=False
    )
    registry: Mapped[Optional["AmcRegistry"]] = relationship(back_populates="amc", uselist=False)


class MutualFund(Base):
    __tablename__ = "mutual_funds"
    __table_args__ = (
        UniqueConstraint("isin_growth", name="uq_mutual_funds_isin_growth"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    amc_id: Mapped[int] = mapped_column(ForeignKey("fund_amcs.id", ondelete="RESTRICT"), nullable=False)
    scheme_code: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    isin_growth: Mapped[str] = mapped_column(String(24), nullable=False)
    isin_div_reinvestment: Mapped[Optional[str]] = mapped_column(String(24), nullable=True)
    scheme_name: Mapped[str] = mapped_column(String(512), nullable=False)
    fp_scheme_id: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True)
    fp_oms_purchase_allowed: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    fp_oms_active: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    min_sip_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    min_lumpsum_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    investment_constraints: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    sebi_category: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    plan_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    option_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    product_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True, unique=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    amc: Mapped[FundAmc] = relationship(back_populates="funds")
    product: Mapped[Optional["Product"]] = relationship(back_populates="mutual_fund")
    navs: Mapped[list["SchemeNav"]] = relationship(back_populates="fund")


class SchemeNav(Base):
    __tablename__ = "scheme_navs"
    __table_args__ = (UniqueConstraint("fund_id", "nav_date", name="uq_scheme_navs_fund_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fund_id: Mapped[int] = mapped_column(ForeignKey("mutual_funds.id", ondelete="CASCADE"), nullable=False)
    nav_date: Mapped[date] = mapped_column(Date, nullable=False)
    nav_value: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    repurchase_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 6), nullable=True)
    sale_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 6), nullable=True)
    source: Mapped[str] = mapped_column(String(32), default="AMFI", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    fund: Mapped[MutualFund] = relationship(back_populates="navs")


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (UniqueConstraint("code", name="uq_products_code"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    short_description: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    provider: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    product_type: Mapped[ProductType] = mapped_column(_pg_enum(ProductType), nullable=False)
    lifecycle_status: Mapped[ProductLifecycleStatus] = mapped_column(
        _pg_enum(ProductLifecycleStatus), default=ProductLifecycleStatus.draft, nullable=False
    )
    admin_visibility: Mapped[AdminVisibility] = mapped_column(
        _pg_enum(AdminVisibility), default=AdminVisibility.auto, nullable=False
    )
    admin_investability: Mapped[AdminInvestability] = mapped_column(
        _pg_enum(AdminInvestability), default=AdminInvestability.auto, nullable=False
    )
    disabled_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    disabled_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    disabled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    invest_search_vector: Mapped[Optional[str]] = mapped_column(TSVECTOR, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    mutual_fund: Mapped[Optional[MutualFund]] = relationship(back_populates="product", uselist=False)
    category_links: Mapped[list["ProductCategory"]] = relationship(back_populates="product")
    display_content: Mapped[Optional["ProductDisplayContent"]] = relationship(
        back_populates="product", uselist=False
    )


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("slug", name="uq_categories_slug"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    min_funds_to_show: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    product_links: Mapped[list["ProductCategory"]] = relationship(back_populates="category")


class ProductCategory(Base):
    __tablename__ = "product_categories"
    __table_args__ = (UniqueConstraint("product_id", "category_id", name="uq_product_categories"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    display_order: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    featured_rank: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    effective_from: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    effective_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    product: Mapped[Product] = relationship(back_populates="category_links")
    category: Mapped[Category] = relationship(back_populates="product_links")


class IngestionRunLog(Base):
    __tablename__ = "ingestion_run_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_uuid: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), default=uuid.uuid4, unique=True)
    job_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[IngestionRunStatus] = mapped_column(
        _pg_enum(IngestionRunStatus), default=IngestionRunStatus.running, nullable=False
    )
    triggered_by: Mapped[str] = mapped_column(String(32), default="SCHEDULER", nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    records_processed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_inserted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_skipped: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)


class NavIngestionQuarantine(Base):
    __tablename__ = "nav_ingestion_quarantine"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_log_id: Mapped[int] = mapped_column(ForeignKey("ingestion_run_logs.id", ondelete="CASCADE"), nullable=False)
    raw_line: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FundNavMetrics(Base):
    __tablename__ = "fund_nav_metrics"

    fund_id: Mapped[int] = mapped_column(ForeignKey("mutual_funds.id", ondelete="CASCADE"), primary_key=True)
    as_of_date: Mapped[date] = mapped_column(Date, nullable=False)
    return_1d: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4), nullable=True)
    return_1w: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4), nullable=True)
    return_1m: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4), nullable=True)
    return_3m: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4), nullable=True)
    return_6m: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4), nullable=True)
    return_1y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4), nullable=True)
    return_3y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4), nullable=True)
    return_5y: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4), nullable=True)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FundCompositeRank(Base):
    __tablename__ = "fund_composite_ranks"
    __table_args__ = (UniqueConstraint("fund_id", "category_id", name="uq_fund_composite_ranks"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fund_id: Mapped[int] = mapped_column(ForeignKey("mutual_funds.id", ondelete="CASCADE"), nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    rank_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4), nullable=True)
    rank_position: Mapped[int] = mapped_column(Integer, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SchemeAum(Base):
    __tablename__ = "scheme_aums"
    __table_args__ = (UniqueConstraint("fund_id", "as_of_date", name="uq_scheme_aums_fund_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fund_id: Mapped[int] = mapped_column(ForeignKey("mutual_funds.id", ondelete="CASCADE"), nullable=False)
    as_of_date: Mapped[date] = mapped_column(Date, nullable=False)
    aum_inr: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    source: Mapped[str] = mapped_column(String(32), default="AMFI", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SchemeTer(Base):
    __tablename__ = "scheme_ter"
    __table_args__ = (UniqueConstraint("fund_id", "as_of_date", name="uq_scheme_ter_fund_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fund_id: Mapped[int] = mapped_column(ForeignKey("mutual_funds.id", ondelete="CASCADE"), nullable=False)
    as_of_date: Mapped[date] = mapped_column(Date, nullable=False)
    ter_percent: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False)
    source: Mapped[str] = mapped_column(String(32), default="AMFI", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProductDisplayContent(Base):
    __tablename__ = "product_display_content"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), primary_key=True
    )
    tagline: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    hero_badge: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    risk_label: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    benchmark_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    fund_manager_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    disclaimer_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    seo_slug: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, unique=True)
    seo_meta_description: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    product: Mapped[Product] = relationship(back_populates="display_content")


class AmcDisplayContent(Base):
    __tablename__ = "amc_display_content"

    amc_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("fund_amcs.id", ondelete="CASCADE"), primary_key=True
    )
    marketing_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    website_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    amc: Mapped[FundAmc] = relationship(back_populates="display_content")


class MfComplianceSettings(Base):
    __tablename__ = "mf_compliance_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    default_disclaimer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    distributor_arn: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    distributor_euin: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class MfBulkCatalogJobStatus(str, enum.Enum):
    pending = "PENDING"
    pending_approval = "PENDING_APPROVAL"
    running = "RUNNING"
    succeeded = "SUCCEEDED"
    failed = "FAILED"


class MfCatalogRule(Base):
    __tablename__ = "mf_catalog_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    conditions: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    actions: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    runs: Mapped[list["MfCatalogRuleRun"]] = relationship(back_populates="rule")


class MfCatalogRuleRun(Base):
    __tablename__ = "mf_catalog_rule_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rule_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("mf_catalog_rules.id", ondelete="SET NULL"), nullable=True
    )
    dry_run: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    affected_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    result: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    triggered_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    ran_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    rule: Mapped[Optional[MfCatalogRule]] = relationship(back_populates="runs")


class MfBulkCatalogJob(Base):
    __tablename__ = "mf_bulk_catalog_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    status: Mapped[MfBulkCatalogJobStatus] = mapped_column(
        _pg_enum(MfBulkCatalogJobStatus), default=MfBulkCatalogJobStatus.pending, nullable=False
    )
    dry_run: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    affected_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    source_csv: Mapped[str] = mapped_column(Text, nullable=False)
    result: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    failure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    admin_action_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class AmfiSchemeMaster(Base):
    __tablename__ = "amfi_scheme_master"

    scheme_code: Mapped[str] = mapped_column(String(32), primary_key=True)
    isin_growth: Mapped[str] = mapped_column(String(24), nullable=False, index=True)
    isin_div_reinvestment: Mapped[Optional[str]] = mapped_column(String(24), nullable=True, index=True)
    scheme_name: Mapped[str] = mapped_column(String(512), nullable=False)
    amc_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_seen_nav_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class FundReturnCalculatorSnapshot(Base):
    __tablename__ = "fund_return_calculator_snapshots"

    fund_id: Mapped[int] = mapped_column(ForeignKey("mutual_funds.id", ondelete="CASCADE"), primary_key=True)
    as_of_date: Mapped[date] = mapped_column(Date, nullable=False)
    horizons: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AmcAumRanking(Base):
    __tablename__ = "amc_aum_rankings"
    __table_args__ = (UniqueConstraint("amc_id", "as_of_date", name="uq_amc_aum_rankings_amc_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    amc_id: Mapped[int] = mapped_column(ForeignKey("fund_amcs.id", ondelete="CASCADE"), nullable=False)
    as_of_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_aum_inr: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    rank_india: Mapped[int] = mapped_column(Integer, nullable=False)
    peer_count: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String(32), default="AMFI_MONTHLY", nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SchemeComplianceFacts(Base):
    __tablename__ = "scheme_compliance_facts"

    fund_id: Mapped[int] = mapped_column(ForeignKey("mutual_funds.id", ondelete="CASCADE"), primary_key=True)
    exit_load_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    exit_load_slabs: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    stamp_duty_pct: Mapped[Decimal] = mapped_column(Numeric(8, 4), default=Decimal("0.0050"), nullable=False)
    tax_notes: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    lock_in_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    source: Mapped[str] = mapped_column(String(32), default="RULES", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AmcRegistry(Base):
    __tablename__ = "amc_registry"

    amc_id: Mapped[int] = mapped_column(ForeignKey("fund_amcs.id", ondelete="CASCADE"), primary_key=True)
    legal_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    incorporation_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    website_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    registered_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    custodian: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    rta_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    rta_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    rta_website: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    rta_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(32), default="AMFI", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    amc: Mapped[FundAmc] = relationship(back_populates="registry")
