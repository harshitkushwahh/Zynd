"""Add pause status to distributor_state_heads.

Revision ID: 078_state_head_status
Revises: 077_dist_branch_workflow
Create Date: 2026-08-14
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "078_state_head_status"
down_revision: Union[str, None] = "077_dist_branch_workflow"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "distributor_state_heads",
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default="active",
        ),
    )


def downgrade() -> None:
    op.drop_column("distributor_state_heads", "status")
