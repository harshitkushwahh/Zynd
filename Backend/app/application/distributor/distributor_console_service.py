from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.rbac_service import (
    DISTRIBUTOR_MANAGER_ROLE_KEY,
    DISTRIBUTOR_PARTNER_ROLE_KEY,
    list_user_role_keys,
)
from app.application.distributor.distributor_auth_service import assert_distributor_console_access
from app.application.distributor.distributor_branch_service import (
    get_distributor_branch_by_id,
    get_distributor_branch_for_manager,
    serialize_distributor_branch,
)
from app.infrastructure.persistence.distributor_partner_models import DistributorPartner
from app.infrastructure.persistence.models import User


async def get_distributor_console_context(
    db: AsyncSession,
    *,
    user: User,
) -> dict[str, object]:
    role_keys = await list_user_role_keys(db, user.id)
    persona = assert_distributor_console_access(role_keys)

    branch = None
    if DISTRIBUTOR_MANAGER_ROLE_KEY in role_keys:
        branch = await get_distributor_branch_for_manager(db, manager_user_id=user.id)
    elif DISTRIBUTOR_PARTNER_ROLE_KEY in role_keys:
        result = await db.execute(
            select(DistributorPartner).where(DistributorPartner.user_id == user.id).limit(1)
        )
        partner = result.scalar_one_or_none()
        if partner and partner.branch_id:
            branch = await get_distributor_branch_by_id(db, partner.branch_id)

    branch_payload = serialize_distributor_branch(branch) if branch else None

    return {
        "persona": persona,
        "client_id": user.client_id,
        "phone_masked": (user.phone or "").strip(),
        "branch": branch_payload,
        "branch_assigned": branch_payload is not None,
    }
