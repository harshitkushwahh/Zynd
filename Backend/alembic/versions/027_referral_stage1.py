"""Referral Stage 1 — signup attributions.

Revision ID: 027_referral_stage1
Revises: 026_referral_stage0
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "027_referral_stage1"
down_revision: Union[str, None] = "026_referral_stage0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

referral_signup_channel = postgresql.ENUM(
    "email",
    "google",
    "apple",
    name="referralsignupchannel",
    create_type=False,
)
referral_stage = postgresql.ENUM(
    "signed_up",
    name="referralstage",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    referral_signup_channel.create(bind, checkfirst=True)
    referral_stage.create(bind, checkfirst=True)

    op.create_table(
        "referral_attributions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("referrer_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("referee_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("referral_code", sa.String(length=16), nullable=False),
        sa.Column(
            "signup_channel",
            referral_signup_channel,
            nullable=False,
        ),
        sa.Column(
            "current_stage",
            referral_stage,
            nullable=False,
            server_default="signed_up",
        ),
        sa.Column("signed_up_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["referrer_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["referee_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("referee_user_id"),
    )
    op.create_index(
        "ix_referral_attributions_referrer_user_id",
        "referral_attributions",
        ["referrer_user_id"],
    )
    op.create_index(
        "ix_referral_attributions_signed_up_at",
        "referral_attributions",
        ["signed_up_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_referral_attributions_signed_up_at", table_name="referral_attributions")
    op.drop_index("ix_referral_attributions_referrer_user_id", table_name="referral_attributions")
    op.drop_table("referral_attributions")
    referral_stage.drop(op.get_bind(), checkfirst=True)
    referral_signup_channel.drop(op.get_bind(), checkfirst=True)
