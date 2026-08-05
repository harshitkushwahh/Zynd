from __future__ import annotations

from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.admin.goals_schemas import (
    AdminGoalTemplateListResponse,
    AdminGoalTemplateResponse,
    UpdateAdminGoalTemplateRequest,
)
from app.api.v1.auth.deps import require_permission
from app.application.goals.errors import GoalError
from app.application.goals.goal_template_service import get_goal_template, list_goal_templates, update_goal_template
from app.core.database import get_db
from app.infrastructure.persistence.models import User

router = APIRouter(prefix="/goals", tags=["admin-goals"])


def _handle_goal_error(exc: GoalError) -> HTTPException:
    return HTTPException(
        status_code=exc.status_code,
        detail={"code": exc.code, "message": exc.message},
    )


@router.get("/templates", response_model=AdminGoalTemplateListResponse)
async def get_admin_goal_templates(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("goals.templates.read"))],
    include_inactive: bool = Query(default=True),
) -> AdminGoalTemplateListResponse:
    items = await list_goal_templates(db, include_inactive=include_inactive)
    return AdminGoalTemplateListResponse(items=[AdminGoalTemplateResponse(**item) for item in items])


@router.get("/templates/{template_id}", response_model=AdminGoalTemplateResponse)
async def get_admin_goal_template(
    template_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("goals.templates.read"))],
) -> AdminGoalTemplateResponse:
    try:
        item = await get_goal_template(db, template_id=template_id)
    except GoalError as exc:
        raise _handle_goal_error(exc) from exc
    return AdminGoalTemplateResponse(**item)


@router.patch("/templates/{template_id}", response_model=AdminGoalTemplateResponse)
async def patch_admin_goal_template(
    template_id: UUID,
    body: UpdateAdminGoalTemplateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("goals.templates.manage"))],
) -> AdminGoalTemplateResponse:
    try:
        item = await update_goal_template(
            db,
            template_id=template_id,
            name=body.name,
            description=body.description,
            icon_key=body.icon_key,
            image_url=body.image_url,
            clear_image_url=body.clear_image_url or False,
            default_tenure_months=body.default_tenure_months,
            suggested_return_pct=Decimal(str(body.suggested_return_pct))
            if body.suggested_return_pct is not None
            else None,
            is_active=body.is_active,
            sort_order=body.sort_order,
        )
    except GoalError as exc:
        raise _handle_goal_error(exc) from exc
    await db.commit()
    return AdminGoalTemplateResponse(**item)
