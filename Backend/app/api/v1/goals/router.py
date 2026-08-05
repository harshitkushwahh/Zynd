from __future__ import annotations

from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.deps import get_current_user
from app.api.v1.goals.schemas import (
    CreateGoalRequest,
    GoalCalculatorRequest,
    GoalCalculatorResponse,
    GoalListResponse,
    GoalMilestoneResponse,
    GoalResponse,
    GoalTemplateListResponse,
    GoalTemplateResponse,
    LinkableFamilyGoalItemResponse,
    LinkableFamilyGoalListResponse,
    UpdateGoalRequest,
)
from app.application.goals.constants import MAX_ACTIVE_PERSONAL_GOALS
from app.application.goals.errors import GoalError
from app.application.goals.goal_calculator_service import calculate_goal_plan
from app.application.goals.goal_service import (
    archive_personal_goal,
    create_personal_goal,
    delete_personal_goal,
    get_personal_goal,
    list_personal_goals,
    restore_personal_goal,
    update_personal_goal,
)
from app.application.goals.goal_template_service import list_goal_templates
from app.application.goals.goal_funding_service import list_linkable_family_goals
from app.core.database import get_db
from app.infrastructure.persistence.goal_models import GoalStatus
from app.infrastructure.persistence.models import User

router = APIRouter(prefix="/goals", tags=["goals"])


def _handle_goal_error(exc: GoalError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": {"code": exc.code, "message": exc.message}},
    )


@router.get("/templates", response_model=GoalTemplateListResponse)
async def get_goal_templates(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> GoalTemplateListResponse:
    items = await list_goal_templates(db, include_inactive=False)
    return GoalTemplateListResponse(items=[GoalTemplateResponse(**item) for item in items])


@router.post("/calculate", response_model=GoalCalculatorResponse)
async def post_calculate_goal(
    body: GoalCalculatorRequest,
    _: Annotated[User, Depends(get_current_user)],
) -> GoalCalculatorResponse:
    try:
        result = calculate_goal_plan(
            target_amount_inr=body.target_amount_inr,
            target_date=body.target_date,
            existing_savings_inr=body.existing_savings_inr,
            expected_return_pct=body.expected_return_pct,
        )
    except GoalError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    milestones = result.pop("milestones")
    return GoalCalculatorResponse(
        **result,
        milestones=[GoalMilestoneResponse(**item) for item in milestones],
    )


@router.get("/me", response_model=GoalListResponse)
async def list_my_goals(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    include_archived: bool = Query(default=False),
) -> GoalListResponse:
    items = await list_personal_goals(
        db,
        user_id=current_user.id,
        include_archived=include_archived,
    )
    active_count = sum(1 for item in items if item["status"] in {"draft", "active", "paused"})
    return GoalListResponse(
        items=[GoalResponse(**item) for item in items],
        limit=MAX_ACTIVE_PERSONAL_GOALS,
        active_count=active_count,
    )


@router.post("", response_model=GoalResponse, status_code=201)
async def create_goal(
    body: CreateGoalRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> GoalResponse:
    try:
        result = await create_personal_goal(
            db,
            user_id=current_user.id,
            title=body.title,
            target_amount_inr=body.target_amount_inr,
            target_date=body.target_date,
            template_id=body.template_id,
            tag=body.tag,
            priority=body.priority,
            existing_savings_inr=body.existing_savings_inr,
            expected_return_pct=body.expected_return_pct,
            status=GoalStatus(body.status),
            linked_product_id=body.linked_product_id,
        )
    except GoalError as exc:
        return _handle_goal_error(exc)
    await db.commit()
    return GoalResponse(**result)


@router.get("/family/linkable", response_model=LinkableFamilyGoalListResponse)
async def list_linkable_family_goals_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> LinkableFamilyGoalListResponse:
    items = await list_linkable_family_goals(db, user_id=current_user.id)
    return LinkableFamilyGoalListResponse(
        items=[LinkableFamilyGoalItemResponse(**item) for item in items]
    )


@router.get("/{goal_id}", response_model=GoalResponse)
async def get_goal(
    goal_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> GoalResponse:
    try:
        result = await get_personal_goal(db, goal_id=goal_id, user_id=current_user.id)
    except GoalError as exc:
        return _handle_goal_error(exc)
    return GoalResponse(**result)


@router.patch("/{goal_id}", response_model=GoalResponse)
async def patch_goal(
    goal_id: UUID,
    body: UpdateGoalRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> GoalResponse:
    try:
        result = await update_personal_goal(
            db,
            goal_id=goal_id,
            user_id=current_user.id,
            title=body.title,
            tag=body.tag,
            priority=body.priority,
            target_amount_inr=body.target_amount_inr,
            target_date=body.target_date,
            existing_savings_inr=body.existing_savings_inr,
            current_amount_inr=body.current_amount_inr,
            expected_return_pct=body.expected_return_pct,
            status=GoalStatus(body.status) if body.status else None,
            linked_product_id=body.linked_product_id,
            clear_linked_product=body.clear_linked_product,
        )
    except GoalError as exc:
        return _handle_goal_error(exc)
    await db.commit()
    return GoalResponse(**result)


@router.delete("/{goal_id}", response_model=GoalResponse)
async def delete_goal(
    goal_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> GoalResponse:
    try:
        result = await archive_personal_goal(db, goal_id=goal_id, user_id=current_user.id)
    except GoalError as exc:
        return _handle_goal_error(exc)
    await db.commit()
    return GoalResponse(**result)


@router.post("/{goal_id}/restore", response_model=GoalResponse)
async def restore_goal(
    goal_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> GoalResponse:
    try:
        result = await restore_personal_goal(db, goal_id=goal_id, user_id=current_user.id)
    except GoalError as exc:
        return _handle_goal_error(exc)
    await db.commit()
    return GoalResponse(**result)


@router.delete("/{goal_id}/permanent", status_code=204)
async def delete_goal_permanently(
    goal_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    try:
        await delete_personal_goal(db, goal_id=goal_id, user_id=current_user.id)
    except GoalError as exc:
        return _handle_goal_error(exc)
    await db.commit()
