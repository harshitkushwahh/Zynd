"""MF product content & compliance layer — Phase 12.

Revision ID: 041_mf_product_content
Revises: 040_mf_display_order
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "041_mf_product_content"
down_revision: Union[str, None] = "040_mf_display_order"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_MF_AUDIT_EVENTS = (
    "mf_product_content_updated",
    "mf_amc_content_updated",
    "mf_compliance_settings_updated",
)


def upgrade() -> None:
    op.create_table(
        "product_display_content",
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tagline", sa.String(length=256), nullable=True),
        sa.Column("hero_badge", sa.String(length=64), nullable=True),
        sa.Column("risk_label", sa.String(length=64), nullable=True),
        sa.Column("benchmark_name", sa.String(length=255), nullable=True),
        sa.Column("fund_manager_name", sa.String(length=255), nullable=True),
        sa.Column("disclaimer_text", sa.Text(), nullable=True),
        sa.Column("seo_slug", sa.String(length=128), nullable=True),
        sa.Column("seo_meta_description", sa.String(length=512), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("product_id"),
    )
    op.create_index(
        "ix_product_display_content_seo_slug",
        "product_display_content",
        ["seo_slug"],
        unique=True,
        postgresql_where=sa.text("seo_slug IS NOT NULL"),
    )

    op.create_table(
        "amc_display_content",
        sa.Column("amc_id", sa.Integer(), nullable=False),
        sa.Column("marketing_name", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("website_url", sa.String(length=512), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["amc_id"], ["fund_amcs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("amc_id"),
    )

    op.create_table(
        "mf_compliance_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("default_disclaimer", sa.Text(), nullable=True),
        sa.Column("distributor_arn", sa.String(length=64), nullable=True),
        sa.Column("distributor_euin", sa.String(length=64), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        "INSERT INTO mf_compliance_settings (id) VALUES (1) ON CONFLICT DO NOTHING"
    )

    for value in _MF_AUDIT_EVENTS:
        op.execute(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    op.drop_table("mf_compliance_settings")
    op.drop_table("amc_display_content")
    op.drop_index("ix_product_display_content_seo_slug", table_name="product_display_content")
    op.drop_table("product_display_content")
