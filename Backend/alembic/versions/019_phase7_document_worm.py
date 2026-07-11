"""Phase 7: document WORM + legal hold.

Revision ID: 019_phase7_document_worm
Revises: 018_phase5_6_document_audit_rbac
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "019_phase7_document_worm"
down_revision: Union[str, None] = "018_phase5_6_document_audit_rbac"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_WORM_AUDIT_EVENTS = (
    "document_verified",
    "document_legal_hold_updated",
    "document_deleted",
)


def upgrade() -> None:
    op.add_column(
        "user_documents",
        sa.Column("immutable_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "user_documents",
        sa.Column("legal_hold", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    for value in _WORM_AUDIT_EVENTS:
        op.execute(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    op.drop_column("user_documents", "legal_hold")
    op.drop_column("user_documents", "immutable_at")
