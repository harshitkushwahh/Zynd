from __future__ import annotations

from typing import Annotated

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.admin.risk_profile_schemas import (
    UserRiskProfileAssessmentDetailResponse,
    UserRiskProfileAssessmentListResponse,
)
from app.api.v1.auth.deps import get_client_ip, require_any_permission, require_permission
from app.api.v1.distributor.txn_recommendation_schemas import (
    CreateMitraTxnRecommendationRequest,
    DistributorSchemeSearchResponse,
    MitraTxnRecommendationListResponse,
    MitraTxnRecommendationResponse,
)
from app.api.v1.distributor.schemas import (
    ClientOnboardingContactUpdateRequest,
    ClientOnboardingContactUpdateResponse,
    ClientOnboardingDraftResponse,
    ClientOnboardingMobileOtpRequest,
    ClientOnboardingStartRequest,
    ClientOnboardingStartResponse,
    ClientOnboardingSubmitResponse,
    DistributorClientDetailResponse,
    DistributorClientFamilyGroupDetailResponse,
    DistributorClientListResponse,
    DistributorOrderListResponse,
    DistributorComplianceQueueResponse,
    DistributorConsoleContextResponse,
    DistributorPartnerDetailResponse,
    DistributorPartnerListResponse,
    OkResponse,
    OtpSendResponse,
    PartnerOnboardingDraftUpdateRequest,
    PartnerOnboardingMobileOtpRequest,
    PartnerOnboardingStartRequest,
    PartnerOnboardingStartResponse,
    PartnerOnboardingBankVerifyRequest,
    PartnerOnboardingBankVerifyResponse,
    PartnerOnboardingBankManualVerifyRequest,
    PartnerOnboardingBankManualVerifyResponse,
    PartnerOnboardingDocumentResponse,
    PartnerOnboardingDraftResponse,
    PartnerOnboardingPanVerifyRequest,
    PartnerOnboardingPanVerifyResponse,
    PartnerOnboardingProfilePhotoResponse,
    PartnerOnboardingSubmitResponse,
    PartnerOnboardingTokenRequest,
    PartnerOnboardingVerifyOtpRequest,
    VerifiedResponse,
)
from app.api.v1.kyc.schemas import (
    KycBankVerifyRequest,
    KycBankVerifyResponse,
    KycBootstrapResponse,
    KycBankPreverifyStatusResponse,
    KycFormSubmitRequest,
    KycFormSubmitResponse,
    KycJourneyStateRequest,
    KycJourneyStateResponse,
    build_kyc_bank_preverify_status_response,
    build_kyc_bank_verify_response,
    KycCountryItem,
    KycMasterDataEnumsResponse,
    KycMasterDataOption,
    KycNomineeEnumsResponse,
    KycPanConfirmNamesRequest,
    KycPanConfirmNamesResponse,
    KycPanFailure,
    KycPanVerifyRequest,
    KycPanVerifyResponse,
    KycPincodeResponse,
    KycReadinessInfo,
    KycStateItem,
    KycStepStatuses,
)
from app.application.distributor.client_onboarding_service import (
    ClientOnboardingError,
    discard_client_onboarding_draft,
    get_client_onboarding_draft_snapshot,
    resend_client_onboarding_email_otp,
    resend_client_onboarding_mobile_otp,
    send_client_onboarding_mobile_otp,
    start_client_onboarding,
    submit_client_onboarding,
    update_client_onboarding_contact,
    verify_client_onboarding_email,
    verify_client_onboarding_mobile,
)
from app.application.distributor.distributor_client_kyc_service import (
    confirm_distributor_client_kyc_pan_names,
    get_distributor_client_kyc_bank_preverify_status,
    get_distributor_client_kyc_bootstrap,
    save_distributor_client_kyc_journey_state,
    submit_distributor_client_kyc,
    verify_distributor_client_kyc_bank_hybrid,
    verify_distributor_client_kyc_pan,
)
from app.application.distributor.distributor_client_link_service import DistributorClientBookError
from app.application.kyc.errors import KycError
from app.application.kyc.master_data import master_data_enums
from app.application.kyc.nominee_master_data import nominee_master_data_enums
from app.application.distributor.distributor_console_service import get_distributor_console_context
from app.application.distributor.distributor_compliance_service import list_distributor_compliance_queue
from app.application.distributor.distributor_client_service import (
    download_distributor_client_risk_report,
    get_distributor_client_detail,
    get_distributor_client_family_group,
    get_distributor_client_risk_assessment_detail,
    list_distributor_client_risk_assessments,
    list_distributor_clients,
)
from app.application.distributor.distributor_orders_service import list_distributor_orders_for_actor
from app.application.distributor.mitra_txn_recommendation_service import (
    CreateMitraTxnRecommendationInput,
    CreateMitraTxnRecommendationItemInput,
    MitraTxnRecommendationError,
    MitraTxnInvestmentType,
    MitraTxnPaymentMethod,
    create_mitra_txn_recommendation,
    get_mitra_txn_recommendation_for_actor,
    list_mitra_txn_recommendations_for_actor,
    search_distributor_schemes,
)
from app.application.distributor.partner_onboarding_service import (
    PartnerOnboardingError,
    get_distributor_partner_detail,
    list_distributor_partners,
    resend_partner_onboarding_email_otp,
    resend_partner_onboarding_mobile_otp,
    send_partner_onboarding_mobile_otp,
    start_partner_onboarding,
    submit_partner_onboarding,
    update_partner_onboarding_draft_fields,
    clear_partner_onboarding_profile_photo,
    clear_partner_onboarding_document,
    download_partner_onboarding_document,
    download_partner_onboarding_profile_photo,
    get_partner_onboarding_draft_snapshot,
    upload_partner_onboarding_document,
    upload_partner_onboarding_profile_photo,
    verify_partner_onboarding_email,
    verify_partner_onboarding_mobile,
)
from app.application.distributor.partner_verification_service import (
    verify_partner_onboarding_bank,
    verify_partner_onboarding_bank_manual,
    verify_partner_onboarding_pan,
)
from app.application.risk_profile.errors import RiskProfileError
from app.core.database import get_db
from app.infrastructure.kyc.fp_clients import list_countries, list_states, lookup_pincode
from app.infrastructure.persistence.models import User

