from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.admin.admin_search_schemas import AdminSearchGroupResponse, AdminSearchResponse
from app.api.v1.auth.deps import require_admin_user
from app.application.admin.admin_search_service import SCOPE_PERMISSIONS, search_admin, search_admin_scope
from app.application.admin.rbac_service import get_user_permission_keys
from app.core.database import get_db
from app.infrastructure.persistence.models import User

router = APIRouter(prefix="/search", tags=["admin-search"])


@router.get("", response_model=AdminSearchResponse)
async def admin_search_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_admin_user)],
    q: str = Query(default="", max_length=120),
    scope: Optional[str] = Query(default=None),
    scopes: Optional[str] = Query(default=None, description="Comma-separated scopes for global search"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    stage: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    period: Optional[str] = Query(default=None),
) -> AdminSearchResponse:
    permissions = await get_user_permission_keys(db, current_user.id)
    parsed_scopes = [part.strip() for part in scopes.split(",") if part.strip()] if scopes else None

    if scope:
        if scope not in SCOPE_PERMISSIONS:
            raise HTTPException(
                status_code=400,
                detail={"code": "invalid_scope", "message": "Unknown search scope."},
            )
        try:
            payload = await search_admin_scope(
                db,
                scope=scope,
                query=q,
                limit=limit,
                offset=offset,
                permissions=permissions,
                stage=stage,
                status=status,
                period=period,
            )
        except PermissionError as exc:
            raise HTTPException(
                status_code=403,
                detail={"code": "permission_denied", "message": str(exc)},
            ) from exc
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail={"code": "invalid_scope", "message": str(exc)},
            ) from exc
        return AdminSearchResponse(**payload)

    payload = await search_admin(
        db,
        query=q,
        scopes=parsed_scopes,
        limit=limit,
        offset=offset,
        permissions=permissions,
        stage=stage,
        status=status,
        period=period,
    )
    groups = payload.get("groups")
    return AdminSearchResponse(
        query=payload["query"],
        scope=payload.get("scope"),
        total=payload["total"],
        limit=payload["limit"],
        offset=payload["offset"],
        took_ms=payload["took_ms"],
        cached=payload.get("cached", False),
        items=payload.get("items") or [],
        groups=[AdminSearchGroupResponse(**group) for group in groups] if groups else None,
    )
