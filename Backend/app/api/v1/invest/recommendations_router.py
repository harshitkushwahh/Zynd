from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.deps import get_current_user
from app.api.v1.invest.recommendation_schemas import FundsForYouResponse
from app.application.recommendations.funds_for_you_service import resolve_for_user
from app.core.database import get_db
from app.infrastructure.persistence.models import User

router = APIRouter()


@router.get("/funds-for-you", response_model=FundsForYouResponse)
async def get_funds_for_you(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> FundsForYouResponse:
    payload = await resolve_for_user(db, current_user.id)
    await db.commit()
    return FundsForYouResponse.model_validate(payload)
