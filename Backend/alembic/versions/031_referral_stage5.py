"""Referral Stage 5 — engaged stage and engagement milestone events.

Revision ID: 031_referral_stage5
Revises: 030_referral_stage4
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "031_referral_stage5"
down_revision: Union[str, None] = "030_referral_stage4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

referral_engagement_milestone = postgresql.ENUM(
    "second_investment",
    "additional_product",
    "aum_milestone",
    name="referralengagementmilestone",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    referral_engagement_milestone.create(bind, checkfirst=True)
    op.execute("ALTER TYPE referralstage ADD VALUE IF NOT EXISTS 'engaged'")

    op.add_column(
        "referral_attributions",
        sa.Column("engaged_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_referral_attributions_engaged_at",
        "referral_attributions",
        ["engaged_at"],
    )

    op.create_table(
        "referral_engagement_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("attribution_id", sa.UUID(), nullable=False),
        sa.Column("referrer_user_id", sa.UUID(), nullable=False),
        sa.Column("referee_user_id", sa.UUID(), nullable=False),
        sa.Column(
            "milestone_type",
            referral_engagement_milestone,
            nullable=False,
        ),
        sa.Column(
            "product",
            postgresql.ENUM(
                "mutual_fund",
                "fixed_deposit",
                "other",
                name="referralinvestmentproduct",
                create_type=False,
            ),
            nullable=True,
        ),
        sa.Column("amount_inr", sa.Integer(), nullable=True),
        sa.Column("total_aum_inr", sa.Integer(), nullable=True),
        sa.Column(
            "achieved_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["attribution_id"], ["referral_attributions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["referrer_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["referee_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "attribution_id",
            "milestone_type",
            name="uq_referral_engagement_attribution_milestone",
        ),
    )
    op.create_index(
        "ix_referral_engagement_events_attribution_id",
        "referral_engagement_events",
        ["attribution_id"],
    )
    op.create_index(
        "ix_referral_engagement_events_referrer_user_id",
        "referral_engagement_events",
        ["referrer_user_id"],
    )
    op.create_index(
        "ix_referral_engagement_events_achieved_at",
        "referral_engagement_events",
        ["achieved_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_referral_engagement_events_achieved_at", table_name="referral_engagement_events")
    op.drop_index(
        "ix_referral_engagement_events_referrer_user_id",
        table_name="referral_engagement_events",
    )
    op.drop_index(
        "ix_referral_engagement_events_attribution_id",
        table_name="referral_engagement_events",
    )
    op.drop_table("referral_engagement_events")
    op.drop_index("ix_referral_attributions_engaged_at", table_name="referral_attributions")
    op.drop_column("referral_attributions", "engaged_at")
    referral_engagement_milestone.drop(op.get_bind(), checkfirst=True)
