from __future__ import annotations

from decimal import Decimal
from typing import Any, TypedDict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.risk_profile.category_service import slugify_category_name
from app.application.risk_profile.template_service import ensure_risk_template_seed
from app.application.risk_profile.tier_service import ensure_risk_tier_seed
from app.infrastructure.persistence.risk_profile_models import (
    RiskProfileTemplate,
    RiskQuestion,
    RiskQuestionCategory,
    RiskQuestionOption,
    RiskTierConfig,
)


class _QuestionOptionSeed(TypedDict):
    label: str
    score_value: int
    sort_order: int


class _QuestionSeed(TypedDict):
    prompt: str
    help_text: str | None
    sort_order: int
    options: list[_QuestionOptionSeed]


class _CategorySeed(TypedDict):
    name: str
    description: str
    weight: Decimal
    sort_order: int
    questions: list[_QuestionSeed]


RISK_PROFILE_CATEGORY_SEED: list[_CategorySeed] = [
    {
        "name": "Time Horizon",
        "description": "How long the investor can remain invested before needing the funds.",
        "weight": Decimal("0.25"),
        "sort_order": 1,
        "questions": [
            {
                "prompt": "How long can you stay invested without needing this money?",
                "help_text": None,
                "sort_order": 1,
                "options": [
                    {"label": "Less than 1 year", "score_value": 10, "sort_order": 0},
                    {"label": "1–3 years", "score_value": 40, "sort_order": 1},
                    {"label": "3–5 years", "score_value": 70, "sort_order": 2},
                    {"label": "5+ years", "score_value": 90, "sort_order": 3},
                ],
            },
            {
                "prompt": "When do you expect to use most of this investment?",
                "help_text": None,
                "sort_order": 2,
                "options": [
                    {"label": "Within 2 years", "score_value": 15, "sort_order": 0},
                    {"label": "In 3–5 years", "score_value": 45, "sort_order": 1},
                    {"label": "In 6–10 years", "score_value": 75, "sort_order": 2},
                    {"label": "After 10 years", "score_value": 95, "sort_order": 3},
                ],
            },
        ],
    },
    {
        "name": "Loss Tolerance",
        "description": "Comfort with short-term portfolio volatility and drawdowns.",
        "weight": Decimal("0.25"),
        "sort_order": 2,
        "questions": [
            {
                "prompt": "How would you react to a 20% drop in your portfolio value?",
                "help_text": None,
                "sort_order": 1,
                "options": [
                    {"label": "Sell immediately", "score_value": 10, "sort_order": 0},
                    {"label": "Reduce exposure", "score_value": 35, "sort_order": 1},
                    {"label": "Hold steady", "score_value": 70, "sort_order": 2},
                    {"label": "Invest more", "score_value": 90, "sort_order": 3},
                ],
            },
            {
                "prompt": "What temporary loss could you accept over one year?",
                "help_text": None,
                "sort_order": 2,
                "options": [
                    {"label": "None", "score_value": 5, "sort_order": 0},
                    {"label": "Up to 10%", "score_value": 30, "sort_order": 1},
                    {"label": "Up to 20%", "score_value": 60, "sort_order": 2},
                    {"label": "More than 20%", "score_value": 85, "sort_order": 3},
                ],
            },
        ],
    },
    {
        "name": "Investment Experience",
        "description": "Prior exposure to market-linked and long-term investments.",
        "weight": Decimal("0.20"),
        "sort_order": 3,
        "questions": [
            {
                "prompt": "How familiar are you with equity and mutual fund investments?",
                "help_text": None,
                "sort_order": 1,
                "options": [
                    {"label": "Not familiar", "score_value": 15, "sort_order": 0},
                    {"label": "Somewhat familiar", "score_value": 40, "sort_order": 1},
                    {"label": "Experienced", "score_value": 70, "sort_order": 2},
                    {"label": "Very experienced", "score_value": 90, "sort_order": 3},
                ],
            },
            {
                "prompt": "How often have you invested in market-linked products?",
                "help_text": None,
                "sort_order": 2,
                "options": [
                    {"label": "Never", "score_value": 10, "sort_order": 0},
                    {"label": "Once or twice", "score_value": 35, "sort_order": 1},
                    {"label": "A few times", "score_value": 65, "sort_order": 2},
                    {"label": "Regularly", "score_value": 90, "sort_order": 3},
                ],
            },
        ],
    },
    {
        "name": "Income Stability",
        "description": "Predictability of income and financial safety net.",
        "weight": Decimal("0.15"),
        "sort_order": 4,
        "questions": [
            {
                "prompt": "How stable is your primary source of income?",
                "help_text": None,
                "sort_order": 1,
                "options": [
                    {"label": "Very unstable", "score_value": 20, "sort_order": 0},
                    {"label": "Somewhat stable", "score_value": 45, "sort_order": 1},
                    {"label": "Stable", "score_value": 70, "sort_order": 2},
                    {"label": "Highly stable", "score_value": 90, "sort_order": 3},
                ],
            },
            {
                "prompt": "Do you maintain an emergency fund covering 6+ months of expenses?",
                "help_text": None,
                "sort_order": 2,
                "options": [
                    {"label": "No", "score_value": 25, "sort_order": 0},
                    {"label": "Partially", "score_value": 50, "sort_order": 1},
                    {"label": "Yes, about 6 months", "score_value": 75, "sort_order": 2},
                    {"label": "Yes, well above 6 months", "score_value": 90, "sort_order": 3},
                ],
            },
        ],
    },
    {
        "name": "Financial Goals",
        "description": "Primary objectives driving investment decisions.",
        "weight": Decimal("0.15"),
        "sort_order": 5,
        "questions": [
            {
                "prompt": "What is your primary investment goal?",
                "help_text": None,
                "sort_order": 1,
                "options": [
                    {"label": "Capital preservation", "score_value": 15, "sort_order": 0},
                    {"label": "Steady income", "score_value": 40, "sort_order": 1},
                    {"label": "Balanced growth", "score_value": 70, "sort_order": 2},
                    {"label": "Maximum growth", "score_value": 90, "sort_order": 3},
                ],
            },
            {
                "prompt": "Which outcome matters most to you over the next 5 years?",
                "help_text": None,
                "sort_order": 2,
                "options": [
                    {"label": "Protecting principal", "score_value": 20, "sort_order": 0},
                    {"label": "Predictable returns", "score_value": 45, "sort_order": 1},
                    {"label": "Moderate growth", "score_value": 70, "sort_order": 2},
                    {"label": "Highest possible returns", "score_value": 90, "sort_order": 3},
                ],
            },
        ],
    },
]