router = APIRouter(prefix="/distributor", tags=["distributor"])


def _partner_onboarding_http_error(exc: PartnerOnboardingError) -> HTTPException:
    detail: dict[str, object] = {"code": exc.code, "message": exc.message}
    return HTTPException(status_code=exc.status_code, detail=detail)


def _client_onboarding_http_error(exc: ClientOnboardingError) -> HTTPException:
    detail: dict[str, object] = {"code": exc.code, "message": exc.message}
    return HTTPException(status_code=exc.status_code, detail=detail)


def _client_book_http_error(exc: DistributorClientBookError) -> HTTPException:
    detail: dict[str, object] = {"code": exc.code, "message": exc.message}
    return HTTPException(status_code=exc.status_code, detail=detail)


def _kyc_http_error(exc: KycError) -> HTTPException:
    detail: dict[str, object] = {"code": exc.code, "message": exc.message}
    return HTTPException(status_code=exc.status_code, detail=detail)


@router.get("/partners", response_model=DistributorPartnerListResponse)
async def list_distributor_partners_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    manager: Annotated[User, Depends(require_permission("distributor.partners.list"))],
) -> DistributorPartnerListResponse:
    try:
        items = await list_distributor_partners(db, manager=manager)
    except PartnerOnboardingError as exc:
        raise _partner_onboarding_http_error(exc) from exc
    await db.commit()
    return DistributorPartnerListResponse(items=items)


@router.get("/console/context", response_model=DistributorConsoleContextResponse)
async def get_distributor_console_context_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("distributor.clients.list"))],
) -> DistributorConsoleContextResponse:
    from app.application.auth.errors import AuthError

    try:
        result = await get_distributor_console_context(db, user=user)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail={"code": exc.code, "message": exc.message}) from exc
    await db.commit()
    return DistributorConsoleContextResponse(**result)


@router.get("/partners/{reference}", response_model=DistributorPartnerDetailResponse)
async def get_distributor_partner_detail_route(
    reference: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    manager: Annotated[User, Depends(require_permission("distributor.partners.list"))],
) -> DistributorPartnerDetailResponse:
    try:
        result = await get_distributor_partner_detail(db, manager=manager, reference=reference)
    except PartnerOnboardingError as exc:
        raise _partner_onboarding_http_error(exc) from exc
    await db.commit()
    return DistributorPartnerDetailResponse(**result)


@router.post("/partners/onboarding/start", response_model=PartnerOnboardingStartResponse)
async def post_partner_onboarding_start(
    body: PartnerOnboardingStartRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    manager: Annotated[User, Depends(require_permission("distributor.partners.manage"))],
) -> PartnerOnboardingStartResponse:
    try:
        result = await start_partner_onboarding(
            db,
            manager=manager,
            email=body.email,
            ip=get_client_ip(request),
        )
    except PartnerOnboardingError as exc:
        raise _partner_onboarding_http_error(exc) from exc
    await db.commit()
    return PartnerOnboardingStartResponse(**result)


@router.post("/partners/onboarding/resend-email-otp", response_model=OtpSendResponse)
async def post_partner_onboarding_resend_email_otp(
    body: PartnerOnboardingTokenRequest,
    request: Request,
) -> OtpSendResponse:
    try:
        result = await resend_partner_onboarding_email_otp(
            onboarding_token=body.onboarding_token,
            ip=get_client_ip(request),
        )
    except PartnerOnboardingError as exc:
        raise _partner_onboarding_http_error(exc) from exc
    return OtpSendResponse(**result)


@router.post("/partners/onboarding/verify-email", response_model=VerifiedResponse)
async def post_partner_onboarding_verify_email(
    body: PartnerOnboardingVerifyOtpRequest,
) -> VerifiedResponse:
    try:
        await verify_partner_onboarding_email(
            onboarding_token=body.onboarding_token,
            otp=body.otp,
        )
    except PartnerOnboardingError as exc:
        raise _partner_onboarding_http_error(exc) from exc
    return VerifiedResponse()


@router.post("/partners/onboarding/send-mobile-otp", response_model=OtpSendResponse)
async def post_partner_onboarding_send_mobile_otp(
    body: PartnerOnboardingMobileOtpRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    manager: Annotated[User, Depends(require_permission("distributor.partners.manage"))],
) -> OtpSendResponse:
    try:
        result = await send_partner_onboarding_mobile_otp(
            db,
            manager=manager,
            onboarding_token=body.onboarding_token,
            mobile=body.mobile,
            ip=get_client_ip(request),
        )
    except PartnerOnboardingError as exc:
        raise _partner_onboarding_http_error(exc) from exc
    await db.commit()
    return OtpSendResponse(**result)


@router.post("/partners/onboarding/resend-mobile-otp", response_model=OtpSendResponse)
async def post_partner_onboarding_resend_mobile_otp(
    body: PartnerOnboardingTokenRequest,
    request: Request,
) -> OtpSendResponse:
    try:
        result = await resend_partner_onboarding_mobile_otp(
            onboarding_token=body.onboarding_token,
            ip=get_client_ip(request),
        )
    except PartnerOnboardingError as exc:
        raise _partner_onboarding_http_error(exc) from exc
    return OtpSendResponse(**result)


@router.post("/partners/onboarding/verify-mobile", response_model=VerifiedResponse)
async def post_partner_onboarding_verify_mobile(
    body: PartnerOnboardingVerifyOtpRequest,
) -> VerifiedResponse:
    try:
        await verify_partner_onboarding_mobile(
            onboarding_token=body.onboarding_token,
            otp=body.otp,
        )
    except PartnerOnboardingError as exc:
        raise _partner_onboarding_http_error(exc) from exc
    return VerifiedResponse()


