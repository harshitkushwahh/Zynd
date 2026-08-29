from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.application.admin.rbac_service import ensure_rbac_seed, set_admin_user_roles
from app.application.distributor.distributor_client_link_service import create_distributor_client_link
from app.application.distributor.distributor_client_service import (
    _list_distributor_client_goals,
)
from app.application.documents.client_id_service import assign_client_id
from app.application.family_groups.group_service import archive_family_group, create_family_group
from app.infrastructure.persistence.models import Session, User, UserRole, UserStatus
from app.infrastructure.security.passwords import hash_password
from app.infrastructure.security.tokens import create_access_token
from app.main import app

from tests.test_distributor_client_book import _mitra_auth_headers


async def _admin_auth_headers(
    db_session,
    *,
    role_keys: list[str],
) -> dict[str, str]:
    admin = User(
        email=f"distributor-admin-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        first_name="Dist",
        last_name="Admin",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(admin)
    await db_session.flush()
    await ensure_rbac_seed(db_session)
    await set_admin_user_roles(db_session, user_id=admin.id, role_keys=role_keys)

    session = Session(
        user_id=admin.id,
        refresh_token_hash=f"{uuid4().hex}{uuid4().hex}",
        token_family_id=admin.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    db_session.add(session)
    await db_session.commit()

    token = create_access_token(user_id=admin.id, role=admin.role.value, session_id=session.id)
    return {"Authorization": f"Bearer {token}", "X-Zynd-Client": "admin"}


@pytest.mark.asyncio
async def test_distributor_clients_requires_permission(db_session) -> None:
    transport = ASGITransport(app=app)
    headers = await _admin_auth_headers(db_session, role_keys=["mitra_state_head"])
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/distributor/clients", headers=headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_distributor_clients_list_and_detail(db_session) -> None:
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
        linked_item = next(item for item in items if str(item["user_id"]) == str(investor.id))
        assert linked_item["service_model"] == "pm"
        assert any(str(item["user_id"]) == str(investor.id) for item in items)

        detail = await client.get(
            f"/api/v1/distributor/clients/{investor.id}",
            headers=headers,
        )
        assert detail.status_code == 200, detail.text
        body = detail.json()
        assert body["display_name"] == "Asha Verma"
        assert "@" in body["email_masked"]
        assert body["summary"]["client_id"] == investor.client_id
        assert body["summary"]["service_model"] == "pm"

        by_client_id = await client.get(
            f"/api/v1/distributor/clients/{investor.client_id}",
            headers=headers,
        )
        assert by_client_id.status_code == 200


@pytest.mark.asyncio
async def test_distributor_orders_list_scoped_to_book(db_session) -> None:
    headers, mitra = await _mitra_auth_headers(db_session)

    investor = User(
        email=f"investor-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
        first_name="Ravi",
        last_name="Sharma",
    )
    db_session.add(investor)
    await db_session.flush()
    await assign_client_id(db_session, investor)
    await create_distributor_client_link(db_session, client_user=investor, actor=mitra)
    await db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/distributor/orders?scope=book", headers=headers)
        assert response.status_code == 200, response.text
        assert response.json()["items"] == []


@pytest.mark.asyncio
async def test_distributor_orders_requires_permission(db_session) -> None:
    transport = ASGITransport(app=app)
    headers = await _admin_auth_headers(db_session, role_keys=["mitra_state_head"])
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/distributor/orders", headers=headers)
    assert response.status_code == 403

    investor = User(
        email=f"investor-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
        first_name="Harshit",
        last_name="Kushwah",
    )
    db_session.add(investor)
    await db_session.flush()
    await assign_client_id(db_session, investor)

    created = await create_family_group(db_session, user=investor, title="Archived Household")
    await archive_family_group(db_session, group_id=created["id"], user=investor)
    await db_session.commit()

    goals = await _list_distributor_client_goals(db_session, user_id=investor.id)

    assert goals == []
