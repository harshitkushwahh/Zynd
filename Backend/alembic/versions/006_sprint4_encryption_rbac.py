"""Revision ID: 006_sprint4_encryption_rbac
Revises: 005_sprint3_security_review
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "006_sprint4_encryption_rbac"
down_revision: Union[str, None] = "005_sprint3_security_review"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

pii_field_type = postgresql.ENUM("pan", "aadhaar", "bank_account", name="piifieldtype", create_type=False)


def upgrade() -> None:
    op.execute("ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS 'transfer_requested'")
    pii_field_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "encrypted_pii_records",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("field_type", pii_field_type, nullable=False),
        sa.Column("ciphertext", sa.Text(), nullable=False),
        sa.Column("key_version", sa.SmallInteger(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "field_type", name="uq_encrypted_pii_user_field"),
    )
    op.create_index("ix_encrypted_pii_records_user_id", "encrypted_pii_records", ["user_id"])

    op.create_table(
        "admin_permissions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )
    op.create_index("ix_admin_permissions_key", "admin_permissions", ["key"])

    op.create_table(
        "admin_roles",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )
    op.create_index("ix_admin_roles_key", "admin_roles", ["key"])

    op.create_table(
        "admin_role_permissions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("role_id", sa.UUID(), nullable=False),
        sa.Column("permission_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["permission_id"], ["admin_permissions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["role_id"], ["admin_roles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("role_id", "permission_id", name="uq_admin_role_permission"),
    )

    op.create_table(
        "admin_user_role_assignments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("role_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["role_id"], ["admin_roles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "role_id", name="uq_admin_user_role"),
    )
    op.create_index("ix_admin_user_role_assignments_user_id", "admin_user_role_assignments", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_admin_user_role_assignments_user_id", table_name="admin_user_role_assignments")
    op.drop_table("admin_user_role_assignments")
    op.drop_table("admin_role_permissions")
    op.drop_index("ix_admin_roles_key", table_name="admin_roles")
    op.drop_table("admin_roles")
    op.drop_index("ix_admin_permissions_key", table_name="admin_permissions")
    op.drop_table("admin_permissions")
    op.drop_index("ix_encrypted_pii_records_user_id", table_name="encrypted_pii_records")
    op.drop_table("encrypted_pii_records")
    pii_field_type.drop(op.get_bind(), checkfirst=True)
