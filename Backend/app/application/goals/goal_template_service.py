from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.goals.errors import GoalError
from app.infrastructure.persistence.goal_models import GoalTemplate


def serialize_goal_template(template: GoalTemplate) -> dict[str, Any]:
    return {
        "id": str(template.id),
        "slug": template.slug,
        "name": template.name,
        "description": template.description,
        "icon_key": template.icon_key,
        "image_url": template.image_url,
        "default_tenure_months": template.default_tenure_months,
        "suggested_return_pct": float(template.suggested_return_pct)
        if template.suggested_return_pct is not None
        else None,
        "is_active": template.is_active,
        "sort_order": template.sort_order,
        "created_at": template.created_at.isoformat() if template.created_at else None,
        "updated_at": template.updated_at.isoformat() if template.updated_at else None,
    }


async def list_goal_templates(
    db: AsyncSession,
    *,
    include_inactive: bool = False,
) -> list[dict[str, Any]]:
    query = select(GoalTemplate).order_by(GoalTemplate.sort_order.asc(), GoalTemplate.name.asc())
    if not include_inactive:
        query = query.where(GoalTemplate.is_active.is_(True))
    result = await db.execute(query)
    return [serialize_goal_template(row) for row in result.scalars().all()]


async def get_goal_template(db: AsyncSession, *, template_id: UUID) -> dict[str, Any]:
    template = await db.get(GoalTemplate, template_id)
    if not template:
        raise GoalError(code="template_not_found", message="Goal template not found.", status_code=404)
    return serialize_goal_template(template)


async def get_goal_template_by_slug(db: AsyncSession, *, slug: str) -> GoalTemplate | None:
    result = await db.execute(select(GoalTemplate).where(GoalTemplate.slug == slug))
    return result.scalar_one_or_none()


async def update_goal_template(
    db: AsyncSession,
    *,
    template_id: UUID,
    name: str | None = None,
    description: str | None = None,
    icon_key: str | None = None,
    image_url: str | None = None,
    clear_image_url: bool = False,
    default_tenure_months: int | None = None,
    suggested_return_pct: Decimal | None = None,
    is_active: bool | None = None,
    sort_order: int | None = None,
) -> dict[str, Any]:
    template = await db.get(GoalTemplate, template_id)
    if not template:
        raise GoalError(code="template_not_found", message="Goal template not found.", status_code=404)

    if name is not None:
        template.name = name.strip()
    if description is not None:
        template.description = description.strip() or None
    if icon_key is not None:
        template.icon_key = icon_key.strip()
    if clear_image_url:
        template.image_url = None
    elif image_url is not None:
        cleaned_url = image_url.strip()
        template.image_url = cleaned_url or None
    if default_tenure_months is not None:
        if default_tenure_months < 1:
            raise GoalError(code="invalid_tenure", message="Default tenure must be at least 1 month.")
        template.default_tenure_months = default_tenure_months
    if suggested_return_pct is not None:
        if suggested_return_pct < 0 or suggested_return_pct > 100:
            raise GoalError(
                code="invalid_return",
                message="Suggested return must be between 0 and 100.",
            )
        template.suggested_return_pct = suggested_return_pct
    if is_active is not None:
        template.is_active = is_active
    if sort_order is not None:
        template.sort_order = sort_order

    await db.flush()
    return serialize_goal_template(template)
