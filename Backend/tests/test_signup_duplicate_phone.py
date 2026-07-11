from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.errors import AuthError
from app.application.auth.signup_service import signup_send_mobile_otp
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from app.infrastructure.persistence.signup_draft_store import create_signup_draft, update_signup_draft


@pytest.mark.asyncio
async def test_signup_send_mobile_otp_rejects_registered_phone(
    db_session: AsyncSession,
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db_session.add(
        User(
            email="existing@example.com",
            phone="6260531436",
            password_hash="hash",
            role=UserRole.user,
            status=UserStatus.active,
        )
    )
    await db_session.flush()

    signup_token = await create_signup_draft("new@example.com")
    await update_signup_draft(
        signup_token,
        {
            "email": "new@example.com",
            "email_verified": True,
            "password_hash": "hash",
        },
    )

    async def fake_request_otp(*_args, **_kwargs):
        return {"retry_after_seconds": 30, "expires_in": 600}

    monkeypatch.setattr("app.application.auth.signup_service.request_otp", fake_request_otp)

    with pytest.raises(AuthError) as exc:
        await signup_send_mobile_otp(db_session, signup_token, "6260531436")

    assert exc.value.code == "phone_already_registered"
    assert exc.value.status_code == 409
