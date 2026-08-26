from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Select, cast, func, or_, select, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.provider_log_models import ProviderApiLog, ProviderLogSource


class ProviderLogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def append(
        self,
        *,
        source: ProviderLogSource,
        action: str,
        method: str,
        path: str,
        user_id: UUID | None = None,
        status_code: int | None = None,
        success: bool = False,
        duration_ms: int | None = None,
        error_code: str | None = None,
        request_summary: dict[str, Any] | None = None,
        response_summary: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> ProviderApiLog:
        row = ProviderApiLog(
            source=source,
            user_id=user_id,
            action=action,
            method=method.upper(),
            path=path,
            status_code=status_code,
            success=success,
            duration_ms=duration_ms,
            error_code=error_code,
            request_summary=request_summary,
            response_summary=response_summary,
            metadata_=metadata,
        )
        self._session.add(row)
        await self._session.flush()
        return row

    def _apply_unified_search(self, query: Select[Any], q: str | None) -> Select[Any]:
        normalized = (q or "").strip()
        if not normalized:
            return query

        pattern = f"%{normalized}%"
        return query.where(
            or_(
                ProviderApiLog.action.ilike(pattern),
                ProviderApiLog.path.ilike(pattern),
                ProviderApiLog.method.ilike(pattern),
                ProviderApiLog.error_code.ilike(pattern),
                User.email.ilike(pattern),
                User.client_id.ilike(pattern),
                cast(ProviderApiLog.user_id, String).ilike(pattern),
            )
        )

    def _filtered_ids_query(
        self,
        *,
        source: ProviderLogSource | None = None,
        q: str | None = None,
        success: bool | None = None,
        from_at: datetime | None = None,
        to_at: datetime | None = None,
        since: datetime | None = None,
    ) -> Select[Any]:
        query = (
            select(ProviderApiLog.id)
            .outerjoin(User, User.id == ProviderApiLog.user_id)
            .order_by(ProviderApiLog.created_at.desc(), ProviderApiLog.id.desc())
        )
        if source is not None:
            query = query.where(ProviderApiLog.source == source)
        if success is not None:
            query = query.where(ProviderApiLog.success.is_(success))
        if from_at is not None:
            query = query.where(ProviderApiLog.created_at >= from_at)
        if to_at is not None:
            query = query.where(ProviderApiLog.created_at <= to_at)
        if since is not None:
            query = query.where(ProviderApiLog.created_at > since)
        return self._apply_unified_search(query, q)

    async def count_logs(self, **filters: Any) -> int:
        subquery = self._filtered_ids_query(**filters).subquery()
        result = await self._session.execute(select(func.count()).select_from(subquery))
        return int(result.scalar_one())

    async def list_logs(
        self,
        *,
        source: ProviderLogSource | None = None,
        q: str | None = None,
        success: bool | None = None,
        from_at: datetime | None = None,
        to_at: datetime | None = None,
        since: datetime | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        filters = {
            "source": source,
            "q": q,
            "success": success,
            "from_at": from_at,
            "to_at": to_at,
            "since": since,
        }
        id_query = self._filtered_ids_query(**filters).limit(min(max(limit, 1), 200)).offset(max(offset, 0))
        id_result = await self._session.execute(id_query)
        ids = [row[0] for row in id_result.all()]
        if not ids:
            return []

        query = (
            select(ProviderApiLog, User.email.label("user_email"), User.client_id.label("client_id"))
            .outerjoin(User, User.id == ProviderApiLog.user_id)
            .where(ProviderApiLog.id.in_(ids))
            .order_by(ProviderApiLog.created_at.desc(), ProviderApiLog.id.desc())
        )
        result = await self._session.execute(query)
        return [
            self._serialize_row(row, user_email, client_id)
            for row, user_email, client_id in result.all()
        ]

    async def export_logs(
        self,
        *,
        source: ProviderLogSource | None = None,
        q: str | None = None,
        success: bool | None = None,
        from_at: datetime | None = None,
        to_at: datetime | None = None,
        limit: int = 10_000,
    ) -> list[dict[str, Any]]:
        return await self.list_logs(
            source=source,
            q=q,
            success=success,
            from_at=from_at,
            to_at=to_at,
            limit=limit,
            offset=0,
        )

    @staticmethod
    def _serialize_row(
        row: ProviderApiLog,
        user_email: str | None,
        client_id: str | None = None,
    ) -> dict[str, Any]:
        return {
            "id": row.id,
            "source": row.source.value,
            "user_id": row.user_id,
            "client_id": client_id or "",
            "user_email": user_email,
            "action": row.action,
            "method": row.method,
            "path": row.path,
            "status_code": row.status_code,
            "success": row.success,
            "duration_ms": row.duration_ms,
            "error_code": row.error_code,
            "request_summary": row.request_summary or {},
            "response_summary": row.response_summary or {},
            "metadata": row.metadata_ or {},
            "created_at": row.created_at,
        }
