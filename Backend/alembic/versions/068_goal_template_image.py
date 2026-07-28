"""Goal template illustration URL.

Revision ID: 068_goal_template_image
Revises: 067_goal_portfolio
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "068_goal_template_image"
down_revision: Union[str, None] = "067_goal_portfolio"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("goal_templates", sa.Column("image_url", sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column("goal_templates", "image_url")
