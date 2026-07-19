from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.admin.schemas import (
    MfIntegrationEnvironmentUpdateRequest,
    MfIntegrationProviderResponse,
    MfIntegrationsListResponse,
)
from app.api.v1.auth.deps import get_client_ip, require_permission
from app.application.integrations.integration_config_service import (
    list_integration_statuses,
    set_integration_environment,
)
from app.application.integrations.integration_runtime import IntegrationProvider
from app.core.database import get_db
from app.infrastructure.persistence.models import AuditEventType, AuditLog, User

router = APIRouter(prefix="/mf/integrations", tags=["admin-mf-integrations"])


@router.get("", response_model=MfIntegrationsListResponse)
async def get_mf_integrations(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("mf.integrations.read"))],
) -> MfIntegrationsListResponse:
    items = await list_integration_statuses(db)
    return MfIntegrationsListResponse(
        items=[MfIntegrationProviderResponse(**item) for item in items]
    )


@router.patch("/{provider}/environment", response_model=MfIntegrationProviderResponse)
async def patch_mf_integration_environment(
    provider: IntegrationProvider,
    body: MfIntegrationEnvironmentUpdateRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("mf.integrations.manage"))],
) -> MfIntegrationProviderResponse:
    if body.environment not in {"test", "live"}:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_environment", "message": "environment must be test or live"},
        )

    try:
        item = await set_integration_environment(
            db,
            provider=provider,
            environment=body.environment,  # type: ignore[arg-type]
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": "integration_update_failed", "message": str(exc)},
        ) from exc

    db.add(
        AuditLog(
            user_id=admin.id,
            event_type=AuditEventType.admin_action_requested,
            ip_address=get_client_ip(request),
            metadata_={
                "kind": "integration_environment_changed",
                "provider": provider,
                "environment": body.environment,
            },
        )
    )
    await db.commit()
    return MfIntegrationProviderResponse(**item)