@router.patch("/partners/onboarding/draft", response_model=OkResponse)
async def patch_partner_onboarding_draft(
    body: PartnerOnboardingDraftUpdateRequest,
) -> OkResponse:
    try:
        await update_partner_onboarding_draft_fields(
            onboarding_token=body.onboarding_token,
            payload=body.model_dump(exclude={"onboarding_token"}, exclude_none=True),
        )
    except PartnerOnboardingError as exc:
        raise _partner_onboarding_http_error(exc) from exc
    return OkResponse()


@router.get("/partners/onboarding/draft", response_model=PartnerOnboardingDraftResponse)
async def get_partner_onboarding_draft_route(
    onboarding_token: Annotated[str, Query(min_length=8, max_length=256)],
    manager: Annotated[User, Depends(require_permission("distributor.partners.manage"))],
) -> PartnerOnboardingDraftResponse:
    try:
        result = await get_partner_onboarding_draft_snapshot(
            manager=manager,
            onboarding_token=onboarding_token,
        )
    except PartnerOnboardingError as exc:
        raise _partner_onboarding_http_error(exc) from exc
    return PartnerOnboardingDraftResponse(**result)


@router.get("/partners/onboarding/documents/{doc_type}")
async def get_partner_onboarding_document_route(
    doc_type: str,
    onboarding_token: Annotated[str, Query(min_length=8, max_length=256)],
    manager: Annotated[User, Depends(require_permission("distributor.partners.manage"))],
) -> Response:
    try:
        content, mime_type, file_name = await download_partner_onboarding_document(
            manager=manager,
            onboarding_token=onboarding_token,
            doc_type=doc_type,
        )
    except PartnerOnboardingError as exc:
        raise _partner_onboarding_http_error(exc) from exc
    return Response(
        content=content,
        media_type=mime_type,
        headers={"Content-Disposition": f'inline; filename="{file_name}"'},
    )


@router.get("/partners/onboarding/profile-photo")
async def get_partner_onboarding_profile_photo_route(
    onboarding_token: Annotated[str, Query(min_length=8, max_length=256)],
    manager: Annotated[User, Depends(require_permission("distributor.partners.manage"))],
) -> Response:
    try:
        content, mime_type, file_name = await download_partner_onboarding_profile_photo(
            manager=manager,
            onboarding_token=onboarding_token,
        )
    except PartnerOnboardingError as exc:
        raise _partner_onboarding_http_error(exc) from exc
    return Response(
        content=content,
        media_type=mime_type,
        headers={"Content-Disposition": f'inline; filename="{file_name}"'},
    )


@router.post("/partners/onboarding/profile-photo", response_model=PartnerOnboardingProfilePhotoResponse)
async def post_partner_onboarding_profile_photo(
    onboarding_token: Annotated[str, Form(min_length=8, max_length=256)],
    file: Annotated[UploadFile, File()],
    db: Annotated[AsyncSession, Depends(get_db)],
    manager: Annotated[User, Depends(require_permission("distributor.partners.manage"))],
) -> PartnerOnboardingProfilePhotoResponse:
    content = await file.read()
    try:
        result = await upload_partner_onboarding_profile_photo(
            db,
            manager=manager,
            onboarding_token=onboarding_token,
            filename=file.filename or "profile-photo.jpg",
            mime_type=file.content_type or "application/octet-stream",
            content=content,
        )
    except PartnerOnboardingError as exc:
        raise _partner_onboarding_http_error(exc) from exc
    return PartnerOnboardingProfilePhotoResponse(**result)


@router.post("/partners/onboarding/verify-pan", response_model=PartnerOnboardingPanVerifyResponse)
async def post_partner_onboarding_verify_pan(
    body: PartnerOnboardingPanVerifyRequest,
    manager: Annotated[User, Depends(require_permission("distributor.partners.manage"))],
) -> PartnerOnboardingPanVerifyResponse:
    from app.infrastructure.persistence.partner_onboarding_draft_store import get_partner_onboarding_draft

    draft = await get_partner_onboarding_draft(body.onboarding_token)
    if not draft:
        raise _partner_onboarding_http_error(
            PartnerOnboardingError("Onboarding session expired.", "onboarding_expired", 410)
        )
    if str(draft.get("manager_user_id")) != str(manager.id):
        raise _partner_onboarding_http_error(
            PartnerOnboardingError("Invalid onboarding session.", "onboarding_invalid", 403)
        )
    try:
        result = await verify_partner_onboarding_pan(
            onboarding_token=body.onboarding_token,
            pan=body.pan,
        )
    except PartnerOnboardingError as exc:
        raise _partner_onboarding_http_error(exc) from exc
    return PartnerOnboardingPanVerifyResponse(**result)


@router.post("/partners/onboarding/verify-bank", response_model=PartnerOnboardingBankVerifyResponse)
async def post_partner_onboarding_verify_bank(
    body: PartnerOnboardingBankVerifyRequest,
    manager: Annotated[User, Depends(require_permission("distributor.partners.manage"))],
) -> PartnerOnboardingBankVerifyResponse:
    from app.infrastructure.persistence.partner_onboarding_draft_store import get_partner_onboarding_draft

    draft = await get_partner_onboarding_draft(body.onboarding_token)
    if not draft:
        raise _partner_onboarding_http_error(
            PartnerOnboardingError("Onboarding session expired.", "onboarding_expired", 410)
        )
    if str(draft.get("manager_user_id")) != str(manager.id):
        raise _partner_onboarding_http_error(
            PartnerOnboardingError("Invalid onboarding session.", "onboarding_invalid", 403)
        )
    try:
        result = await verify_partner_onboarding_bank(
            onboarding_token=body.onboarding_token,
            account_number=body.account_number,
            account_type=body.account_type,
            ifsc=body.ifsc,
        )
    except PartnerOnboardingError as exc:
        raise _partner_onboarding_http_error(exc) from exc
    return PartnerOnboardingBankVerifyResponse(**result)