async def _get_category_by_slug(db: AsyncSession, slug: str) -> RiskQuestionCategory | None:
    result = await db.execute(select(RiskQuestionCategory).where(RiskQuestionCategory.slug == slug))
    return result.scalar_one_or_none()


async def _question_exists(db: AsyncSession, category_id: Any, prompt: str) -> bool:
    result = await db.execute(
        select(RiskQuestion.id).where(
            RiskQuestion.category_id == category_id,
            RiskQuestion.prompt == prompt,
        )
    )
    return result.scalar_one_or_none() is not None


async def ensure_risk_profile_content_seed(db: AsyncSession) -> dict[str, int]:
    categories_created = 0
    questions_created = 0

    for item in RISK_PROFILE_CATEGORY_SEED:
        slug = slugify_category_name(item["name"])
        category = await _get_category_by_slug(db, slug)
        if category is None:
            category = RiskQuestionCategory(
                slug=slug,
                name=item["name"],
                description=item["description"],
                weight=item["weight"],
                sort_order=item["sort_order"],
                is_active=True,
            )
            db.add(category)
            await db.flush()
            categories_created += 1

        for question_seed in item["questions"]:
            if await _question_exists(db, category.id, question_seed["prompt"]):
                continue

            question = RiskQuestion(
                category_id=category.id,
                prompt=question_seed["prompt"],
                help_text=question_seed["help_text"],
                sort_order=question_seed["sort_order"],
                is_active=True,
            )
            db.add(question)
            await db.flush()

            for option_seed in question_seed["options"]:
                db.add(
                    RiskQuestionOption(
                        question_id=question.id,
                        label=option_seed["label"],
                        score_value=option_seed["score_value"],
                        sort_order=option_seed["sort_order"],
                    )
                )

            questions_created += 1

    await db.flush()
    return {
        "categories_created": categories_created,
        "questions_created": questions_created,
    }


async def ensure_risk_profile_seed(db: AsyncSession) -> dict[str, int | bool]:
    await ensure_risk_tier_seed(db)
    content = await ensure_risk_profile_content_seed(db)

    before_templates = await db.execute(select(RiskProfileTemplate.id).limit(1))
    had_templates = before_templates.scalar_one_or_none() is not None
    await ensure_risk_template_seed(db)
    after_templates = await db.execute(select(RiskProfileTemplate.id).limit(1))
    templates_created = not had_templates and after_templates.scalar_one_or_none() is not None

    return {
        **content,
        "tiers_seeded": True,
        "templates_created": templates_created,
    }


async def summarize_risk_profile_seed(db: AsyncSession) -> dict[str, int]:
    categories = await db.execute(
        select(RiskQuestionCategory)
        .options(selectinload(RiskQuestionCategory.questions).selectinload(RiskQuestion.options))
        .order_by(RiskQuestionCategory.sort_order)
    )
    category_rows = list(categories.scalars().unique().all())
    active_questions = sum(
        1
        for category in category_rows
        for question in category.questions
        if question.is_active
    )

    tier_count = len((await db.execute(select(RiskTierConfig.tier))).all())
    template_count = len((await db.execute(select(RiskProfileTemplate.id))).all())

    return {
        "categories": len(category_rows),
        "questions": active_questions,
        "tiers": tier_count,
        "templates": template_count,
    }


__all__ = [
    "RISK_PROFILE_CATEGORY_SEED",
    "ensure_risk_profile_content_seed",
    "ensure_risk_profile_seed",
    "summarize_risk_profile_seed",
]
