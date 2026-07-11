from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.messaging.auth_events import schedule_login_succeeded
from app.application.messaging.scheduled_events import begin_event_batch, take_scheduled_events
from app.application.messaging.streams import (
    EVENT_AUTH_LOGIN_SUCCEEDED,
    EVENT_AUTH_OTP_REQUESTED,
    EVENT_SECURITY_EMAIL_REQUESTED,
)
from app.domain.account.events import (
    AccountEventType,
    OtpRequestedPayload,
    SecurityEmailRequestedPayload,
    otp_requested_event,
    security_email_requested_event,
)
from app.domain.auth.events import AuthEventType, LoginSucceededPayload, login_succeeded_event
from app.domain.shared.event_factory import parse_event_payload
from app.infrastructure.persistence.models import AuditEventType, User, UserRole, UserStatus
from app.infrastructure.persistence.repositories.audit_repository import SqlAlchemyAuditRepository
from app.infrastructure.persistence.repositories.user_repository import SqlAlchemyUserRepository


def test_stream_constants_match_domain_event_types() -> None:
    assert EVENT_AUTH_LOGIN_SUCCEEDED == AuthEventType.LOGIN_SUCCEEDED
    assert EVENT_AUTH_OTP_REQUESTED == AccountEventType.OTP_REQUESTED
    assert EVENT_SECURITY_EMAIL_REQUESTED == AccountEventType.SECURITY_EMAIL_REQUESTED


def test_login_succeeded_event_round_trip() -> None:
    user_id = uuid4()
    device_id = uuid4()
    event = login_succeeded_event(
        LoginSucceededPayload(
            user_id=user_id,
            email="user@example.com",
            ip="127.0.0.1",
            device_id=device_id,
            device_label="Chrome",
            is_new_device=True,
            velocity_flag=None,
        )
    )
    parsed = parse_event_payload(event, LoginSucceededPayload)
    assert parsed.user_id == user_id
    assert parsed.device_id == device_id
    assert event.event_type == AuthEventType.LOGIN_SUCCEEDED


def test_otp_and_email_events_serialize_enums() -> None:
    from app.application.identity.otp_purposes import OtpPurpose

    otp_event = otp_requested_event(
        OtpRequestedPayload(
            purpose=OtpPurpose.signup_email,
            identifier="user@example.com",
            destination="user@example.com",
            storage_key="email",
            channel="email",
        )
    )
    assert otp_event.payload["purpose"] == "signup_email"
    assert otp_event.payload["channel"] == "email"

    email_event = security_email_requested_event(
        SecurityEmailRequestedPayload(
            to_email="user@example.com",
            subject="Hello",
            body="Body",
        )
    )
    assert email_event.event_type == AccountEventType.SECURITY_EMAIL_REQUESTED


def test_schedule_login_succeeded_uses_typed_payload() -> None:
    begin_event_batch()
    user_id = uuid4()
    device_id = uuid4()
    schedule_login_succeeded(
        user_id=user_id,
        email="typed@example.com",
        ip="127.0.0.1",
        device_id=device_id,
        device_label="Safari",
        is_new_device=False,
        velocity_flag=None,
    )
    batch = take_scheduled_events()
    assert len(batch) == 1
    _stream, event = batch[0]
    parsed = parse_event_payload(event, LoginSucceededPayload)
    assert parsed.email == "typed@example.com"
    assert event.event_type == EVENT_AUTH_LOGIN_SUCCEEDED


@pytest.mark.asyncio
async def test_user_repository_lookup(db_session: AsyncSession) -> None:
    email = f"repo-{uuid4()}@example.com"
    user = User(
        email=email,
        password_hash="hash",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    repo = SqlAlchemyUserRepository(db_session)
    by_id = await repo.get_by_id(user.id)
    by_email = await repo.get_by_email(email.upper())
    assert by_id is not None
    assert by_email is not None
    assert by_id.id == user.id
    assert by_email.email == email


@pytest.mark.asyncio
async def test_audit_repository_append_and_list(db_session: AsyncSession) -> None:
    user = User(
        email=f"audit-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    repo = SqlAlchemyAuditRepository(db_session)
    await repo.append(
        event_type=AuditEventType.login_success,
        user_id=user.id,
        ip="10.0.0.1",
        metadata={"source": "phase6"},
    )
    await db_session.flush()

    rows = await repo.list_logs(user_id=user.id, event_type=AuditEventType.login_success)
    assert len(rows) >= 1
    assert rows[0]["metadata"]["source"] == "phase6"
