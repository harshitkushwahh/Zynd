"""Backfill investor account names from verified KYC PAN drafts.

Revision ID: 086_backfill_user_names_from_kyc_pan
Revises: 085_distributor_work_payroll
Create Date: 2026-08-22
"""

from __future__ import annotations

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "086_backfill_user_names_from_kyc_pan"
down_revision: Union[str, None] = "085_distributor_work_payroll"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NAME_MAX_LENGTH = 50


def _truncate(value: str) -> str:
    return value.strip()[:NAME_MAX_LENGTH]


def _names_from_pan_draft(pan_draft: dict[str, Any]) -> tuple[str | None, str | None, str | None]:
    first = str(pan_draft.get("firstName") or "").strip()
    middle = str(pan_draft.get("middleName") or "").strip()
    last = str(pan_draft.get("lastName") or "").strip()
    single_name_only = bool(pan_draft.get("singleNameOnly"))

    if first and last:
        return _truncate(first), _truncate(middle) if middle else None, _truncate(last)

    if first and single_name_only:
        return _truncate(first), _truncate(middle) if middle else None, None

    full = str(pan_draft.get("fullName") or "").strip()
    if full:
        parts = full.split()
        if len(parts) == 1:
            return _truncate(parts[0]), None, None
        if len(parts) == 2:
            return _truncate(parts[0]), None, _truncate(parts[1])
        return _truncate(parts[0]), _truncate(" ".join(parts[1:-1])), _truncate(parts[-1])

    if first:
        return _truncate(first), _truncate(middle) if middle else None, _truncate(last) if last else None

    return None, None, None


def upgrade() -> None:
    connection = op.get_bind()
    rows = connection.execute(
        sa.text(
            """
            SELECT u.id AS user_id, j.pan_draft_json AS pan_draft_json
            FROM users u
            INNER JOIN kyc_journey_states j ON j.user_id = u.id
            WHERE j.pan_verification_status = 'verified'
              AND j.pan_draft_json IS NOT NULL
              AND (u.first_name IS NULL OR btrim(u.first_name) = '')
            """
        )
    ).fetchall()

    updated = 0
    for row in rows:
        pan_draft = row.pan_draft_json
        if not isinstance(pan_draft, dict):
            continue

        first, middle, last = _names_from_pan_draft(pan_draft)
        if not first:
            continue

        single_name_only = bool(pan_draft.get("singleNameOnly"))
        if not last and not single_name_only:
            continue

        connection.execute(
            sa.text(
                """
                UPDATE users
                SET first_name = :first_name,
                    middle_name = :middle_name,
                    last_name = :last_name,
                    updated_at = now()
                WHERE id = :user_id
                  AND (first_name IS NULL OR btrim(first_name) = '')
                """
            ),
            {
                "user_id": row.user_id,
                "first_name": first,
                "middle_name": middle,
                "last_name": last,
            },
        )
        updated += 1

    print(f"[086_backfill_user_names_from_kyc_pan] Updated {updated} user(s).")


def downgrade() -> None:
    # Data backfill — names cannot be safely reverted.
    pass
