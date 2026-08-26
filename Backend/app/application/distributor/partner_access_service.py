from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.rbac_service import (
    DISTRIBUTOR_CONSOLE_ROLE_KEYS,
    DISTRIBUTOR_MANAGER_ROLE_KEY,
    DISTRIBUTOR_PARTNER_ROLE_KEY,
    list_user_role_keys,
)
from app.application.auth.errors import AuthError
from app.core.config import Settings
from app.infrastructure.persistence.distributor_partner_models import (
    DistributorPartner,
    DistributorPartnerStatus,
)
from app.infrastructure.persistence.models import User


async def get_distributor_partner_for_user(
    db: AsyncSession,
    user_id: UUID,
) -> DistributorPartner | None:
    result = await db.execute(select(DistributorPartner).where(DistributorPartner.user_id == user_id))
    return result.scalar_one_or_none()


async def user_is_distributor_console_account(db: AsyncSession, user_id: UUID) -> bool:
    role_keys = await list_user_role_keys(db, user_id)
    if any(key in DISTRIBUTOR_CONSOLE_ROLE_KEYS for key in role_keys):
        return True
    partner = await get_distributor_partner_for_user(db, user_id)
    return partner is not None


def resolve_auth_client_hint(*, body_client: str | None, header_client: str | None) -> str | None:
    for candidate in (body_client, header_client):
        if candidate and candidate.strip():
            return candidate.strip().lower()
    return None


def origin_suggests_distributor_console(origin: str | None, referer: str | None = None) -> bool:
    for value in (origin, referer):
        if not value:
            continue
        lowered = value.lower()
        if ":9900" in lowered or "distributor" in lowered:
            return True
    return False


async def resolve_password_reset_target(
    db: AsyncSession,
    settings: Settings,
    *,
    user: User,
    client: str | None = None,
    origin: str | None = None,
    referer: str | None = None,
) -> tuple[str, str]:
    distributor_base = settings.distributor_frontend_url.rstrip("/")
    admin_base = settings.admin_frontend_url.rstrip("/")
    web_base = settings.frontend_url.rstrip("/")

    normalized_client = (client or "").strip().lower()
    is_distributor_account = await user_is_distributor_console_account(db, user.id)

    if (
        is_distributor_account
        or normalized_client == "distributor"
        or origin_suggests_distributor_console(origin, referer)
    ):
        return distributor_base, "Zynd Mitra console"
    if normalized_client == "admin":
        return admin_base, "ZYND Admin"
    return web_base, "ZYND"


async def assert_distributor_partner_may_set_password(
    db: AsyncSession,
    *,
    user: User,
) -> None:
    partner = await get_distributor_partner_for_user(db, user.id)
    if partner is None:
        return

    if partner.status == DistributorPartnerStatus.pending_ho_review:
        raise AuthError(
            "Your Zynd Mitra application is pending HO review. "
            "You will receive an email to set your password once it is approved.",
            "distributor_partner_pending_review",
            403,
        )
    if partner.status == DistributorPartnerStatus.rejected:
        raise AuthError(
            "Your Zynd Mitra application was not approved.",
            "distributor_partner_rejected",
            403,
        )


async def distributor_partner_may_request_password_reset(
    db: AsyncSession,
    *,
    user: User,
) -> bool:
    """Return False when a Mitra partner must not receive a reset email yet."""
    partner = await get_distributor_partner_for_user(db, user.id)
    if partner is None:
        return True
    return partner.status not in {
        DistributorPartnerStatus.pending_ho_review,
        DistributorPartnerStatus.rejected,
    }


async def assert_distributor_partner_may_request_password_reset(
    db: AsyncSession,
    *,
    user: User,
) -> None:
    partner = await get_distributor_partner_for_user(db, user.id)
    if partner is None:
        return

    if partner.status == DistributorPartnerStatus.pending_ho_review:
        raise AuthError(
            "Your Zynd Mitra application is pending HO review. "
            "You will receive an email to set your password once it is approved.",
            "distributor_partner_pending_review",
            403,
        )
    if partner.status == DistributorPartnerStatus.rejected:
        raise AuthError(
            "Your Zynd Mitra application was not approved.",
            "distributor_partner_rejected",
            403,
        )


async def assert_distributor_partner_may_sign_in(
    db: AsyncSession,
    *,
    user: User,
    role_keys: list[str],
) -> None:
    if DISTRIBUTOR_MANAGER_ROLE_KEY in role_keys:
        return

    if DISTRIBUTOR_PARTNER_ROLE_KEY not in role_keys:
        return

    partner = await get_distributor_partner_for_user(db, user.id)
    if partner is None:
        return

    if partner.status == DistributorPartnerStatus.pending_ho_review:
        raise AuthError(
            "Your Zynd Mitra application is pending HO review. "
            "You will receive an email to set your password once it is approved.",
            "distributor_partner_pending_review",
            403,
        )
    if partner.status == DistributorPartnerStatus.rejected:
        raise AuthError(
            "Your Zynd Mitra application was not approved.",
            "distributor_partner_rejected",
            403,
        )
    if partner.status == DistributorPartnerStatus.pending_password:
        raise AuthError(
            "Set your password using the link sent to your email before signing in.",
            "distributor_partner_password_required",
            403,
        )
