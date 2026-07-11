"""Phase 8: document retention + deletion integration.

Revision ID: 020_phase8_document_retention
Revises: 019_phase7_document_worm
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "020_phase8_document_retention"
down_revision: Union[str, None] = "019_phase7_document_worm"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_documents",
        sa.Column("deletion_scheduled_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_user_documents_deletion_scheduled_at",
        "user_documents",
        ["deletion_scheduled_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_user_documents_deletion_scheduled_at", table_name="user_documents")
    op.drop_column("user_documents", "deletion_scheduled_at")
