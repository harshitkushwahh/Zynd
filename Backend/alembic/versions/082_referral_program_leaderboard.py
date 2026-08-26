"""Referral program settings, leaderboard config, snapshots, and investment mode.

Revision ID: 082_referral_program_leaderboard
Revises: 081_referral_reward_management
Create Date: 2026-08-15
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "082_referral_program_leaderboard"
down_revision: Union[str, None] = "081_referral_reward_management"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

referral_investment_mode = postgresql.ENUM(
    "lumpsum",
    "sip",
    "other",
    name="referralinvestmentmode",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    referral_investment_mode.create(bind, checkfirst=True)
    op.add_column(
        "referral_attributions",
        sa.Column(
            "first_investment_mode",
            referral_investment_mode,
            nullable=True,
        ),
    )

    op.create_table(
        "referral_program_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("min_referrals_to_redeem", sa.Integer(), server_default="15", nullable=False),
        sa.Column("lumpsum_retention_days", sa.Integer(), server_default="180", nullable=False),
        sa.Column(
            "default_qualification_hold_days",
            sa.Integer(),
            server_default="30",
            nullable=False,
        ),
        sa.Column("min_first_investment_inr", sa.Integer(), server_default="1000", nullable=False),
        sa.Column("timezone", sa.String(length=64), server_default="Asia/Kolkata", nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        sa.text(
            """
            INSERT INTO referral_program_settings (id)
            VALUES (1)
            """
        )
    )

    op.create_table(
        "referral_leaderboard_config",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "primary_metric",
            sa.String(length=32),
            server_default="signup_count",
            nullable=False,
        ),
        sa.Column(
            "tie_breaker_1",
            sa.String(length=32),
            server_default="earnings_inr_desc",
            nullable=False,
        ),
        sa.Column(
            "tie_breaker_2",
            sa.String(length=32),
            server_default="earliest_referral_asc",
            nullable=False,
        ),
        sa.Column(
            "period_field",
            sa.String(length=32),
            server_default="signed_up_at",
            nullable=False,
        ),
        sa.Column("auto_snapshot_enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        sa.text(
            """
            INSERT INTO referral_leaderboard_config (id)
            VALUES (1)
            """
        )
    )

    op.create_table(
        "referral_leaderboard_snapshots",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("period_key", sa.String(length=7), nullable=False),
        sa.Column("referrer_user_id", sa.UUID(), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("referral_count", sa.Integer(), nullable=False),
        sa.Column("earnings_inr", sa.Integer(), server_default="0", nullable=False),
        sa.Column("earliest_referral_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_final", sa.Boolean(), server_default="false", nullable=False),
        sa.Column(
            "computed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "period_key",
            "referrer_user_id",
            name="uq_referral_leaderboard_snapshot_period_referrer",
        ),
    )
    op.create_index(
        "ix_referral_leaderboard_snapshots_period_key",
        "referral_leaderboard_snapshots",
        ["period_key"],
    )
    op.create_index(
        "ix_referral_leaderboard_snapshots_referrer_user_id",
        "referral_leaderboard_snapshots",
        ["referrer_user_id"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    op.drop_index(
        "ix_referral_leaderboard_snapshots_referrer_user_id",
        table_name="referral_leaderboard_snapshots",
    )
    op.drop_index(
        "ix_referral_leaderboard_snapshots_period_key",
        table_name="referral_leaderboard_snapshots",
    )
    op.drop_table("referral_leaderboard_snapshots")
    op.drop_table("referral_leaderboard_config")
    op.drop_table("referral_program_settings")
    op.drop_column("referral_attributions", "first_investment_mode")
    referral_investment_mode.drop(bind, checkfirst=True)
