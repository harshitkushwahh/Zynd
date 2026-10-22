from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.deps import get_client_ip, get_current_user
from app.api.v1.kyc.kyc_http_helpers import handle_kyc_error as _handle_kyc_error
from app.api.v1.kyc.zto_schemas import (
    ZtoConfigResponse,
    ZtoConsentTemplate,
    ZtoFlowStartRequest,
    ZtoFlowStatusResponse,
    ZtoOptInRequest,
    ZtoReviewAcceptRequest,
    ZtoReviewAcceptResponse,
    ZtoReviewDataResponse,
    ZtoReviewDeclineResponse,
    ZtoReviewFields,
)
from app.application.kyc.errors import KycError
from app.application.kyc.zto.constants import (
    LOOKUP_KIND_BANK,
    LOOKUP_KIND_CUSTOMER,
    PURPOSE_BY_KIND,
    consent_text,
    CONSENT_MODE_CHECKBOX,
)
from app.application.kyc.zto.flow_service import get_flow_status, opt_in_and_start_lookups, start_lookups
from app.application.kyc.zto.review_service import accept_review, build_review_data, decline_review
from app.application.kyc.zto.prefill_service import approved_profile_to_dict
from app.core.config import get_settings
from app.core.database import get_db
from app.infrastructure.persistence.models import User

router = APIRouter(prefix="/zero-touch", tags=["kyc-zero-touch"])


def _template(kind: str, partner: str) -> ZtoConsentTemplate:
    return ZtoConsentTemplate(
        purpose=PURPOSE_BY_KIND[kind],
        text=consent_text(kind, partner),
        mode=CONSENT_MODE_CHECKBOX,
    )


@router.get("/config", response_model=ZtoConfigResponse)
async def get_zto_config() -> ZtoConfigResponse:
    """Public — signup renders consent copy before the user is authenticated."""
    settings = get_settings()
    partner = settings.zto_partner_name
    return ZtoConfigResponse(
        enabled=settings.zto_enabled,
        mode=settings.zto_mode if settings.zto_enabled else None,
        partner_name=partner,
        bank_consent=_template(LOOKUP_KIND_BANK, partner),
        customer_consent=_template(LOOKUP_KIND_CUSTOMER, partner),
    )


@router.get("/flow/status", response_model=ZtoFlowStatusResponse)
async def get_zto_flow_status(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ZtoFlowStatusResponse:
    return ZtoFlowStatusResponse(**await get_flow_status(db, user_id=current_user.id))


@router.post("/flow/opt-in", response_model=ZtoFlowStatusResponse)
async def post_zto_opt_in(
    body: ZtoOptInRequest,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ZtoFlowStatusResponse:
    """After login — record Cybrilla lookup consents and start sandbox/production lookups."""
    try:
        await opt_in_and_start_lookups(
            db,
            user=current_user,
            bank_consent=body.zto_bank_consent,
            customer_consent=body.zto_customer_consent,
            ip=get_client_ip(request),
        )
    except KycError as exc:
        raise _handle_kyc_error(exc) from exc
    await db.commit()
    return ZtoFlowStatusResponse(**await get_flow_status(db, user_id=current_user.id))


@router.post("/flow/start", response_model=ZtoFlowStatusResponse)
async def post_zto_flow_start(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    body: ZtoFlowStartRequest | None = None,
) -> ZtoFlowStatusResponse:
    try:
        await start_lookups(db, user=current_user, name_override=body.name if body else None)
    except KycError as exc:
        raise _handle_kyc_error(exc) from exc
    await db.commit()
    return ZtoFlowStatusResponse(**await get_flow_status(db, user_id=current_user.id))


@router.get("/review-data", response_model=ZtoReviewDataResponse)
async def get_zto_review_data(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ZtoReviewDataResponse:
    try:
        data = await build_review_data(db, user=current_user)
    except KycError as exc:
        raise _handle_kyc_error(exc) from exc
    return ZtoReviewDataResponse(**data)


@router.post("/review/accept", response_model=ZtoReviewAcceptResponse)
async def post_zto_review_accept(
    body: ZtoReviewAcceptRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ZtoReviewAcceptResponse:
    try:
        profile = await accept_review(db, user=current_user, submitted=body.model_dump())
    except KycError as exc:
        raise _handle_kyc_error(exc) from exc
    await db.commit()
    return ZtoReviewAcceptResponse(
        phase="ACCEPTED",
        approved=ZtoReviewFields(**(approved_profile_to_dict(profile) or {})),
        edited={
            "name": profile.name_edited,
            "pan": profile.pan_edited,
            "date_of_birth": profile.dob_edited,
            "bank_account_number": profile.bank_account_edited,
            "ifsc_code": profile.ifsc_edited,
            "address_line": profile.address_edited,
        },
    )


@router.post("/review/decline", response_model=ZtoReviewDeclineResponse)
async def post_zto_review_decline(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ZtoReviewDeclineResponse:
    try:
        await decline_review(db, user=current_user)
    except KycError as exc:
        raise _handle_kyc_error(exc) from exc
    await db.commit()
    return ZtoReviewDeclineResponse(phase="DECLINED")
