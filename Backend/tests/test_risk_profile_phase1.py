from __future__ import annotations

from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.rbac_service import ensure_rbac_seed
from app.application.risk_profile.category_service import (
    create_category,
    slugify_category_name,
    update_category,
)
from app.application.risk_profile.errors import RiskProfileError
from app.application.risk_profile.question_service import create_question
from app.application.risk_profile.scoring_service import (
    build_category_scores,
    compute_weighted_score,
    normalize_category_score,
    preview_score,
    submit_assessment,
)
from app.application.risk_profile.tier_service import ensure_risk_tier_seed, list_tiers, resolve_tier_for_score
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from app.infrastructure.persistence.risk_profile_models import RiskQuestionOption, RiskTier


def test_normalize_category_score() -> None:
    assert normalize_category_score(50, 100) == 500.0
    assert normalize_category_score(0, 100) == 0.0
    assert normalize_category_score(0, 0) == 0.0


def test_compute_weighted_score_uses_category_weights() -> None:
    category_a = uuid4()
    category_b = uuid4()
    score = compute_weighted_score(
        category_scores={category_a: 800.0, category_b: 400.0},
        category_weights={category_a: Decimal("0.75"), category_b: Decimal("0.25")},
    )
    assert score == 700


def test_compute_weighted_score_averages_when_weights_missing() -> None:
    category_a = uuid4()
    category_b = uuid4()
    score = compute_weighted_score(
        category_scores={category_a: 800.0, category_b: 400.0},
        category_weights={},
    )
    assert score == 600


def test_build_category_scores_rejects_duplicate_questions() -> None:
    category_id = uuid4()
    question_id = uuid4()
    option = RiskQuestionOption(id=uuid4(), question_id=question_id, label="A", score_value=50, sort_order=0)
    question = SimpleNamespace(
        id=question_id,
        category_id=category_id,
        is_active=True,
        category=SimpleNamespace(id=category_id, is_active=True),
        options=[option],
    )

    with pytest.raises(RiskProfileError):
        build_category_scores(answers=[(question, option), (question, option)])


def test_slugify_category_name() -> None:
    assert slugify_category_name("Time Horizon") == "time_horizon"
    assert slugify_category_name("Loss tolerance") == "loss_tolerance"
    assert slugify_category_name("  Risk & Return  ") == "risk_return"
    assert slugify_category_name("123 Goals") == "c_123_goals"


@pytest.mark.asyncio
async def test_create_category_generates_unique_slug(db_session: AsyncSession) -> None:
    admin = User(
        email=f"slug-admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(admin)
    await db_session.flush()

    first = await create_category(
        db_session,
        name="Time Horizon",
        description=None,
        weight=Decimal("0.5"),
        sort_order=1,
        admin=admin,
        ip="127.0.0.1",
    )
    second = await create_category(
        db_session,
        name="Time Horizon",
        description=None,
        weight=Decimal("0.5"),
        sort_order=2,
        admin=admin,
        ip="127.0.0.1",
    )

    assert first["slug"] == "time_horizon"
    assert second["slug"] == "time_horizon_2"


@pytest.mark.asyncio
async def test_update_category_deactivate_returns_serialized_row(db_session: AsyncSession) -> None:
    admin = User(
        email=f"category-admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(admin)
    await db_session.flush()

    created = await create_category(
        db_session,
        name="Income Stability",
        description="Stable income profile",
        weight=Decimal("0.15"),
        sort_order=3,
        admin=admin,
        ip="127.0.0.1",
    )

    updated = await update_category(
        db_session,
        category_id=UUID(created["id"]),
        name=None,
        description=None,
        weight=None,
        sort_order=None,
        is_active=False,
        admin=admin,
        ip="127.0.0.1",
    )

    assert updated["is_active"] is False
    assert updated["updated_at"] is not None
    assert updated["question_count"] == 0


@pytest.mark.asyncio
async def test_risk_profile_admin_flow_and_scoring(db_session: AsyncSession) -> None:
    await ensure_risk_tier_seed(db_session)
    await ensure_rbac_seed(db_session)

    admin = User(
        email=f"risk-admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    user = User(
        email=f"risk-user-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add_all([admin, user])
    await db_session.flush()

    category = await create_category(
        db_session,
        name="Time Horizon",
        description="How long the investor can stay invested",
        weight=Decimal("1.0"),
        sort_order=1,
        admin=admin,
        ip="127.0.0.1",
    )
    assert category["slug"] == "time_horizon"
    question = await create_question(
        db_session,
        category_id=UUID(category["id"]),
        prompt="How long can you stay invested?",
        help_text=None,
        sort_order=1,
        options=[
            {"label": "Less than 1 year", "score_value": 10, "sort_order": 0},
            {"label": "1-3 years", "score_value": 40, "sort_order": 1},
            {"label": "3-5 years", "score_value": 70, "sort_order": 2},
            {"label": "5+ years", "score_value": 90, "sort_order": 3},
        ],
        admin=admin,
        ip="127.0.0.1",
    )

    preview = await preview_score(
        db_session,
        answers=[
            {
                "question_id": UUID(question["id"]),
                "option_id": UUID(question["options"][3]["id"]),
            }
        ],
    )
    assert preview["score"] == 1000
    assert preview["tier"] == RiskTier.aggressive.value

    result = await submit_assessment(
        db_session,
        user=user,
        answers=[
            {
                "question_id": UUID(question["id"]),
                "option_id": UUID(question["options"][3]["id"]),
            }
        ],
        ip="127.0.0.1",
    )
    assert result["score"] == 1000
    assert result["tier"] == RiskTier.aggressive.value
    assert result["tier_config"]["message_body"]

    tiers = await list_tiers(db_session)
    assert len(tiers) == 5

    tier_row = await resolve_tier_for_score(db_session, 450)
    assert tier_row.tier == RiskTier.moderate
