from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.rbac_service import ensure_rbac_seed, set_admin_user_roles
from app.application.documents.client_id_service import (
    assign_client_id,
    assign_zynd_persona_client_id,
    ZYND_PERSONA_MITRA,
)
from app.application.distributor.distributor_client_link_service import create_distributor_client_link
from app.infrastructure.persistence.distributor_partner_models import (
    DistributorPartner,
    DistributorPartnerStatus,
)
from app.infrastructure.persistence.distributor_branch_models import DistributorBranch, DistributorBranchStatus
from app.infrastructure.persistence.models import Session, User, UserRole, UserStatus
from app.infrastructure.security.passwords import hash_password
from app.infrastructure.security.tokens import create_access_token
from app.main import app


async def _mitra_auth_headers(
    db_session: AsyncSession,
    *,
    mitra_code: str = "ZYND-M-HK001",
) -> tuple[dict[str, str], User]:
    mitra = User(
        email=f"mitra-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        first_name="Harshit",
        last_name="Kushwah",
        role=UserRole.admin,
        status=UserStatus.active,
        phone=f"9{uuid4().int % 10_000_000_000:09d}",
    )
    db_session.add(mitra)
    await db_session.flush()
    mitra.client_id = mitra_code
    await db_session.flush()

    branch = DistributorBranch(
        id=f"BR-{uuid4().hex[:8]}",
        name="Test Branch",
        city="Mumbai",
        status=DistributorBranchStatus.active,
    )
    db_session.add(branch)
    await db_session.flush()

    partner = DistributorPartner(
        user_id=mitra.id,
        branch_id=branch.id,
        status=DistributorPartnerStatus.active,
    )
    db_session.add(partner)

    await ensure_rbac_seed(db_session)
    await set_admin_user_roles(db_session, user_id=mitra.id, role_keys=["mitra"])

    session = Session(
        user_id=mitra.id,
        refresh_token_hash=f"{uuid4().hex}{uuid4().hex}",
        token_family_id=mitra.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    db_session.add(session)
    await db_session.commit()

    token = create_access_token(user_id=mitra.id, role=mitra.role.value, session_id=session.id)
    headers = {"Authorization": f"Bearer {token}", "X-Zynd-Client": "admin"}
    return headers, mitra


@pytest.mark.asyncio
async def test_distributor_clients_requires_book_link(db_session: AsyncSession) -> None:
    investor = User(
        email=f"investor-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(investor)
    await db_session.flush()
    await assign_client_id(db_session, investor)
    await db_session.commit()

    headers, _ = await _mitra_auth_headers(db_session)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        listed = await client.get("/api/v1/distributor/clients", headers=headers)
    assert listed.status_code == 200
    assert listed.json()["items"] == []


@pytest.mark.asyncio
async def test_distributor_clients_list_scoped_to_mitra_book(db_session: AsyncSession) -> None:
    headers, mitra = await _mitra_auth_headers(db_session)

    investor = User(
        email=f"investor-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
        first_name="Asha",
        last_name="Verma",
    )
    db_session.add(investor)
    await db_session.flush()
    await assign_client_id(db_session, investor)
    await create_distributor_client_link(db_session, client_user=investor, actor=mitra)
    await db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        listed = await client.get("/api/v1/distributor/clients", headers=headers)
        assert listed.status_code == 200, listed.text
        items = listed.json()["items"]
        assert len(items) == 1
        assert items[0]["client_id"] == investor.client_id
        assert items[0]["mitra_client_id"] == mitra.client_id

        detail = await client.get(
            f"/api/v1/distributor/clients/{investor.client_id}",
            headers=headers,
        )
        assert detail.status_code == 200, detail.text
        body = detail.json()
        assert body["book_link"]["mitra_client_id"] == mitra.client_id


@pytest.mark.asyncio
async def test_partner_onboarding_assigns_zynd_mitra_code(db_session: AsyncSession) -> None:
    user = User(
        email=f"partner-{uuid4()}@example.com",
        role=UserRole.admin,
        status=UserStatus.active,
        first_name="Neha",
        last_name="Patil",
    )
    db_session.add(user)
    await db_session.flush()
    await assign_zynd_persona_client_id(
        db_session,
        user,
        role_code=ZYND_PERSONA_MITRA,
        first_name=user.first_name,
        last_name=user.last_name,
    )
    assert user.client_id == "ZYND-M-NP001"
