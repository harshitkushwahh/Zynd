from __future__ import annotations

from decimal import Decimal
from typing import TypedDict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.goal_models import GoalTemplate


class _GoalTemplateSeed(TypedDict):
    slug: str
    name: str
    description: str
    icon_key: str
    default_tenure_months: int
    suggested_return_pct: Decimal
    sort_order: int


GOAL_TEMPLATE_SEED: list[_GoalTemplateSeed] = [
    {
        "slug": "car",
        "name": "Car",
        "description": "Save for your next car purchase or down payment.",
        "icon_key": "car",
        "default_tenure_months": 60,
        "suggested_return_pct": Decimal("10.00"),
        "sort_order": 1,
    },
    {
        "slug": "travel",
        "name": "Travel",
        "description": "Plan a dream vacation or annual travel fund.",
        "icon_key": "plane",
        "default_tenure_months": 24,
        "suggested_return_pct": Decimal("8.00"),
        "sort_order": 2,
    },
    {
        "slug": "education",
        "name": "Education",
        "description": "Build a corpus for school, college, or skill development.",
        "icon_key": "graduation-cap",
        "default_tenure_months": 120,
        "suggested_return_pct": Decimal("12.00"),
        "sort_order": 3,
    },
    {
        "slug": "wedding",
        "name": "Wedding",
        "description": "Save for wedding expenses and celebrations.",
        "icon_key": "heart",
        "default_tenure_months": 36,
        "suggested_return_pct": Decimal("10.00"),
        "sort_order": 4,
    },
    {
        "slug": "home",
        "name": "Home",
        "description": "Work toward a home down payment or renovation fund.",
        "icon_key": "home",
        "default_tenure_months": 180,
        "suggested_return_pct": Decimal("12.00"),
        "sort_order": 5,
    },
    {
        "slug": "retirement",
        "name": "Retirement",
        "description": "Grow long-term wealth for financial independence.",
        "icon_key": "sunset",
        "default_tenure_months": 240,
        "suggested_return_pct": Decimal("12.00"),
        "sort_order": 6,
    },
]


async def ensure_goal_template_seed(db: AsyncSession) -> None:
    result = await db.execute(select(GoalTemplate.slug))
    existing_slugs = set(result.scalars().all())

    for item in GOAL_TEMPLATE_SEED:
        if item["slug"] in existing_slugs:
            continue
        db.add(
            GoalTemplate(
                slug=item["slug"],
                name=item["name"],
                description=item["description"],
                icon_key=item["icon_key"],
                default_tenure_months=item["default_tenure_months"],
                suggested_return_pct=item["suggested_return_pct"],
                sort_order=item["sort_order"],
                is_active=True,
            )
        )

    await db.flush()
