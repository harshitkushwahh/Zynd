from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import DataRetentionSchedule

RETENTION_POLICIES: list[dict[str, object]] = [
    {
        "id": UUID("00000000-0000-4000-8000-000000000001"),
        "data_class": "auth_credentials",
        "min_retention_days": 30,
        "legal_basis": "DPDP",
        "can_delete_on_request": True,
        "notes": "Grace period after deletion request",
    },
    {
        "id": UUID("00000000-0000-4000-8000-000000000002"),
        "data_class": "profile_pii",
        "min_retention_days": 30,
        "legal_basis": "DPDP",
        "can_delete_on_request": True,
        "notes": "Anonymized after grace window",
    },
    {
        "id": UUID("00000000-0000-4000-8000-000000000003"),
        "data_class": "kyc_documents",
        "min_retention_days": 1825,
        "legal_basis": "PMLA",
        "can_delete_on_request": False,
        "notes": "Placeholder — confirm with compliance counsel",
    },
    {
        "id": UUID("00000000-0000-4000-8000-000000000004"),
        "data_class": "transaction_records",
        "min_retention_days": 2920,
        "legal_basis": "PMLA/SEBI",
        "can_delete_on_request": False,
        "notes": "Placeholder — confirm with compliance counsel",
    },
    {
        "id": UUID("00000000-0000-4000-8000-000000000005"),
        "data_class": "audit_logs",
        "min_retention_days": 2920,
        "legal_basis": "Compliance",
        "can_delete_on_request": False,
        "notes": "Append-only retention",
    },
    {
        "id": UUID("00000000-0000-4000-8000-000000000006"),
        "data_class": "deletion_ledger",
        "min_retention_days": 3650,
        "legal_basis": "Compliance",
        "can_delete_on_request": False,
        "notes": "Proof of deletion handling",
    },
    {
        "id": UUID("00000000-0000-4000-8000-000000000007"),
        "data_class": "user_notifications",
        "min_retention_days": 365,
        "legal_basis": "DPDP",
        "can_delete_on_request": True,
        "notes": "Read in-app notifications; unread retained until read",
    },
]


async def ensure_retention_seed(db: AsyncSession) -> None:
    for policy in RETENTION_POLICIES:
        result = await db.execute(
            select(DataRetentionSchedule).where(
                DataRetentionSchedule.data_class == policy["data_class"]
            )
        )
        if result.scalar_one_or_none():
            continue
        db.add(DataRetentionSchedule(**policy))
    await db.flush()


async def list_retention_policies(db: AsyncSession) -> list[dict[str, object]]:
    result = await db.execute(
        select(DataRetentionSchedule).order_by(DataRetentionSchedule.data_class.asc())
    )
    return [
        {
            "data_class": row.data_class,
            "min_retention_days": row.min_retention_days,
            "legal_basis": row.legal_basis,
            "can_delete_on_request": row.can_delete_on_request,
            "notes": row.notes,
        }
        for row in result.scalars()
    ]


async def get_retention_policy(db: AsyncSession, data_class: str) -> DataRetentionSchedule | None:
    result = await db.execute(
        select(DataRetentionSchedule).where(DataRetentionSchedule.data_class == data_class)
    )
    return result.scalar_one_or_none()


async def can_delete_on_request(db: AsyncSession, data_class: str) -> bool:
    policy = await get_retention_policy(db, data_class)
    if not policy:
        return True
    return policy.can_delete_on_request
