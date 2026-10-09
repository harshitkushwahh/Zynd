"""NFO offers, scheduler state, and browse category.

Revision ID: 100_nfo_offers
Revises: 099_mf_generated_reports
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "100_nfo_offers"
down_revision: Union[str, None] = "099_mf_generated_reports"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    status = postgresql.ENUM(
        "UPCOMING",
        "OPEN",
        "CLOSED",
        "ALLOTTED",
        name="nfo_offer_status",
        create_type=False,
    )
    status.create(bind, checkfirst=True)

    op.create_table(
        "nfo_offers",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("mutual_fund_id", sa.Integer(), nullable=False),
        sa.Column("status", status, nullable=False),
        sa.Column("subscription_open_date", sa.Date(), nullable=True),
        sa.Column("subscription_close_date", sa.Date(), nullable=True),
        sa.Column("allotment_date", sa.Date(), nullable=True),
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("marketing_headline", sa.Text(), nullable=True),
        sa.Column("marketing_body", sa.Text(), nullable=True),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="HEURISTIC"),
        sa.Column("admin_override", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["mutual_fund_id"], ["mutual_funds.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_id", name="uq_nfo_offers_product_id"),
    )
    op.create_index("ix_nfo_offers_status", "nfo_offers", ["status"])
    op.create_index("ix_nfo_offers_mutual_fund_id", "nfo_offers", ["mutual_fund_id"])

    op.create_table(
        "nfo_scheduler_state",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("pending_after_mf", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("pending_triggered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_mf_run_uuid", sa.UUID(), nullable=True),
        sa.Column("last_nfo_success_date", sa.Date(), nullable=True),
        sa.Column("last_trigger_kind", sa.String(length=32), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(sa.text("INSERT INTO nfo_scheduler_state (id) VALUES (1)"))

    op.execute(
        sa.text(
            """
            INSERT INTO categories (slug, name, display_order, is_visible, min_funds_to_show, category_kind)
            VALUES ('nfo', 'NFO', 90, true, 1, 'BROWSE')
            ON CONFLICT (slug) DO UPDATE SET
                name = EXCLUDED.name,
                is_visible = true,
                category_kind = 'BROWSE'
            """
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM product_categories WHERE category_id IN (SELECT id FROM categories WHERE slug = 'nfo')"))
    op.execute(sa.text("DELETE FROM categories WHERE slug = 'nfo'"))
    op.drop_table("nfo_scheduler_state")
    op.drop_index("ix_nfo_offers_mutual_fund_id", table_name="nfo_offers")
    op.drop_index("ix_nfo_offers_status", table_name="nfo_offers")
    op.drop_table("nfo_offers")
    postgresql.ENUM(name="nfo_offer_status", create_type=False).drop(op.get_bind(), checkfirst=True)
