from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.recommendations.recommendation_audit_service import (
    RECOMMENDATION_AUDIT_EVENTS,
    list_recommendation_audit_logs,
)
from app.infrastructure.persistence.models import AuditEventType


@pytest.mark.asyncio
async def test_list_recommendation_audit_logs_returns_empty_list(db_session: AsyncSession) -> None:
    items = await list_recommendation_audit_logs(db_session, limit=10, offset=0)
    assert items == []


@pytest.mark.asyncio
async def test_list_recommendation_audit_logs_filters_to_recommendation_events_only(
    db_session: AsyncSession,
) -> None:
    items = await list_recommendation_audit_logs(
        db_session,
        event_type=AuditEventType.recommendation_basket_created,
        limit=10,
        offset=0,
    )
    assert items == []
    assert AuditEventType.recommendation_basket_created in RECOMMENDATION_AUDIT_EVENTS
