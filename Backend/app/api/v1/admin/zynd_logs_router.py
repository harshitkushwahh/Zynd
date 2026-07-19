from __future__ import annotations

from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.admin.schemas import ZyndLogItemResponse, ZyndLogListResponse
from app.api.v1.auth.deps import require_permission
from app.application.admin.zynd_logs_admin_service import export_zynd_logs_csv, list_zynd_logs
from app.core.database import get_db
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.provider_log_models import ProviderLogSource

router = APIRouter(prefix="/zynd-logs", tags=["admin-zynd-logs"])


def _parse_datetime(value: str | None, *, field_name: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": f"invalid_{field_name}", "message": f"Invalid {field_name} timestamp."},
        ) from exc


def _parse_source(value: str | None) -> str | None:
    if not value:
        return None
    try:
        ProviderLogSource(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_source", "message": "Invalid log source."},
        ) from exc
    return value


@router.get("", response_model=ZyndLogListResponse)
async def get_zynd_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("audit.read"))],
    source: Annotated[Optional[str], Query()] = None,
    q: Annotated[Optional[str], Query()] = None,
    success: Annotated[Optional[bool], Query()] = None,
    from_at: Annotated[Optional[str], Query(alias="from")] = None,
    to_at: Annotated[Optional[str], Query(alias="to")] = None,
    since: Annotated[Optional[str], Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ZyndLogListResponse:
    result = await list_zynd_logs(
        db,
        source=_parse_source(source),
        q=q,
        success=success,
        from_at=_parse_datetime(from_at, field_name="from"),
        to_at=_parse_datetime(to_at, field_name="to"),
        since=_parse_datetime(since, field_name="since"),
        limit=limit,
        offset=offset,
    )
    return ZyndLogListResponse(
        items=[ZyndLogItemResponse.model_validate(item) for item in result["items"]],
        total=result["total"],
        has_more=result["has_more"],
        latest_at=result["latest_at"],
    )


@router.get("/export", response_class=PlainTextResponse)
async def export_zynd_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("audit.read"))],
    source: Annotated[Optional[str], Query()] = None,
    q: Annotated[Optional[str], Query()] = None,
    success: Annotated[Optional[bool], Query()] = None,
    from_at: Annotated[Optional[str], Query(alias="from")] = None,
    to_at: Annotated[Optional[str], Query(alias="to")] = None,
) -> PlainTextResponse:
    csv_content = await export_zynd_logs_csv(
        db,
        source=_parse_source(source),
        q=q,
        success=success,
        from_at=_parse_datetime(from_at, field_name="from"),
        to_at=_parse_datetime(to_at, field_name="to"),
    )
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="zynd-logs.csv"'},
    )
