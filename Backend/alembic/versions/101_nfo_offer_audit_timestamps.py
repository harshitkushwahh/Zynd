"""NFO offer audit timestamps for graduation history.

Revision ID: 101_nfo_offer_audit
Revises: 100_nfo_offers
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "101_nfo_offer_audit"
down_revision: Union[str, None] = "100_nfo_offers"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("nfo_offers", sa.Column("first_listed_at", sa.Date(), nullable=True))
    op.add_column("nfo_offers", sa.Column("subscription_closed_at", sa.Date(), nullable=True))
    op.add_column("nfo_offers", sa.Column("graduated_at", sa.Date(), nullable=True))
    op.execute(
        sa.text(
            """
            UPDATE nfo_offers
            SET first_listed_at = (created_at AT TIME ZONE 'UTC')::date
            WHERE status IN ('OPEN', 'UPCOMING', 'CLOSED', 'ALLOTTED')
              AND first_listed_at IS NULL
            """
        )
    )


def downgrade() -> None:
    op.drop_column("nfo_offers", "graduated_at")
    op.drop_column("nfo_offers", "subscription_closed_at")
    op.drop_column("nfo_offers", "first_listed_at")
