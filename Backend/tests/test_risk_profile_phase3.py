from __future__ import annotations

from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.messaging.scheduled_events import begin_event_batch, discard_scheduled_events
from app.application.risk_profile.audit_service import list_risk_profile_audit_logs
from app.application.risk_profile.category_service import create_category
from app.application.risk_profile.question_service import create_question
from app.application.risk_profile.scoring_service import get_user_risk_profile, list_user_assessments, submit_assessment
from app.application.risk_profile.tier_service import ensure_risk_tier_seed
from app.infrastructure.persistence.models import AuditEventType, User, UserRole, UserStatus


@pytest.mark.asyncio
async def test_submit_assessment_writes_audit_and_schedules_notification(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    await ensure_risk_tier_seed(db_session)

    admin = User(
        email=f"phase3-admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    user = User(
        email=f"phase3-user-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add_all([admin, user])
    await db_session.flush()

    category = await create_category(
        db_session,
        name="Risk capacity",
        description=None,
        weight=Decimal("1.0"),
        sort_order=1,
        admin=admin,
        ip="127.0.0.1",
    )
    question = await create_question(
        db_session,
        category_id=UUID(category["id"]),
        prompt="How much volatility can you accept?",
        help_text=None,
        sort_order=1,
        options=[
            {"label": "Very little", "score_value": 20, "sort_order": 0},
            {"label": "Moderate", "score_value": 50, "sort_order": 1},
            {"label": "High", "score_value": 80, "sort_order": 2},
        ],
        admin=admin,
        ip="127.0.0.1",
    )

    scheduled: list[str] = []

    def capture_notification(**kwargs: object) -> None:
        scheduled.append(str(kwargs.get("notification_type")))

    monkeypatch.setattr(
        "app.application.risk_profile.scoring_service.notify_risk_profile_completed",
        lambda **kwargs: capture_notification(notification_type="invest.risk_profile.completed"),
    )

    discard_scheduled_events()
    begin_event_batch()

    result = await submit_assessment(
        db_session,
        user=user,
        answers=[
            {
                "question_id": UUID(question["id"]),
                "option_id": UUID(question["options"][2]["id"]),
            }
        ],
        ip="127.0.0.1",
    )
    await db_session.flush()

    assert result["score"] == 1000
    assert scheduled == ["invest.risk_profile.completed"]

    profile = await get_user_risk_profile(db_session, user.id)
    assert profile is not None
    assert profile["score"] == 1000

    logs = await list_risk_profile_audit_logs(db_session, user_id=user.id, limit=10, offset=0)
    event_types = {item["event_type"] for item in logs}
    assert AuditEventType.risk_profile_completed.value in event_types
    assert AuditEventType.risk_profile_message_sent.value in event_types


@pytest.mark.asyncio
async def test_list_risk_profile_audit_logs_filters_non_risk_events(
    db_session: AsyncSession,
) -> None:
    user = User(
        email=f"phase3-audit-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    from app.application.auth.audit_service import write_audit

    await write_audit(
        db_session,
        event_type=AuditEventType.login_success,
        user_id=user.id,
        ip="127.0.0.1",
        metadata={},
    )
    await write_audit(
        db_session,
        event_type=AuditEventType.risk_profile_completed,
        user_id=user.id,
        ip="127.0.0.1",
        metadata={"score": 500, "tier": "moderate"},
    )
    await db_session.flush()

    logs = await list_risk_profile_audit_logs(db_session, user_id=user.id, limit=20, offset=0)
    assert len(logs) == 1
    assert logs[0]["event_type"] == AuditEventType.risk_profile_completed.value


@pytest.mark.asyncio
async def test_list_user_assessments_returns_all_completed_attempts(db_session: AsyncSession) -> None:
    await ensure_risk_tier_seed(db_session)

    admin = User(
        email=f"phase3-history-admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    user = User(
        email=f"phase3-history-user-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add_all([admin, user])
    await db_session.flush()

    category = await create_category(
        db_session,
        name="Risk capacity",
        description=None,
        weight=Decimal("1.0"),
        sort_order=1,
        admin=admin,
        ip="127.0.0.1",
    )
    question = await create_question(
        db_session,
        category_id=UUID(category["id"]),
        prompt="How much volatility can you accept?",
        help_text=None,
        sort_order=1,
        options=[
            {"label": "Very little", "score_value": 20, "sort_order": 0},
            {"label": "Moderate", "score_value": 50, "sort_order": 1},
            {"label": "High", "score_value": 80, "sort_order": 2},
        ],
        admin=admin,
        ip="127.0.0.1",
    )

    answers = [
        {
            "question_id": UUID(question["id"]),
            "option_id": UUID(question["options"][1]["id"]),
        }
    ]
    first = await submit_assessment(db_session, user=user, answers=answers, ip="127.0.0.1")
    second = await submit_assessment(db_session, user=user, answers=answers, ip="127.0.0.1")
    await db_session.flush()

    history = await list_user_assessments(db_session, user_id=user.id, limit=10, offset=0)
    assert len(history["items"]) == 2
    assert {item["assessment_id"] for item in history["items"]} == {
        first["assessment_id"],
        second["assessment_id"],
    }
    assert history["items"][0]["assessment_id"] == second["assessment_id"]
    assert history["items"][0]["questions_answered"] == 1

    profile = await get_user_risk_profile(db_session, user.id)
    assert profile is not None
    assert profile["assessment_id"] == second["assessment_id"]
