"""Zynd provider API logs — Cybrilla, FinPrim, Kyckart integration audit.

Revision ID: 051_zynd_provider_logs
Revises: 050_investor_bank_accounts_multi
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "051_zynd_provider_logs"
down_revision: Union[str, None] = "050_investor_bank_accounts_multi"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

provider_log_source = postgresql.ENUM(
    "cybrilla",
    "fintech_primitive",
    "kyckart",
    name="providerlogsource",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    provider_log_source.create(bind, checkfirst=True)

    op.create_table(
        "provider_api_logs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("source", provider_log_source, nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("action", sa.String(length=160), nullable=False),
        sa.Column("method", sa.String(length=16), nullable=False),
        sa.Column("path", sa.String(length=512), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("error_code", sa.String(length=64), nullable=True),
        sa.Column("request_summary", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("response_summary", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_provider_api_logs_source", "provider_api_logs", ["source"])
    op.create_index("ix_provider_api_logs_user_id", "provider_api_logs", ["user_id"])
    op.create_index("ix_provider_api_logs_action", "provider_api_logs", ["action"])
    op.create_index("ix_provider_api_logs_success", "provider_api_logs", ["success"])
    op.create_index("ix_provider_api_logs_created_at", "provider_api_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_provider_api_logs_created_at", table_name="provider_api_logs")
    op.drop_index("ix_provider_api_logs_success", table_name="provider_api_logs")
    op.drop_index("ix_provider_api_logs_action", table_name="provider_api_logs")
    op.drop_index("ix_provider_api_logs_user_id", table_name="provider_api_logs")
    op.drop_index("ix_provider_api_logs_source", table_name="provider_api_logs")
    op.drop_table("provider_api_logs")
    provider_log_source.drop(op.get_bind(), checkfirst=True)
