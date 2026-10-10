from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.rbac_service import (
    DISTRIBUTOR_MANAGER_ROLE_KEY,
    DISTRIBUTOR_PARTNER_ROLE_KEY,
    ensure_rbac_seed,
    set_admin_user_roles,
)
from app.application.documents.client_id_service import assign_client_id
from app.core.config import Settings, get_settings
from app.infrastructure.persistence.distributor_branch_models import (
    DistributorBranch,
    DistributorBranchStatus,
)
from app.infrastructure.persistence.distributor_partner_models import (
    DistributorPartner,
    DistributorPartnerStatus,
)
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from app.infrastructure.security.password_policy import validate_password_strength
from app.infrastructure.security.passwords import hash_password, verify_password

DEV_MITRA_EMAIL = "mitra@zynd.com"
DEV_MITRA_MANAGER_EMAIL = "mitra.manager@zynd.com"
DEV_MITRA_PASSWORD = "Zynd@1234"
DEV_MITRA_BRANCH_ID = "br-dev-mitra"


async def _ensure_dev_console_user(
    db: AsyncSession,
    *,
    email: str,
    first_name: str,
    last_name: str,
    role_key: str,
    now: datetime,
) -> tuple[User, bool]:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    created = user is None

    if user is None:
        user = User(
            email=email,
            password_hash=hash_password(DEV_MITRA_PASSWORD),
            first_name=first_name,
            last_name=last_name,
            role=UserRole.admin,
            status=UserStatus.active,
            email_verified_at=now,
        )
        await assign_client_id(db, user)
        db.add(user)
        await db.flush()
    else:
        user.role = UserRole.admin
        user.status = UserStatus.active
        if user.email_verified_at is None:
            user.email_verified_at = now
        if not verify_password(user.password_hash, DEV_MITRA_PASSWORD):
            user.password_hash = hash_password(DEV_MITRA_PASSWORD)

    await set_admin_user_roles(db, user_id=user.id, role_keys=[role_key])
    return user, created


async def _ensure_dev_mitra_branch(
    db: AsyncSession,
    *,
    manager_user_id,
    now: datetime,
) -> DistributorBranch:
    branch = await db.get(DistributorBranch, DEV_MITRA_BRANCH_ID)
    if branch is None:
        branch = DistributorBranch(
            id=DEV_MITRA_BRANCH_ID,
            branch_code="DEVMITRA",
            name="Dev Mitra Branch",
            city="Mumbai",
            state_code="MH",
            state_name="Maharashtra",
            status=DistributorBranchStatus.active,
            manager_user_id=manager_user_id,
            approved_at=now,
        )
        db.add(branch)
        await db.flush()
        return branch

    branch.status = DistributorBranchStatus.active
    branch.manager_user_id = manager_user_id
    await db.flush()
    return branch


async def _ensure_dev_mitra_partner(
    db: AsyncSession,
    *,
    mitra_user: User,
    manager_user: User,
    branch_id: str,
) -> None:
    result = await db.execute(
        select(DistributorPartner).where(DistributorPartner.user_id == mitra_user.id)
    )
    partner = result.scalar_one_or_none()
    if partner is None:
        partner = DistributorPartner(
            user_id=mitra_user.id,
            onboarded_by_user_id=manager_user.id,
            branch_id=branch_id,
            status=DistributorPartnerStatus.active,
            ho_reviewed_by_user_id=manager_user.id,
            ho_reviewed_at=datetime.now(timezone.utc),
        )
        db.add(partner)
    else:
        partner.branch_id = branch_id
        partner.status = DistributorPartnerStatus.active
        if partner.onboarded_by_user_id is None:
            partner.onboarded_by_user_id = manager_user.id
    await db.flush()


async def ensure_dev_mitra_seed(
    db: AsyncSession,
    settings: Settings | None = None,
    *,
    force: bool = False,
) -> dict[str, object]:
    settings = settings or get_settings()
    if settings.app_env != "development" and not force:
        return {"skipped": True}

    validate_password_strength(DEV_MITRA_PASSWORD)
    await ensure_rbac_seed(db)

    now = datetime.now(timezone.utc)

    manager, manager_created = await _ensure_dev_console_user(
        db,
        email=DEV_MITRA_MANAGER_EMAIL,
        first_name="Mitra",
        last_name="Manager",
        role_key=DISTRIBUTOR_MANAGER_ROLE_KEY,
        now=now,
    )
    branch = await _ensure_dev_mitra_branch(db, manager_user_id=manager.id, now=now)

    mitra, mitra_created = await _ensure_dev_console_user(
        db,
        email=DEV_MITRA_EMAIL,
        first_name="Dev",
        last_name="Mitra",
        role_key=DISTRIBUTOR_PARTNER_ROLE_KEY,
        now=now,
    )
    await _ensure_dev_mitra_partner(
        db,
        mitra_user=mitra,
        manager_user=manager,
        branch_id=branch.id,
    )

    return {
        "skipped": False,
        "password": DEV_MITRA_PASSWORD,
        "branch_id": branch.id,
        "users": [
            {
                "created": manager_created,
                "email": DEV_MITRA_MANAGER_EMAIL,
                "account_role": UserRole.admin.value,
                "team_role": DISTRIBUTOR_MANAGER_ROLE_KEY,
            },
            {
                "created": mitra_created,
                "email": DEV_MITRA_EMAIL,
                "account_role": UserRole.admin.value,
                "team_role": DISTRIBUTOR_PARTNER_ROLE_KEY,
            },
        ],
    }
