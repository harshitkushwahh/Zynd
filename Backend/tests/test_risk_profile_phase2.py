from __future__ import annotations

from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.risk_profile.bulk_import_service import preview_bulk_questions, submit_bulk_questions
from app.application.risk_profile.category_service import create_category
from app.application.risk_profile.template_service import (
    auto_select_template,
    create_template,
    ensure_risk_template_seed,
    resolve_template_questions,
)
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from app.infrastructure.persistence.risk_profile_models import RiskTemplateSelectionMode

SAMPLE_CSV = """category_slug,question_prompt,option_1,option_1_score,option_2,option_2_score,option_3,option_3_score,option_4,option_4_score,help_text,sort_order
loss_tolerance,How would you react to a 20% drop?,Sell,10,Hold,50,Buy more,90,,,1
"""


@pytest.mark.asyncio
async def test_bulk_import_preview_and_submit(db_session: AsyncSession) -> None:
    admin = User(
        email=f"bulk-admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(admin)
    await db_session.flush()

    await create_category(
        db_session,
        name="Loss tolerance",
        description=None,
        weight=Decimal("1.0"),
        sort_order=1,
        admin=admin,
        ip="127.0.0.1",
    )

    preview = await preview_bulk_questions(db_session, csv_text=SAMPLE_CSV)
    assert preview["row_count"] == 1
    assert preview["ready"] is True

    result = await submit_bulk_questions(
        db_session,
        csv_text=SAMPLE_CSV,
        create_missing_categories=False,
        default_category_weight=0.1,
        admin=admin,
        ip="127.0.0.1",
    )
    assert result["created_questions"] == 1


@pytest.mark.asyncio
async def test_template_create_auto_select_and_resolve(db_session: AsyncSession) -> None:
    admin = User(
        email=f"template-admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(admin)
    await db_session.flush()

    category = await create_category(
        db_session,
        name="Time Horizon",
        description=None,
        weight=Decimal("1.0"),
        sort_order=1,
        admin=admin,
        ip="127.0.0.1",
    )

    from app.application.risk_profile.question_service import create_question

    await create_question(
        db_session,
        category_id=UUID(category["id"]),
        prompt="Question A",
        help_text=None,
        sort_order=1,
        options=[{"label": "Low", "score_value": 20, "sort_order": 0}],
        admin=admin,
        ip="127.0.0.1",
    )
    await create_question(
        db_session,
        category_id=UUID(category["id"]),
        prompt="Question B",
        help_text=None,
        sort_order=2,
        options=[{"label": "High", "score_value": 80, "sort_order": 0}],
        admin=admin,
        ip="127.0.0.1",
    )

    template = await create_template(
        db_session,
        name="Standard",
        description="Two questions",
        is_default=True,
        selection_mode=RiskTemplateSelectionMode.manual,
        sort_order=1,
        rules=[{"category_id": UUID(category["id"]), "question_count": 2, "sort_order": 0}],
        admin=admin,
        ip="127.0.0.1",
    )
    assert template["total_questions"] == 2

    resolved = await resolve_template_questions(db_session, template_id=UUID(template["id"]))
    assert resolved["total_questions"] == 2

    selected = await auto_select_template(db_session, target_question_count=2)
    assert selected["total_questions"] >= 1

    await ensure_risk_template_seed(db_session)
