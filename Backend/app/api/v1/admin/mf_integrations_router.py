from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.admin.schemas import (
    MfIntegrationEnvironmentUpdateRequest,
    MfIntegrationProviderResponse,
    MfIntegrationsListResponse,
    ZyndCompanySettingsResponse,
    ZyndCompanySettingsUpdateRequest,
)
from app.api.v1.auth.deps import get_client_ip, require_permission
from app.application.integrations.integration_config_service import (
    list_integration_statuses,
    set_integration_environment,
)
from app.application.mf.product_content_service import (
    get_zynd_company_settings_admin,
    update_zynd_company_settings_admin,
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


@router.get("/company", response_model=ZyndCompanySettingsResponse)
async def get_zynd_company_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("mf.integrations.read"))],
) -> ZyndCompanySettingsResponse:
    return ZyndCompanySettingsResponse(**await get_zynd_company_settings_admin(db))


@router.patch("/company", response_model=ZyndCompanySettingsResponse)
async def patch_zynd_company_settings(
    body: ZyndCompanySettingsUpdateRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("mf.integrations.manage"))],
) -> ZyndCompanySettingsResponse:
    updated = await update_zynd_company_settings_admin(
        db,
        admin_user_id=admin.id,
        distributor_arn=body.distributor_arn,
        distributor_euin=body.distributor_euin,
        clear_distributor_arn=body.clear_distributor_arn,
        clear_distributor_euin=body.clear_distributor_euin,
    )
    db.add(
        AuditLog(
            user_id=admin.id,
            event_type=AuditEventType.admin_action_requested,
            ip_address=get_client_ip(request),
            metadata_={
                "kind": "zynd_company_settings_updated",
                "distributor_arn_set": bool(updated.get("distributor_arn")),
                "distributor_euin_set": bool(updated.get("distributor_euin")),
            },
        )
    )
    await db.commit()
    return ZyndCompanySettingsResponse(**updated)


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
