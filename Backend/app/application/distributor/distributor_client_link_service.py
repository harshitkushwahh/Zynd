from __future__ import annotations

import secrets
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.rbac_service import (
    MITRA_MANAGER_ROLE_KEY,
    MITRA_ROLE_KEY,
    list_user_role_keys,
)
from app.application.distributor.distributor_branch_service import (
    get_distributor_branch_for_manager,
)
from app.infrastructure.persistence.distributor_partner_models import (
    DistributorClientLink,
    DistributorPartner,
    DistributorPartnerStatus,
)
from app.infrastructure.persistence.models import User, UserRole


class DistributorClientBookError(Exception):
    def __init__(self, message: str, code: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


async def _resolve_book_owner_for_actor(db: AsyncSession, actor: User) -> User:
    """Field Mitra acts as self; managers onboard into their own manager book."""
    role_keys = await list_user_role_keys(db, actor.id)
    if MITRA_ROLE_KEY in role_keys:
        return actor
    if MITRA_MANAGER_ROLE_KEY in role_keys:
        return actor
    raise DistributorClientBookError(
        "Only Zynd Mitras and branch managers can manage investor books.",
        "distributor_actor_required",
        403,
    )


async def _branch_id_for_actor(db: AsyncSession, actor: User) -> str | None:
    role_keys = await list_user_role_keys(db, actor.id)
    if MITRA_ROLE_KEY in role_keys:
        result = await db.execute(
            select(DistributorPartner.branch_id).where(
                DistributorPartner.user_id == actor.id,
                DistributorPartner.status == DistributorPartnerStatus.active,
            )
        )
        return result.scalar_one_or_none()
    if MITRA_MANAGER_ROLE_KEY in role_keys:
        branch = await get_distributor_branch_for_manager(db, manager_user_id=actor.id)
        return branch.id if branch else None
    return None


async def create_distributor_client_link(
    db: AsyncSession,
    *,
    client_user: User,
    actor: User,
    mitra_owner: User | None = None,
) -> DistributorClientLink:
    owner = mitra_owner or await _resolve_book_owner_for_actor(db, actor)
    if not owner.client_id:
        raise DistributorClientBookError(
            "Zynd Mitra code is missing for this book owner.",
            "mitra_code_missing",
            500,
        )

    existing = await db.execute(
        select(DistributorClientLink).where(DistributorClientLink.client_user_id == client_user.id)
    )
    if existing.scalar_one_or_none():
        raise DistributorClientBookError(
            "This investor is already linked to a Zynd Mitra book.",
            "client_already_linked",
            409,
        )

    link = DistributorClientLink(
        client_user_id=client_user.id,
        mitra_user_id=owner.id,
        mitra_client_id=owner.client_id,
        branch_id=await _branch_id_for_actor(db, owner),
        onboarded_by_user_id=actor.id,
    )
    db.add(link)
    await db.flush()
    return link


async def count_clients_for_mitra(db: AsyncSession, *, mitra_user_id: UUID) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(DistributorClientLink)
        .where(DistributorClientLink.mitra_user_id == mitra_user_id)
    )
    return int(result.scalar_one() or 0)


async def list_book_client_user_ids_for_actor(
    db: AsyncSession,
    *,
    actor: User,
) -> list[UUID]:
    role_keys = await list_user_role_keys(db, actor.id)

    if MITRA_ROLE_KEY in role_keys and MITRA_MANAGER_ROLE_KEY not in role_keys:
        result = await db.execute(
            select(DistributorClientLink.client_user_id).where(
                DistributorClientLink.mitra_user_id == actor.id
            )
        )
        return list(result.scalars())

    if MITRA_MANAGER_ROLE_KEY in role_keys:
        branch = await get_distributor_branch_for_manager(db, manager_user_id=actor.id)
        if not branch:
            return []
        partner_ids = await db.execute(
            select(DistributorPartner.user_id).where(
                DistributorPartner.branch_id == branch.id,
                DistributorPartner.status == DistributorPartnerStatus.active,
            )
        )
        mitra_ids = list(partner_ids.scalars())
        mitra_ids.append(actor.id)
        if not mitra_ids:
            return []
        result = await db.execute(
            select(DistributorClientLink.client_user_id).where(
                DistributorClientLink.mitra_user_id.in_(mitra_ids)
            )
        )
        return list(result.scalars())

    return []


async def actor_can_access_client(
    db: AsyncSession,
    *,
    actor: User,
    client_user_id: UUID,
) -> bool:
    allowed_ids = await list_book_client_user_ids_for_actor(db, actor=actor)
    return client_user_id in allowed_ids


async def get_client_link_for_user(
    db: AsyncSession,
    *,
    client_user_id: UUID,
) -> DistributorClientLink | None:
    result = await db.execute(
        select(DistributorClientLink).where(DistributorClientLink.client_user_id == client_user_id)
    )
    return result.scalar_one_or_none()


async def map_client_links_by_user_id(
    db: AsyncSession,
    *,
    client_user_ids: list[UUID],
) -> dict[UUID, DistributorClientLink]:
    if not client_user_ids:
        return {}
    result = await db.execute(
        select(DistributorClientLink).where(DistributorClientLink.client_user_id.in_(client_user_ids))
    )
    return {link.client_user_id: link for link in result.scalars().all()}


async def assert_actor_can_access_client(
    db: AsyncSession,
    *,
    actor: User,
    client_user: User,
) -> None:
    if client_user.role != UserRole.user:
        raise DistributorClientBookError("Client not found.", "client_not_found", 404)
    if not await actor_can_access_client(db, actor=actor, client_user_id=client_user.id):
        raise DistributorClientBookError(
            "This client is not in your Zynd Mitra book.",
            "client_not_in_book",
            403,
        )


async def assert_actor_can_read_client_profile(
    db: AsyncSession,
    *,
    actor: User,
    client_user: User,
) -> None:
    """Book clients require a link; Mitras and managers may also read platform investor profiles."""
    if client_user.role != UserRole.user:
        raise DistributorClientBookError("Client not found.", "client_not_found", 404)
    if await actor_can_access_client(db, actor=actor, client_user_id=client_user.id):
        return

    role_keys = await list_user_role_keys(db, actor.id)
    if MITRA_ROLE_KEY in role_keys or MITRA_MANAGER_ROLE_KEY in role_keys:
        return

    raise DistributorClientBookError(
        "This client is not in your Zynd Mitra book.",
        "client_not_in_book",
        403,
    )


def serialize_client_link(link: DistributorClientLink | None) -> dict[str, Any] | None:
    if link is None:
        return None
    return {
        "mitra_user_id": link.mitra_user_id,
        "mitra_client_id": link.mitra_client_id,
        "branch_id": link.branch_id,
        "onboarded_by_user_id": link.onboarded_by_user_id,
        "linked_at": link.created_at,
    }
