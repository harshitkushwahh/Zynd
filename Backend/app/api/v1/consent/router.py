from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.deps import get_client_ip, get_current_user
from app.api.v1.consent.schemas import (
    ConsentAcceptRequest,
    ConsentAcceptResponse,
    ConsentCurrentVersionResponse,
    ConsentRequiredResponse,
    ConsentRevokeRequest,
    ConsentRevokeResponse,
)
from app.application.consent.consent_service import (
    ConsentAcceptContext,
    get_published_version_by_key,
    get_required_consents,
    record_acceptance,
    record_acceptances_for_keys,
    record_revocation,
)
from app.application.consent.errors import ConsentError
from app.core.database import get_db
from app.infrastructure.persistence.models import User
router = APIRouter(prefix="/consents", tags=["consents"])


def _handle_consent_error(exc: ConsentError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail={"code": exc.code, "message": exc.message})


def _accept_context(request: Request, source: str) -> ConsentAcceptContext:
    return ConsentAcceptContext(
        source=source,
        ip=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )


@router.get("/definitions/{consent_key}/current", response_model=ConsentCurrentVersionResponse)
async def get_consent_current(
    consent_key: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ConsentCurrentVersionResponse:
    pair = await get_published_version_by_key(db, consent_key)
    if not pair:
        raise HTTPException(status_code=404, detail={"code": "consent_not_found", "message": "Not found"})
    definition, version = pair
    return ConsentCurrentVersionResponse(
        consent_key=definition.key,
        title=definition.title,
        description=definition.description,
        acceptance_mode=definition.acceptance_mode.value,
        reaccept_policy=definition.reaccept_policy.value,
        consent_version_id=version.id,
        version_label=version.version_label,
        summary_text=version.summary_text,
        body_markdown=version.body_markdown,
        document_url=version.document_url,
    )


@router.get("/me/required", response_model=ConsentRequiredResponse)
async def get_my_required_consents(
    context: Literal["signup", "login", "kyc"],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ConsentRequiredResponse:
    items = await get_required_consents(db, user_id=current_user.id, context=context)
    return ConsentRequiredResponse(
        items=[ConsentCurrentVersionResponse(**item) for item in items],
    )


@router.post("/me/accept", response_model=ConsentAcceptResponse)
async def post_accept_consents(
    body: ConsentAcceptRequest,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ConsentAcceptResponse:
    keys = list(body.consent_keys)
    if body.consent_key and body.consent_key not in keys:
        keys.append(body.consent_key)
    if not keys:
        raise HTTPException(status_code=400, detail={"code": "consent_keys_required", "message": "No consents."})
    ctx = _accept_context(request, "user_api")
    try:
        if len(keys) == 1 and body.consent_version_id:
            await record_acceptance(
                db,
                user=current_user,
                definition_key=keys[0],
                consent_version_id=body.consent_version_id,
                context=ctx,
            )
            await db.commit()
            return ConsentAcceptResponse(accepted_count=1)
        records = await record_acceptances_for_keys(db, user=current_user, consent_keys_list=keys, context=ctx)
        await db.commit()
        return ConsentAcceptResponse(accepted_count=len(records))
    except ConsentError as exc:
        raise _handle_consent_error(exc) from exc


@router.post("/me/revoke", response_model=ConsentRevokeResponse)
async def post_revoke_consent(
    body: ConsentRevokeRequest,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ConsentRevokeResponse:
    try:
        await record_revocation(
            db,
            user=current_user,
            definition_key=body.consent_key,
            context=_accept_context(request, "user_api"),
        )
        await db.commit()
        return ConsentRevokeResponse()
    except ConsentError as exc:
        raise _handle_consent_error(exc) from exc
