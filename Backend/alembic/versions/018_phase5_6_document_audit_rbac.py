"""Phase 5-6: document audit events.

Revision ID: 018_phase5_6_document_audit_rbac
Revises: 017_phase3_document_scan
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "018_phase5_6_document_audit_rbac"
down_revision: Union[str, None] = "017_phase3_document_scan"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_DOCUMENT_AUDIT_EVENTS = (
    "document_uploaded",
    "document_scan_passed",
    "document_scan_failed",
    "document_quarantined",
    "document_download_requested",
    "document_viewed_by_admin",
)


def upgrade() -> None:
    for value in _DOCUMENT_AUDIT_EVENTS:
        op.execute(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    pass
