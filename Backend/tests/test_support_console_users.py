from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_support_console_users_requires_auth() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/support/console/users")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_support_console_users_route_registered() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/support/console/users/habawakesa9382202302")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_support_console_user_kyc_registry_requires_auth() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/v1/support/console/users/habawakesa9382202302/kyc-registry",
        )
    assert response.status_code == 401
