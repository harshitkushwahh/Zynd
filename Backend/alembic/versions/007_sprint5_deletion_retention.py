"""Revision ID: 007_sprint5_deletion_retention
Revises: 006_sprint4_encryption_rbac
"""

from typing import Sequence, Union

from alembic import op

revision: str = "007_sprint5_deletion_retention"
down_revision: Union[str, None] = "006_sprint4_encryption_rbac"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS 'account_deletion_executed'")


def downgrade() -> None:
    pass
