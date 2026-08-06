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
from app.api.v1.auth.deps import get_client_ip, require_permission
from app.api.v1.distributor.schemas import (
    DistributorClientDetailResponse,
    DistributorClientFamilyGroupDetailResponse,
    DistributorClientListResponse,
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
from app.application.distributor.distributor_console_service import get_distributor_console_context
from app.application.distributor.distributor_client_service import (
    download_distributor_client_risk_report,
    get_distributor_client_detail,
    get_distributor_client_family_group,
    get_distributor_client_risk_assessment_detail,
    list_distributor_client_risk_assessments,
    list_distributor_clients,
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
from app.infrastructure.persistence.models import User

router = APIRouter(prefix="/distributor", tags=["distributor"])


def _partner_onboarding_http_error(exc: PartnerOnboardingError) -> HTTPException:
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
) -> OtpSendResponse:
    try:
        result = await send_partner_onboarding_mobile_otp(
            db,
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
    manager: Annotated[User, Depends(require_permission("distributor.partners.manage"))],
) -> PartnerOnboardingProfilePhotoResponse:
    content = await file.read()
    try:
        result = await upload_partner_onboarding_profile_photo(
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
    manager: Annotated[User, Depends(require_permission("distributor.partners.manage"))],
) -> PartnerOnboardingDocumentResponse:
    content = await file.read()
    try:
        result = await upload_partner_onboarding_document(
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
    manager: Annotated[User, Depends(require_permission("distributor.partners.manage"))],
) -> OkResponse:
    try:
        await clear_partner_onboarding_document(
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
    manager: Annotated[User, Depends(require_permission("distributor.partners.manage"))],
) -> OkResponse:
    try:
        await clear_partner_onboarding_profile_photo(
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


@router.get("/clients", response_model=DistributorClientListResponse)
async def list_distributor_clients_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("distributor.clients.list"))],
    email: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> DistributorClientListResponse:
    items = await list_distributor_clients(db, email=email, limit=limit, offset=offset)
    await db.commit()
    return DistributorClientListResponse(items=items)


@router.get("/clients/{client_reference}", response_model=DistributorClientDetailResponse)
async def get_distributor_client_detail_route(
    client_reference: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("distributor.clients.read"))],
) -> DistributorClientDetailResponse:
    payload = await get_distributor_client_detail(db, client_reference)
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
