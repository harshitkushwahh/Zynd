"""Phase 1 document storage: dual buckets, provider metadata, encryption at rest.

Revision ID: 016_phase1_document_storage
Revises: 015_phase0_documents
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM

revision: str = "016_phase1_document_storage"
down_revision: Union[str, None] = "015_phase0_documents"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_PII_BUCKET = "zynd-pii-documents"
_PUBLIC_BUCKET = "zynd-public-assets"


def upgrade() -> None:
    storage_provider = ENUM("local", "s3", name="documentstorageprovider", create_type=False)
    storage_provider.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "user_documents",
        sa.Column(
            "storage_provider",
            storage_provider,
            nullable=True,
        ),
    )
    op.add_column(
        "user_documents",
        sa.Column("storage_bucket", sa.String(length=128), nullable=True),
    )

    connection = op.get_bind()
    connection.execute(
        sa.text(
            "UPDATE user_documents "
            "SET storage_provider = 'local', "
            f"storage_bucket = CASE WHEN doc_type = 'profile_image' THEN '{_PUBLIC_BUCKET}' "
            f"ELSE '{_PII_BUCKET}' END "
            "WHERE storage_provider IS NULL"
        )
    )

    op.alter_column("user_documents", "storage_provider", nullable=False)
    op.alter_column("user_documents", "storage_bucket", nullable=False)


def downgrade() -> None:
    op.drop_column("user_documents", "storage_bucket")
    op.drop_column("user_documents", "storage_provider")
    ENUM(name="documentstorageprovider").drop(op.get_bind(), checkfirst=True)