@router.post(
    "/partners/onboarding/verify-bank-manual",
    response_model=PartnerOnboardingBankManualVerifyResponse,
)
async def post_partner_onboarding_verify_bank_manual(
    body: PartnerOnboardingBankManualVerifyRequest,
    manager: Annotated[User, Depends(require_permission("distributor.partners.manage"))],
) -> PartnerOnboardingBankManualVerifyResponse:
    from app.infrastructure.persistence.partner_onboarding_draft_store import get_partner_onboarding_draft

    draft = await get_partner_onboarding_draft(body.onboarding_token)
    if not draft:
        raise _partner_onboarding_http_error(
            PartnerOnboardingError("Onboarding session expired.", "onboarding_expired", 410)
        )
    if str(draft.get("manager_user_id")) != str(manager.id):
        raise _partner_onboarding_http_error(
            PartnerOnboardingError("Invalid onboarding session.", "onboarding_invalid", 403)
        )
    try:
        result = await verify_partner_onboarding_bank_manual(
            onboarding_token=body.onboarding_token,
            account_holder_name=body.account_holder_name,
            account_number=body.account_number,
            confirm_account_number=body.confirm_account_number,
            account_type=body.account_type,
            ifsc=body.ifsc,
            bank_name=body.bank_name,
            branch_name=body.branch_name,
        )
    except PartnerOnboardingError as exc:
        raise _partner_onboarding_http_error(exc) from exc
    return PartnerOnboardingBankManualVerifyResponse(**result)


@router.post("/partners/onboarding/documents/{doc_type}", response_model=PartnerOnboardingDocumentResponse)
async def post_partner_onboarding_document(
    doc_type: str,
    onboarding_token: Annotated[str, Form(min_length=8, max_length=256)],
    file: Annotated[UploadFile, File()],
    db: Annotated[AsyncSession, Depends(get_db)],
    manager: Annotated[User, Depends(require_permission("distributor.partners.manage"))],
) -> PartnerOnboardingDocumentResponse:
    content = await file.read()
    try:
        result = await upload_partner_onboarding_document(
            db,
            manager=manager,
            onboarding_token=onboarding_token,
            doc_type=doc_type,
            filename=file.filename or f"{doc_type}.pdf",
            mime_type=file.content_type or "application/octet-stream",
            content=content,
        )
    except PartnerOnboardingError as exc:
        raise _partner_onboarding_http_error(exc) from exc
    return PartnerOnboardingDocumentResponse(**result)


@router.delete("/partners/onboarding/documents/{doc_type}", response_model=OkResponse)
async def delete_partner_onboarding_document_route(
    doc_type: str,
    body: PartnerOnboardingTokenRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    manager: Annotated[User, Depends(require_permission("distributor.partners.manage"))],
) -> OkResponse:
    try:
        await clear_partner_onboarding_document(
            db,
            manager=manager,
            onboarding_token=body.onboarding_token,
            doc_type=doc_type,
        )
    except PartnerOnboardingError as exc:
        raise _partner_onboarding_http_error(exc) from exc
    return OkResponse()


@router.delete("/partners/onboarding/profile-photo", response_model=OkResponse)
async def delete_partner_onboarding_profile_photo_route(
    body: PartnerOnboardingTokenRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    manager: Annotated[User, Depends(require_permission("distributor.partners.manage"))],
) -> OkResponse:
    try:
        await clear_partner_onboarding_profile_photo(
            db,
            manager=manager,
            onboarding_token=body.onboarding_token,
        )
    except PartnerOnboardingError as exc:
        raise _partner_onboarding_http_error(exc) from exc
    return OkResponse()


@router.post("/partners/onboarding/submit", response_model=PartnerOnboardingSubmitResponse)
async def post_partner_onboarding_submit(
    body: PartnerOnboardingTokenRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    manager: Annotated[User, Depends(require_permission("distributor.partners.manage"))],
) -> PartnerOnboardingSubmitResponse:
    try:
        result = await submit_partner_onboarding(
            db,
            manager=manager,
            onboarding_token=body.onboarding_token,
            ip=get_client_ip(request),
        )
    except PartnerOnboardingError as exc:
        await db.rollback()
        raise _partner_onboarding_http_error(exc) from exc
    await db.commit()
    return PartnerOnboardingSubmitResponse(**result)


@router.post("/clients/onboarding/start", response_model=ClientOnboardingStartResponse)
async def post_client_onboarding_start(
    body: ClientOnboardingStartRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.clients.onboard"))],
) -> ClientOnboardingStartResponse:
    try:
        result = await start_client_onboarding(
            db,
            actor=actor,
            email=body.email,
            ip=get_client_ip(request),
        )
    except ClientOnboardingError as exc:
        await db.rollback()
        raise _client_onboarding_http_error(exc) from exc
    await db.commit()
    return ClientOnboardingStartResponse(**result)


@router.post("/clients/onboarding/verify-email", response_model=VerifiedResponse)
async def post_client_onboarding_verify_email(
    body: PartnerOnboardingVerifyOtpRequest,
) -> VerifiedResponse:
    try:
        await verify_client_onboarding_email(
            onboarding_token=body.onboarding_token,
            otp=body.otp,
        )
    except ClientOnboardingError as exc:
        raise _client_onboarding_http_error(exc) from exc
    return VerifiedResponse()


