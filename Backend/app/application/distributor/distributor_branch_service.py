from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.distributor_branch_models import DistributorBranch


async def get_distributor_branch_for_manager(
    db: AsyncSession,
    *,
    manager_user_id: UUID,
) -> DistributorBranch | None:
    result = await db.execute(
        select(DistributorBranch).where(DistributorBranch.manager_user_id == manager_user_id)
    )
    return result.scalar_one_or_none()


async def get_distributor_branch_by_id(
    db: AsyncSession,
    branch_id: str,
) -> DistributorBranch | None:
    normalized = branch_id.strip()
    if not normalized:
        return None
    return await db.get(DistributorBranch, normalized)


def serialize_distributor_branch(branch: DistributorBranch) -> dict[str, str | None]:
    return {
        "id": branch.id,
        "name": branch.name,
        "city": branch.city,
        "state_code": branch.state_code,
        "state_name": branch.state_name,
    }
