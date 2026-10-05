from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.deps import get_client_ip, require_permission
from app.application.admin.admin_action_service import create_admin_action_request
from app.application.admin.user_admin_service import get_user_by_reference
from app.application.consent.consent_service import (
    aggregate_acceptance_stats,
    create_draft_version,
    list_definitions_admin,
    list_user_consent_history,
    publish_version_direct,
)
from app.application.consent.errors import ConsentError
from app.core.database import get_db
from app.infrastructure.persistence.models import AdminActionType, User

router = APIRouter(prefix="/consents", tags=["admin-consents"])


class ConsentDefinitionListItem(BaseModel):
    id: UUID
    key: str
    title: str
    description: str | None = None
    channel: str
    acceptance_mode: str
    reaccept_policy: str
    is_active: bool
    published_version: dict | None = None
    versions: list[dict] = Field(default_factory=list)


class ConsentStatsItem(BaseModel):
    consent_key: str
    title: str
    version_label: str
    consent_version_id: UUID
    acceptance_count: int


class CreateConsentVersionRequest(BaseModel):
    version_label: str
    summary_text: str | None = None
    body_markdown: str | None = None
    document_url: str | None = None


class PublishConsentVersionRequest(BaseModel):
    use_maker_checker: bool = True
    reason: str | None = None


class ConsentVersionResponse(BaseModel):
    id: UUID
    version_label: str
    status: str


def _consent_error(exc: ConsentError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail={"code": exc.code, "message": exc.message})


@router.get("/definitions", response_model=list[ConsentDefinitionListItem])
async def list_consent_definitions(
    _: Annotated[User, Depends(require_permission("consents.read"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ConsentDefinitionListItem]:
    items = await list_definitions_admin(db)
    return [ConsentDefinitionListItem(**item) for item in items]


@router.get("/stats", response_model=list[ConsentStatsItem])
async def list_consent_stats(
    _: Annotated[User, Depends(require_permission("consents.read"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    consent_key: str | None = None,
) -> list[ConsentStatsItem]:
    items = await aggregate_acceptance_stats(db, definition_key=consent_key)
    return [ConsentStatsItem(**item) for item in items]


@router.get("/users/{user_ref}/records")
async def list_user_consent_records(
    user_ref: str,
    _: Annotated[User, Depends(require_permission("consents.records.read"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    user = await get_user_by_reference(db, user_ref)
    if not user:
        raise HTTPException(status_code=404, detail={"code": "user_not_found", "message": "User not found"})
    return await list_user_consent_history(db, user_id=user.id, limit=limit, offset=offset)


@router.post("/definitions/{consent_key}/versions", response_model=ConsentVersionResponse)
async def create_consent_draft_version(
    consent_key: str,
    body: CreateConsentVersionRequest,
    _: Annotated[User, Depends(require_permission("consents.manage"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ConsentVersionResponse:
    try:
        version = await create_draft_version(
            db,
            definition_key=consent_key,
            version_label=body.version_label,
            summary_text=body.summary_text,
            body_markdown=body.body_markdown,
            document_url=body.document_url,
        )
        await db.commit()
        return ConsentVersionResponse(
            id=version.id,
            version_label=version.version_label,
            status=version.status.value,
        )
    except ConsentError as exc:
        raise _consent_error(exc) from exc


@router.post("/versions/{version_id}/publish", response_model=ConsentVersionResponse)
async def publish_consent_version(
    version_id: UUID,
    body: PublishConsentVersionRequest,
    request: Request,
    actor: Annotated[User, Depends(require_permission("consents.manage"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ConsentVersionResponse | dict:
    if body.use_maker_checker:
        result = await create_admin_action_request(
            db,
            requester=actor,
            action_type=AdminActionType.consent_version_publish,
            target_type="consent_version",
            target_id=version_id,
            payload={"consent_version_id": str(version_id)},
            reason=body.reason,
            ip=get_client_ip(request),
        )
        await db.commit()
        return result

    try:
        version = await publish_version_direct(
            db,
            version_id=version_id,
            publisher=actor,
            ip=get_client_ip(request),
        )
        await db.commit()
        return ConsentVersionResponse(
            id=version.id,
            version_label=version.version_label,
            status=version.status.value,
        )
    except ConsentError as exc:
        raise _consent_error(exc) from exc