@router.post("/clients/onboarding/resend-email-otp", response_model=OtpSendResponse)
async def post_client_onboarding_resend_email_otp(
    body: PartnerOnboardingTokenRequest,
    request: Request,
) -> OtpSendResponse:
    try:
        result = await resend_client_onboarding_email_otp(
            onboarding_token=body.onboarding_token,
            ip=get_client_ip(request),
        )
    except ClientOnboardingError as exc:
        raise _client_onboarding_http_error(exc) from exc
    return OtpSendResponse(**result)


@router.post("/clients/onboarding/send-mobile-otp", response_model=OtpSendResponse)
async def post_client_onboarding_send_mobile_otp(
    body: ClientOnboardingMobileOtpRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OtpSendResponse:
    try:
        result = await send_client_onboarding_mobile_otp(
            db,
            onboarding_token=body.onboarding_token,
            mobile=body.mobile,
            ip=get_client_ip(request),
        )
    except ClientOnboardingError as exc:
        await db.rollback()
        raise _client_onboarding_http_error(exc) from exc
    await db.commit()
    return OtpSendResponse(**result)


@router.post("/clients/onboarding/resend-mobile-otp", response_model=OtpSendResponse)
async def post_client_onboarding_resend_mobile_otp(
    body: PartnerOnboardingTokenRequest,
    request: Request,
) -> OtpSendResponse:
    try:
        result = await resend_client_onboarding_mobile_otp(
            onboarding_token=body.onboarding_token,
            ip=get_client_ip(request),
        )
    except ClientOnboardingError as exc:
        raise _client_onboarding_http_error(exc) from exc
    return OtpSendResponse(**result)


@router.post("/clients/onboarding/verify-mobile", response_model=VerifiedResponse)
async def post_client_onboarding_verify_mobile(
    body: PartnerOnboardingVerifyOtpRequest,
) -> VerifiedResponse:
    try:
        await verify_client_onboarding_mobile(
            onboarding_token=body.onboarding_token,
            otp=body.otp,
        )
    except ClientOnboardingError as exc:
        raise _client_onboarding_http_error(exc) from exc
    return VerifiedResponse()


@router.post("/clients/onboarding/submit", response_model=ClientOnboardingSubmitResponse)
async def post_client_onboarding_submit(
    body: PartnerOnboardingTokenRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.clients.onboard"))],
) -> ClientOnboardingSubmitResponse:
    try:
        result = await submit_client_onboarding(
            db,
            actor=actor,
            onboarding_token=body.onboarding_token,
            ip=get_client_ip(request),
        )
    except ClientOnboardingError as exc:
        await db.rollback()
        raise _client_onboarding_http_error(exc) from exc
    await db.commit()
    return ClientOnboardingSubmitResponse(**result)


@router.get("/clients/onboarding/draft", response_model=ClientOnboardingDraftResponse)
async def get_client_onboarding_draft_route(
    onboarding_token: Annotated[str, Query(min_length=16, max_length=256)],
    actor: Annotated[User, Depends(require_permission("distributor.clients.onboard"))],
) -> ClientOnboardingDraftResponse:
    try:
        result = await get_client_onboarding_draft_snapshot(
            actor=actor,
            onboarding_token=onboarding_token,
        )
    except ClientOnboardingError as exc:
        raise _client_onboarding_http_error(exc) from exc
    return ClientOnboardingDraftResponse(**result)


@router.patch("/clients/onboarding/draft", response_model=ClientOnboardingContactUpdateResponse)
async def patch_client_onboarding_draft_route(
    body: ClientOnboardingContactUpdateRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.clients.onboard"))],
) -> ClientOnboardingContactUpdateResponse:
    try:
        result = await update_client_onboarding_contact(
            db,
            actor=actor,
            onboarding_token=body.onboarding_token,
            email=body.email,
            mobile=body.mobile,
            ip=get_client_ip(request),
        )
    except ClientOnboardingError as exc:
        await db.rollback()
        raise _client_onboarding_http_error(exc) from exc
    await db.commit()
    return ClientOnboardingContactUpdateResponse(**result)


@router.delete("/clients/onboarding/draft", response_model=OkResponse)
async def delete_client_onboarding_draft_route(
    onboarding_token: Annotated[str, Query(min_length=16, max_length=256)],
    actor: Annotated[User, Depends(require_permission("distributor.clients.onboard"))],
) -> OkResponse:
    try:
        await discard_client_onboarding_draft(actor=actor, onboarding_token=onboarding_token)
    except ClientOnboardingError as exc:
        raise _client_onboarding_http_error(exc) from exc
    return OkResponse()


@router.post("/clients/{client_user_id}/kyc/pan/verify", response_model=KycPanVerifyResponse)
async def post_distributor_client_kyc_pan_verify(
    client_user_id: UUID,
    body: KycPanVerifyRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.clients.onboard"))],
) -> KycPanVerifyResponse:
    try:
        result = await verify_distributor_client_kyc_pan(
            db,
            actor=actor,
            client_user_id=client_user_id,
            pan_number=body.pan_number,
        )
    except DistributorClientBookError as exc:
        raise _client_book_http_error(exc) from exc
    except KycError as exc:
        raise _kyc_http_error(exc) from exc
    await db.commit()

    if result.get("blocked"):
        return KycPanVerifyResponse(
            success=False,
            blocked=True,
            block_type=result.get("blockType"),
            message=result.get("message"),
            failure=KycPanFailure(**result["failure"]) if result.get("failure") else None,
            readiness=KycReadinessInfo(**result["readiness"]) if result.get("readiness") else None,
        )

    return KycPanVerifyResponse(
        success=True,
        pan_draft=result.get("panDraft"),
        kyc_already_registered=result.get("kycAlreadyRegistered"),
        readiness=KycReadinessInfo(**result["readiness"]) if result.get("readiness") else None,
        requires_digilocker=result.get("requiresDigilocker"),
    )


@router.get("/clients/{client_user_id}/kyc/bootstrap", response_model=KycBootstrapResponse)
async def get_distributor_client_kyc_bootstrap_route(
    client_user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.clients.onboard"))],
) -> KycBootstrapResponse:
    try:
        payload = await get_distributor_client_kyc_bootstrap(
            db,
            actor=actor,
            client_user_id=client_user_id,
        )
    except DistributorClientBookError as exc:
        raise _client_book_http_error(exc) from exc
    await db.commit()
    step_statuses = payload.get("stepStatuses")
    return KycBootstrapResponse(
        eligible=True,
        reasons=[],
        last_completed_step=payload["lastCompletedStep"],
        active_step_index=payload["activeStepIndex"],
        pan_draft=payload["panDraft"],
        contact_draft=payload["contactDraft"],
        personal_draft=payload["personalDraft"],
        nominee_draft=payload["nomineeDraft"],
        bank_draft=payload["bankDraft"],
        kyc_already_registered=payload["kycAlreadyRegistered"],
        readiness_code=payload["readinessCode"],
        readiness_reason=payload["readinessReason"],
        pan_verification_status=payload["panVerificationStatus"],
        pan_verification_failure=payload["panVerificationFailure"],
        external_identity_document_id=payload["externalIdentityDocumentId"],
        external_kyc_status=payload["externalKycStatus"],
        digilocker_failure_reason=payload["digilockerFailureReason"],
        bank_verification_status=payload["bankVerificationStatus"],
        bank_verification_failure=payload["bankVerificationFailure"],
        poa_bank_preverify_id=payload["poaBankPreverifyId"],
        poa_bank_proof_file_id=payload["poaBankProofFileId"],
        signature_draft=payload["signatureDraft"],
        external_kyc_form_id=payload["externalKycFormId"],
        kyc_form_status=payload["kycFormStatus"],
        kyc_form_type=payload["kycFormType"],
        kyc_form_failure_reason=payload["kycFormFailureReason"],
        proof_details_status=payload["proofDetailsStatus"],
        esign_details_status=payload["esignDetailsStatus"],
        geolocation_draft=payload["geolocationDraft"],
        step_statuses=KycStepStatuses(**step_statuses) if step_statuses else None,
        client_id=payload.get("clientId"),
    )


@router.post("/clients/{client_user_id}/kyc/pan/confirm-names", response_model=KycPanConfirmNamesResponse)
async def post_distributor_client_kyc_pan_confirm_names(
    client_user_id: UUID,
    body: KycPanConfirmNamesRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.clients.onboard"))],
) -> KycPanConfirmNamesResponse:
    try:
        result = await confirm_distributor_client_kyc_pan_names(
            db,
            actor=actor,
            client_user_id=client_user_id,
            first_name=body.first_name,
            middle_name=body.middle_name,
            last_name=body.last_name,
        )
    except DistributorClientBookError as exc:
        raise _client_book_http_error(exc) from exc
    except KycError as exc:
        raise _kyc_http_error(exc) from exc
    await db.commit()

    if result.get("blocked"):
        return KycPanConfirmNamesResponse(
            success=False,
            blocked=True,
            block_type=result.get("blockType"),
            failure=KycPanFailure(**result["failure"]) if result.get("failure") else None,
        )

    return KycPanConfirmNamesResponse(
        success=True,
        pan_draft=result.get("panDraft"),
    )


@router.post("/clients/{client_user_id}/kyc/bank/verify-hybrid", response_model=KycBankVerifyResponse)
async def post_distributor_client_kyc_bank_verify_hybrid(
    client_user_id: UUID,
    body: KycBankVerifyRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.clients.onboard"))],
) -> KycBankVerifyResponse:
    try:
        result = await verify_distributor_client_kyc_bank_hybrid(
            db,
            actor=actor,
            client_user_id=client_user_id,
            account_number=body.account_number,
            account_type=body.account_type,
            ifsc_code=body.ifsc_code,
        )
    except DistributorClientBookError as exc:
        raise _client_book_http_error(exc) from exc
    except KycError as exc:
        raise _kyc_http_error(exc) from exc
    await db.commit()
    return build_kyc_bank_verify_response(result)


@router.get(
    "/clients/{client_user_id}/kyc/bank/preverify/{preverify_id}",
    response_model=KycBankPreverifyStatusResponse,
)
async def get_distributor_client_kyc_bank_preverify_status_route(
    client_user_id: UUID,
    preverify_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.clients.onboard"))],
) -> KycBankPreverifyStatusResponse:
    try:
        result = await get_distributor_client_kyc_bank_preverify_status(
            db,
            actor=actor,
            client_user_id=client_user_id,
            preverify_id=preverify_id,
        )
    except DistributorClientBookError as exc:
        raise _client_book_http_error(exc) from exc
    except KycError as exc:
        raise _kyc_http_error(exc) from exc
    await db.commit()
    return build_kyc_bank_preverify_status_response(result)


def _kyc_form_submit_response(result: dict[str, object]) -> KycFormSubmitResponse:
    return KycFormSubmitResponse(
        form_id=result.get("formId") or result.get("form_id"),  # type: ignore[arg-type]
        form_status=result.get("formStatus") or result.get("form_status"),  # type: ignore[arg-type]
        next_action=str(result.get("nextAction") or result.get("next_action") or "none"),
        redirect_url=result.get("redirectUrl") or result.get("redirect_url"),  # type: ignore[arg-type]
        message=result.get("message"),  # type: ignore[arg-type]
        signature_provided=bool(result.get("signatureProvided") or result.get("signature_provided")),
        proof_status=result.get("proofStatus") or result.get("proof_status"),  # type: ignore[arg-type]
        esign_status=result.get("esignStatus") or result.get("esign_status"),  # type: ignore[arg-type]
        failure_reason=result.get("failureReason") or result.get("failure_reason"),  # type: ignore[arg-type]
    )


@router.post("/clients/{client_user_id}/kyc/journey/state", response_model=KycJourneyStateResponse)
async def post_distributor_client_kyc_journey_state(
    client_user_id: UUID,
    body: KycJourneyStateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.clients.onboard"))],
) -> KycJourneyStateResponse:
    geolocation_json = (
        body.geolocation_json.model_dump(by_alias=True) if body.geolocation_json is not None else None
    )
    try:
        result = await save_distributor_client_kyc_journey_state(
            db,
            actor=actor,
            client_user_id=client_user_id,
            pan_draft_json=body.pan_draft_json,
            contact_draft_json=body.contact_draft_json,
            personal_draft_json=body.personal_draft_json,
            nominee_draft_json=body.nominee_draft_json,
            bank_draft_json=body.bank_draft_json,
            signature_draft_json=body.signature_draft_json,
            geolocation_json=geolocation_json,
            last_completed_step=body.last_completed_step,
            middle_name=body.middle_name,
        )
    except DistributorClientBookError as exc:
        raise _client_book_http_error(exc) from exc
    except KycError as exc:
        raise _kyc_http_error(exc) from exc
    await db.commit()
    return KycJourneyStateResponse(
        last_completed_step=result["lastCompletedStep"],
        active_step_index=result["activeStepIndex"],
    )


@router.post("/clients/{client_user_id}/kyc/submit", response_model=KycFormSubmitResponse)
async def post_distributor_client_kyc_submit(
    client_user_id: UUID,
    body: KycFormSubmitRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.clients.onboard"))],
) -> KycFormSubmitResponse:
    try:
        result = await submit_distributor_client_kyc(
            db,
            actor=actor,
            client_user_id=client_user_id,
            latitude=body.latitude,
            longitude=body.longitude,
            accuracy_meters=body.accuracy_meters,
            client_ip=get_client_ip(request),
        )
    except DistributorClientBookError as exc:
        raise _client_book_http_error(exc) from exc
    except KycError as exc:
        raise _kyc_http_error(exc) from exc
    await db.commit()
    return _kyc_form_submit_response(result)


@router.get("/kyc/master-data/enums", response_model=KycMasterDataEnumsResponse)
async def get_distributor_kyc_master_data_enums(
    _: Annotated[User, Depends(require_permission("distributor.clients.onboard"))],
) -> KycMasterDataEnumsResponse:
    enums = master_data_enums()
    return KycMasterDataEnumsResponse(
        gender=[KycMasterDataOption(**item) for item in enums["gender"]],
        marital_status=[KycMasterDataOption(**item) for item in enums["maritalStatus"]],
        occupation=[KycMasterDataOption(**item) for item in enums["occupation"]],
        income_slab=[KycMasterDataOption(**item) for item in enums["incomeSlab"]],
        pep_exposed=[KycMasterDataOption(**item) for item in enums["pepExposed"]],
    )


@router.get("/kyc/master-data/nominee-enums", response_model=KycNomineeEnumsResponse)
async def get_distributor_kyc_nominee_enums(
    _: Annotated[User, Depends(require_permission("distributor.clients.onboard"))],
) -> KycNomineeEnumsResponse:
    enums = nominee_master_data_enums()
    return KycNomineeEnumsResponse(
        relationships=[KycMasterDataOption(**item) for item in enums["relationships"]],
        source_of_wealth=[KycMasterDataOption(**item) for item in enums["sourceOfWealth"]],
        document_types=[KycMasterDataOption(**item) for item in enums["documentTypes"]],
    )


@router.get("/kyc/master-data/states", response_model=list[KycStateItem])
async def get_distributor_kyc_states(
    _: Annotated[User, Depends(require_permission("distributor.clients.onboard"))],
) -> list[KycStateItem]:
    items = await list_states()
    return [KycStateItem(**item) for item in items]


@router.get("/kyc/master-data/countries", response_model=list[KycCountryItem])
async def get_distributor_kyc_countries(
    _: Annotated[User, Depends(require_permission("distributor.clients.onboard"))],
) -> list[KycCountryItem]:
    items = await list_countries()
    return [KycCountryItem(name=item["name"], ansi_code=item["ansi_code"]) for item in items]


@router.get("/kyc/master-data/pincode/{pincode}", response_model=KycPincodeResponse)
async def get_distributor_kyc_pincode(
    pincode: str,
    _: Annotated[User, Depends(require_permission("distributor.clients.onboard"))],
) -> KycPincodeResponse:
    if not pincode.isdigit() or len(pincode) != 6:
        raise HTTPException(status_code=400, detail={"code": "invalid_pincode", "message": "Invalid pincode."})
    payload = await lookup_pincode(pincode)
    return KycPincodeResponse(
        code=str(payload.get("code") or pincode),
        city=str(payload.get("city") or ""),
        district=str(payload.get("district") or ""),
        state_name=str(payload.get("state_name") or ""),
        country_ansi_code=str(payload.get("country_ansi_code") or "IN"),
    )


@router.get("/compliance/queue", response_model=DistributorComplianceQueueResponse)
async def get_distributor_compliance_queue_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.compliance.list"))],
) -> DistributorComplianceQueueResponse:
    items = await list_distributor_compliance_queue(db, actor=actor)
    await db.commit()
    return DistributorComplianceQueueResponse(items=items)


