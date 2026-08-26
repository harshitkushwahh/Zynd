from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.rbac_service import ensure_rbac_seed, set_admin_user_roles
from app.infrastructure.persistence.distributor_branch_models import DistributorBranch, DistributorBranchStatus
from app.infrastructure.persistence.distributor_partner_models import DistributorPartner, DistributorPartnerStatus
from app.infrastructure.persistence.distributor_work_models import DistributorPayrollPeriod, DistributorSalaryPaymentStatus
from app.infrastructure.persistence.models import Session, User, UserRole, UserStatus
from app.infrastructure.security.passwords import hash_password
from app.infrastructure.security.tokens import create_access_token
from app.main import app


async def _mitra_auth_headers(db_session: AsyncSession) -> tuple[dict[str, str], User]:
    mitra = User(
        email=f"mitra-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        first_name="Work",
        last_name="Mitra",
        role=UserRole.admin,
        status=UserStatus.active,
        phone=f"9{uuid4().int % 10_000_000_000:09d}",
    )
    db_session.add(mitra)
    await db_session.flush()
    mitra.client_id = f"ZYND-M-WK{uuid4().hex[:4].upper()}"
    await db_session.flush()

    branch = DistributorBranch(
        id=f"BR-{uuid4().hex[:8]}",
        name="Work Branch",
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
    headers = {"Authorization": f"Bearer {token}", "X-Zynd-Client": "distributor"}
    return headers, mitra


@pytest.mark.asyncio
async def test_work_sign_in_and_sign_out(db_session: AsyncSession) -> None:
    headers, _ = await _mitra_auth_headers(db_session)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        config = await client.get("/api/v1/distributor/work/config", headers=headers)
        assert config.status_code == 200
        assert config.json()["workModes"]

        sign_in = await client.post(
            "/api/v1/distributor/work/sessions/sign-in",
            headers=headers,
            json={
                "workSiteId": "office",
                "workModeId": "office",
                "timeSlotId": "full-day",
                "remarks": "Morning shift",
                "geolocation": {"latitude": 19.076, "longitude": 72.8777, "accuracy": 25},
            },
        )
        assert sign_in.status_code == 200
        assert sign_in.json()["status"] == "active"

        active = await client.get("/api/v1/distributor/work/sessions/active", headers=headers)
        assert active.status_code == 200
        assert active.json()["session"] is not None

        duplicate = await client.post(
            "/api/v1/distributor/work/sessions/sign-in",
            headers=headers,
            json={
                "workSiteId": "office",
                "workModeId": "office",
                "timeSlotId": "full-day",
                "geolocation": {"latitude": 19.076, "longitude": 72.8777, "accuracy": 25},
            },
        )
        assert duplicate.status_code == 409

        sign_out = await client.post("/api/v1/distributor/work/sessions/sign-out", headers=headers)
        assert sign_out.status_code == 200
        assert sign_out.json()["status"] == "complete"

        attendance = await client.get("/api/v1/distributor/work/attendance", headers=headers)
        assert attendance.status_code == 200
        assert len(attendance.json()["items"]) == 1


@pytest.mark.asyncio
async def test_payroll_dashboard_without_period(db_session: AsyncSession) -> None:
    headers, _ = await _mitra_auth_headers(db_session)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        dashboard = await client.get("/api/v1/distributor/work/payroll/dashboard", headers=headers)
        assert dashboard.status_code == 200
        body = dashboard.json()
        assert body["promotion"] is None
        assert body["compensation"]["basicSalary"] == 0


@pytest.mark.asyncio
async def test_payroll_dashboard_with_period(db_session: AsyncSession) -> None:
    headers, mitra = await _mitra_auth_headers(db_session)
    db_session.add(
        DistributorPayrollPeriod(
            id="aug-2026",
            mitra_user_id=mitra.id,
            period_label="August 2026",
            period_start=datetime(2026, 8, 1).date(),
            period_end=datetime(2026, 8, 31).date(),
            basic_salary=Decimal("45000"),
            performance_incentive=Decimal("8000"),
            spot_bonus=Decimal("1000"),
            deductions=Decimal("500"),
            take_home=Decimal("53500"),
            payment_status=DistributorSalaryPaymentStatus.waiting,
            net_sales_target=Decimal("500000"),
            net_sales_achieved=Decimal("320000"),
            incentive_slab=Decimal("10000"),
            calculated_incentive=Decimal("6400"),
            adjustments=Decimal("1600"),
            final_incentive=Decimal("8000"),
        )
    )
    await db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        dashboard = await client.get(
            "/api/v1/distributor/work/payroll/dashboard?periodId=aug-2026",
            headers=headers,
        )
        assert dashboard.status_code == 200
        body = dashboard.json()
        assert body["periodLabel"] == "August 2026"
        assert body["compensation"]["takeHome"] == 53500
        assert body["performance"]["achievementPct"] == 64
