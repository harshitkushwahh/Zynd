"""Referral reward rules and payout ledger tables.

Revision ID: 081_referral_reward_management
Revises: 080_ingestion_triggered_by
Create Date: 2026-08-15
"""

from __future__ import annotations

import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "081_referral_reward_management"
down_revision: Union[str, None] = "080_ingestion_triggered_by"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "referral_reward_rules",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "trigger",
            sa.Enum(
                "first_investment",
                "kyc_verified",
                "qualified",
                "engaged",
                name="referralrewardtrigger",
            ),
            nullable=False,
        ),
        sa.Column(
            "reward_type",
            sa.Enum("flat_inr", "percent", name="referralrewardtype"),
            nullable=False,
        ),
        sa.Column("reward_value", sa.Integer(), nullable=False),
        sa.Column("min_investment_inr", sa.Integer(), nullable=True),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
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
    )
    op.create_index("ix_referral_reward_rules_trigger", "referral_reward_rules", ["trigger"])
    op.create_index("ix_referral_reward_rules_is_active", "referral_reward_rules", ["is_active"])

    op.create_table(
        "referral_reward_ledger",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("attribution_id", sa.UUID(), nullable=False),
        sa.Column("referrer_user_id", sa.UUID(), nullable=False),
        sa.Column("referee_user_id", sa.UUID(), nullable=False),
        sa.Column("rule_id", sa.UUID(), nullable=True),
        sa.Column("rule_name", sa.String(length=120), nullable=False),
        sa.Column(
            "trigger",
            sa.Enum(
                "first_investment",
                "kyc_verified",
                "qualified",
                "engaged",
                name="referralrewardtrigger",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("amount_inr", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "approved",
                "paid",
                "reversed",
                "cancelled",
                name="referralrewardledgerstatus",
            ),
            nullable=False,
        ),
        sa.Column(
            "earned_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["attribution_id"], ["referral_attributions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["referrer_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["referee_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["rule_id"], ["referral_reward_rules.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "attribution_id",
            "rule_id",
            name="uq_referral_reward_ledger_attribution_rule",
        ),
    )
    op.create_index("ix_referral_reward_ledger_attribution_id", "referral_reward_ledger", ["attribution_id"])
    op.create_index("ix_referral_reward_ledger_referrer_user_id", "referral_reward_ledger", ["referrer_user_id"])
    op.create_index("ix_referral_reward_ledger_rule_id", "referral_reward_ledger", ["rule_id"])
    op.create_index("ix_referral_reward_ledger_status", "referral_reward_ledger", ["status"])
    op.create_index("ix_referral_reward_ledger_earned_at", "referral_reward_ledger", ["earned_at"])

    op.execute(
        sa.text(
            """
            INSERT INTO referral_reward_rules (
                id, name, description, trigger, reward_type, reward_value,
                min_investment_inr, is_active, sort_order
            ) VALUES (
                :id,
                'First investment bonus',
                'Flat reward when a referee completes their first qualifying investment.',
                'first_investment',
                'flat_inr',
                100,
                1000,
                true,
                0
            )
            """
        ).bindparams(id=uuid.uuid4())
    )
    op.execute(
        sa.text(
            """
            INSERT INTO referral_reward_rules (
                id, name, description, trigger, reward_type, reward_value,
                min_investment_inr, is_active, sort_order
            ) VALUES (
                :id,
                'Legacy percentage reward',
                'Fallback 2% of first investment when no flat rule matches.',
                'first_investment',
                'percent',
                2,
                1000,
                false,
                10
            )
            """
        ).bindparams(id=uuid.uuid4())
    )


def downgrade() -> None:
    op.drop_index("ix_referral_reward_ledger_earned_at", table_name="referral_reward_ledger")
    op.drop_index("ix_referral_reward_ledger_status", table_name="referral_reward_ledger")
    op.drop_index("ix_referral_reward_ledger_rule_id", table_name="referral_reward_ledger")
    op.drop_index("ix_referral_reward_ledger_referrer_user_id", table_name="referral_reward_ledger")
    op.drop_index("ix_referral_reward_ledger_attribution_id", table_name="referral_reward_ledger")
    op.drop_table("referral_reward_ledger")
    op.drop_index("ix_referral_reward_rules_is_active", table_name="referral_reward_rules")
    op.drop_index("ix_referral_reward_rules_trigger", table_name="referral_reward_rules")
    op.drop_table("referral_reward_rules")
    op.execute(sa.text("DROP TYPE IF EXISTS referralrewardledgerstatus"))
    op.execute(sa.text("DROP TYPE IF EXISTS referralrewardtype"))
    op.execute(sa.text("DROP TYPE IF EXISTS referralrewardtrigger"))
