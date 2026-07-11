"""Phase 3 async document scan: pending_scan lifecycle and worker statuses.

Revision ID: 017_phase3_document_scan
Revises: 016_phase1_document_storage
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "017_phase3_document_scan"
down_revision: Union[str, None] = "016_phase1_document_storage"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for value in ("pending_scan", "rejected", "quarantined"):
        op.execute(f"ALTER TYPE documentstatus ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    pass