@router.get("/clients", response_model=DistributorClientListResponse)
async def list_distributor_clients_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.clients.list"))],
    email: str | None = Query(default=None),
    scope: str = Query(default="book"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> DistributorClientListResponse:
    items = await list_distributor_clients(
        db,
        actor=actor,
        scope=scope,
        email=email,
        limit=limit,
        offset=offset,
    )
    await db.commit()
    return DistributorClientListResponse(items=items)


@router.get("/orders", response_model=DistributorOrderListResponse)
async def list_distributor_orders_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.clients.list"))],
    scope: str = Query(default="book"),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> DistributorOrderListResponse:
    items = await list_distributor_orders_for_actor(
        db,
        actor=actor,
        scope=scope,
        limit=limit,
        offset=offset,
    )
    await db.commit()
    return DistributorOrderListResponse(items=items)


@router.get("/clients/{client_reference}", response_model=DistributorClientDetailResponse)
async def get_distributor_client_detail_route(
    client_reference: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.clients.read"))],
) -> DistributorClientDetailResponse:
    payload = await get_distributor_client_detail(db, client_reference, actor=actor)
    if payload is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "client_not_found", "message": "Client not found."},
        )
    await db.commit()
    return DistributorClientDetailResponse(**payload)


@router.get(
    "/clients/{client_reference}/family-groups/{group_id}",
    response_model=DistributorClientFamilyGroupDetailResponse,
)
async def get_distributor_client_family_group_route(
    client_reference: str,
    group_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("distributor.clients.read"))],
) -> DistributorClientFamilyGroupDetailResponse:
    payload = await get_distributor_client_family_group(
        db,
        client_reference=client_reference,
        group_id=group_id,
    )
    if payload is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "family_group_not_found", "message": "Family group not found."},
        )
    await db.commit()
    return DistributorClientFamilyGroupDetailResponse(**payload)


