from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.deps import get_client_ip, get_current_user
from app.api.v1.kyc.kyc_http_helpers import handle_kyc_error
from app.api.v1.kyc.schemas import (
    InvestorNomineeCreateRequest,
    InvestorProfileSettingsUpdateRequest,
    InvestorSettingsStateResponse,
    MfFolioNominationItemResponse,
    MfFolioNominationListResponse,
    SettingsNomineeOtpSendResponse,
)
from app.application.kyc.errors import KycError
from app.core.database import get_db
from app.infrastructure.kyc.cybrilla_terminal_log import log_exception_dump
from app.infrastructure.persistence.models import User

router = APIRouter()


@router.get("/settings/investor", response_model=InvestorSettingsStateResponse)
async def get_kyc_settings_investor(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> InvestorSettingsStateResponse:
    from app.application.investor.investor_settings_service import get_investor_settings_state

    state = await get_investor_settings_state(db, user_id=current_user.id)
    return InvestorSettingsStateResponse(**state)


@router.patch("/settings/investor-profile", response_model=InvestorSettingsStateResponse)
async def patch_kyc_settings_investor_profile(
    body: InvestorProfileSettingsUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> InvestorSettingsStateResponse:
    from app.application.investor.investor_settings_service import update_investor_profile_settings

    try:
        state = await update_investor_profile_settings(
            db,
            user=current_user,
            income_slab=body.income_slab,
            pep_details=body.pep_details,
            marital_status=body.marital_status,
            spouse_name=body.spouse_name,
        )
    except KycError as exc:
        raise handle_kyc_error(exc) from exc
    await db.commit()
    return InvestorSettingsStateResponse(**state)


@router.post("/settings/nominees/consent/send-otp", response_model=SettingsNomineeOtpSendResponse)
async def post_kyc_settings_nominee_consent_send_otp(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
) -> SettingsNomineeOtpSendResponse:
    from app.application.investor.nominee_settings_consent_service import send_settings_nominee_consent_otp

    try:
        payload = await send_settings_nominee_consent_otp(user=current_user, ip=get_client_ip(request))
    except KycError as exc:
        raise handle_kyc_error(exc) from exc
    return SettingsNomineeOtpSendResponse(
        masked_mobile=str(payload["masked_mobile"]),
        retry_after_seconds=payload.get("retry_after_seconds"),
        expires_in=payload.get("expires_in"),
    )


@router.post("/settings/nominees", response_model=InvestorSettingsStateResponse)
async def post_kyc_settings_nominee(
    body: InvestorNomineeCreateRequest,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> InvestorSettingsStateResponse:
    from app.application.consent.consent_service import ConsentAcceptContext
    from app.application.investor.investor_settings_service import add_investor_nominee
    from app.application.investor.nominee_settings_consent_service import verify_settings_nominee_consent_otp

    consent_context = ConsentAcceptContext(
        source="settings_nominee",
        ip=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )

    try:
        await verify_settings_nominee_consent_otp(
            db,
            user=current_user,
            otp=body.otp,
            consent_context=consent_context,
        )
        state = await add_investor_nominee(
            db,
            user=current_user,
            nominees=body.resolved_nominees(),
            consent_context=consent_context,
        )
    except KycError as exc:
        raise handle_kyc_error(exc) from exc
    except Exception as exc:
        log_exception_dump("POST /kyc/settings/nominees failed", exc)
        raise
    await db.commit()
    return InvestorSettingsStateResponse(**state)


@router.get("/settings/mf-folios", response_model=MfFolioNominationListResponse)
async def get_kyc_settings_mf_folios(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MfFolioNominationListResponse:
    from app.application.mf.mf_folio_nomination_service import list_user_mf_folio_nominations

    payload = await list_user_mf_folio_nominations(db, user_id=current_user.id)
    folios = [MfFolioNominationItemResponse(**item) for item in payload.get("folios", [])]
    return MfFolioNominationListResponse(available=bool(payload.get("available")), folios=folios)
