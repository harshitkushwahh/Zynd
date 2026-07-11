"""Phase 0 document management: client_id on users and user_documents table.

Revision ID: 015_phase0_documents
Revises: 014_pin_biometric_webauthn
"""

from __future__ import annotations

import re
import secrets
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM, UUID

revision: str = "015_phase0_documents"
down_revision: Union[str, None] = "014_pin_biometric_webauthn"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_CLIENT_ID_SUFFIX = "@zynd"
_MAX_PREFIX_LEN = 48


def _sanitize_token(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def _build_client_id_candidate(email: str, phone: str | None) -> str:
    local_part = email.split("@", 1)[0]
    tokens = [token for token in re.split(r"[._+\-]+", local_part) if token]
    first = _sanitize_token(tokens[0]) if tokens else "user"
    second = _sanitize_token(tokens[1]) if len(tokens) > 1 else ""
    prefix = (first + second)[:_MAX_PREFIX_LEN] or "user"
    phone_digits = "".join(character for character in (phone or "") if character.isdigit())
    if not phone_digits:
        phone_digits = secrets.token_hex(4)
    return f"{prefix}{phone_digits}{_CLIENT_ID_SUFFIX}"


def _with_collision_suffix(client_id: str, attempt: int) -> str:
    if attempt <= 1:
        return client_id
    if client_id.endswith(_CLIENT_ID_SUFFIX):
        stem = client_id[: -len(_CLIENT_ID_SUFFIX)]
        return f"{stem}-{attempt}{_CLIENT_ID_SUFFIX}"
    return f"{client_id}-{attempt}"


def upgrade() -> None:
    op.add_column("users", sa.Column("client_id", sa.String(length=128), nullable=True))
    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, email, phone FROM users")).fetchall()
    used: set[str] = set()
    for row in rows:
        candidate = _build_client_id_candidate(row.email, row.phone)
        attempt = 1
        while True:
            current = _with_collision_suffix(candidate, attempt)
            if current not in used:
                used.add(current)
                break
            attempt += 1
        connection.execute(
            sa.text("UPDATE users SET client_id = :client_id WHERE id = :user_id"),
            {"client_id": current, "user_id": row.id},
        )

    op.alter_column("users", "client_id", nullable=False)
    op.create_index("ix_users_client_id", "users", ["client_id"], unique=True)

    document_type = ENUM(
        "aadhaar",
        "pan",
        "profile_image",
        "bank_statement",
        "signature",
        "address_proof",
        name="documenttype",
        create_type=False,
    )
    document_status = ENUM("active", name="documentstatus", create_type=False)
    document_type.create(op.get_bind(), checkfirst=True)
    document_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "user_documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False, default=uuid.uuid4),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", sa.String(length=128), nullable=False),
        sa.Column("doc_type", document_type, nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=127), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("status", document_status, nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "doc_type", "version", name="uq_user_documents_type_version"),
    )
    op.create_index("ix_user_documents_user_id", "user_documents", ["user_id"])
    op.create_index("ix_user_documents_client_id", "user_documents", ["client_id"])
    op.create_index("ix_user_documents_doc_type", "user_documents", ["doc_type"])


def downgrade() -> None:
    op.drop_index("ix_user_documents_doc_type", table_name="user_documents")
    op.drop_index("ix_user_documents_client_id", table_name="user_documents")
    op.drop_index("ix_user_documents_user_id", table_name="user_documents")
    op.drop_table("user_documents")
    op.drop_index("ix_users_client_id", table_name="users")
    op.drop_column("users", "client_id")
    ENUM(name="documentstatus").drop(op.get_bind(), checkfirst=True)
    ENUM(name="documenttype").drop(op.get_bind(), checkfirst=True)
