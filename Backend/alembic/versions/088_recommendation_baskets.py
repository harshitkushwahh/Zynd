"""Recommendation baskets, config, and user snapshots for Funds For You.

Revision ID: 088_recommendation_baskets
Revises: 087_remove_ondc_sip_learned_blocks
Create Date: 2026-08-27
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "088_recommendation_baskets"
down_revision: Union[str, None] = "087_remove_ondc_sip_learned_blocks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

risk_tier = postgresql.ENUM(
    "secure",
    "conservative",
    "moderate",
    "growth",
    "aggressive",
    name="risktier",
    create_type=False,
)

portfolio_role = postgresql.ENUM(
    "growth_engine",
    "stability",
    "diversifier",
    "income_defensive",
    "hedge",
    name="portfoliorole",
    create_type=False,
)

_RECOMMENDATION_AUDIT_EVENTS = (
    "recommendation_basket_created",
    "recommendation_basket_updated",
    "recommendation_basket_deleted",
    "recommendation_basket_funds_replaced",
    "recommendation_config_published",
)


def upgrade() -> None:
    bind = op.get_bind()
    risk_tier.create(bind, checkfirst=True)
    portfolio_role.create(bind, checkfirst=True)

    for value in _RECOMMENDATION_AUDIT_EVENTS:
        op.execute(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{value}'")

    op.create_table(
        "recommendation_baskets",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tier", risk_tier, nullable=False),
        sa.Column("slug", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("objective_summary", sa.Text(), nullable=True),
        sa.Column("portfolio_display_name", sa.String(length=256), nullable=True),
        sa.Column("target_allocation", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tier", "slug", name="uq_recommendation_baskets_tier_slug"),
    )
    op.create_index(
        "ix_recommendation_baskets_tier_active_sort",
        "recommendation_baskets",
        ["tier", "is_active", "sort_order"],
    )

    op.create_table(
        "recommendation_basket_funds",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("basket_id", sa.UUID(), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("allocation_weight_pct", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("portfolio_role", portfolio_role, nullable=True),
        sa.Column("is_anchor", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_alternative", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("alternative_for_product_id", sa.UUID(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["basket_id"], ["recommendation_baskets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["alternative_for_product_id"], ["products.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("basket_id", "product_id", name="uq_recommendation_basket_funds"),
    )
    op.create_index(
        "ix_recommendation_basket_funds_basket_sort",
        "recommendation_basket_funds",
        ["basket_id", "is_active", "sort_order"],
    )

    op.create_table(
        "recommendation_config",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("published_version", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_by", sa.UUID(), nullable=True),
        sa.CheckConstraint("id = 1", name="ck_recommendation_config_singleton"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        """
        INSERT INTO recommendation_config (id, published_version)
        VALUES (1, 0)
        ON CONFLICT (id) DO NOTHING
        """
    )

    op.create_table(
        "user_recommendation_snapshots",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("tier", risk_tier, nullable=False),
        sa.Column("basket_id", sa.UUID(), nullable=False),
        sa.Column("config_version", sa.Integer(), nullable=False),
        sa.Column("fund_product_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("fund_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("allocation_slices", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("portfolio_story", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("portfolio_fit", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["basket_id"], ["recommendation_baskets.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("user_recommendation_snapshots")
    op.drop_table("recommendation_config")
    op.drop_index("ix_recommendation_basket_funds_basket_sort", table_name="recommendation_basket_funds")
    op.drop_table("recommendation_basket_funds")
    op.drop_index("ix_recommendation_baskets_tier_active_sort", table_name="recommendation_baskets")
    op.drop_table("recommendation_baskets")
    op.execute("DROP TYPE IF EXISTS portfoliorole")