@router.get(
    "/clients/{client_reference}/risk-profile/assessments",
    response_model=UserRiskProfileAssessmentListResponse,
)
async def list_distributor_client_risk_assessments_route(
    client_reference: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("distributor.clients.read"))],
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> UserRiskProfileAssessmentListResponse:
    result = await list_distributor_client_risk_assessments(
        db,
        client_reference,
        limit=limit,
        offset=offset,
    )
    if result is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "client_not_found", "message": "Client not found."},
        )
    await db.commit()
    return UserRiskProfileAssessmentListResponse(**result)


@router.get(
    "/clients/{client_reference}/risk-profile/assessments/{assessment_id}",
    response_model=UserRiskProfileAssessmentDetailResponse,
)
async def get_distributor_client_risk_assessment_detail_route(
    client_reference: str,
    assessment_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("distributor.clients.read"))],
) -> UserRiskProfileAssessmentDetailResponse:
    result = await get_distributor_client_risk_assessment_detail(
        db,
        client_reference,
        assessment_id,
    )
    if result is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "assessment_not_found", "message": "Assessment not found."},
        )
    await db.commit()
    return UserRiskProfileAssessmentDetailResponse(**result)


@router.get("/clients/{client_reference}/risk-profile/assessments/{assessment_id}/report/download")
async def download_distributor_client_risk_report_route(
    client_reference: str,
    assessment_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("distributor.clients.read"))],
) -> Response:
    try:
        payload = await download_distributor_client_risk_report(db, client_reference, assessment_id)
    except RiskProfileError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    if payload is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "assessment_not_found", "message": "Assessment not found."},
        )
    pdf_bytes, filename = payload
    await db.commit()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _mitra_txn_recommendation_http_error(exc: MitraTxnRecommendationError) -> HTTPException:
    return HTTPException(
        status_code=exc.status_code,
        detail={"code": exc.code, "message": exc.message},
    )


@router.get("/schemes/search", response_model=DistributorSchemeSearchResponse)
async def search_distributor_schemes_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("distributor.txn_recommendations.create"))],
    q: str = Query(default="", max_length=120),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
) -> DistributorSchemeSearchResponse:
    payload = await search_distributor_schemes(db, query=q, page=page, page_size=page_size)
    await db.commit()
    return DistributorSchemeSearchResponse(**payload)


@router.get("/txn-recommendations", response_model=MitraTxnRecommendationListResponse)
async def list_mitra_txn_recommendations_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[
        User,
        Depends(
            require_any_permission(
                "distributor.txn_recommendations.read",
                "distributor.txn_recommendations.create",
            )
        ),
    ],
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> MitraTxnRecommendationListResponse:
    items = await list_mitra_txn_recommendations_for_actor(
        db,
        actor=actor,
        limit=limit,
        offset=offset,
    )
    await db.commit()
    return MitraTxnRecommendationListResponse(
        items=[MitraTxnRecommendationResponse(**item) for item in items],
    )


@router.get("/txn-recommendations/{token}", response_model=MitraTxnRecommendationResponse)
async def get_mitra_txn_recommendation_route(
    token: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.txn_recommendations.read"))],
) -> MitraTxnRecommendationResponse:
    payload = await get_mitra_txn_recommendation_for_actor(db, actor=actor, token=token)
    if payload is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "Recommendation not found."},
        )
    await db.commit()
    return MitraTxnRecommendationResponse(**payload)


@router.post(
    "/clients/{client_reference}/txn-recommendations",
    response_model=MitraTxnRecommendationResponse,
)
async def create_mitra_txn_recommendation_route(
    client_reference: str,
    body: CreateMitraTxnRecommendationRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_permission("distributor.txn_recommendations.create"))],
) -> MitraTxnRecommendationResponse:
    try:
        payload = await create_mitra_txn_recommendation(
            db,
            actor=actor,
            payload=CreateMitraTxnRecommendationInput(
                client_reference=client_reference,
                investment_type=MitraTxnInvestmentType(body.investment_type),
                payment_method=MitraTxnPaymentMethod(body.payment_method),
                number_of_installments=body.number_of_installments,
                installment_day=body.installment_day,
                sip_frequency=body.sip_frequency,
                items=[
                    CreateMitraTxnRecommendationItemInput(
                        product_id=item.product_id,
                        amount_inr=item.amount_inr,
                        number_of_installments=item.number_of_installments,
                        installment_day=item.installment_day,
                    )
                    for item in body.items
                ],
            ),
        )
    except MitraTxnRecommendationError as exc:
        raise _mitra_txn_recommendation_http_error(exc) from exc
    await db.commit()
    return MitraTxnRecommendationResponse(**payload)


from app.api.v1.distributor.work_router import router as distributor_work_router

router.include_router(distributor_work_router)
