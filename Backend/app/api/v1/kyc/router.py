from __future__ import annotations

from typing import Annotated
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.deps import get_client_ip, get_current_user
from app.api.v1.kyc.schemas import (
    KycBankFailure,
    KycBankManualVerifyResponse,
    KycBankPreverifyStatusResponse,
    KycBankProofUploadResponse,
    KycBankVerifyRequest,
    KycBankVerifyResponse,
    build_kyc_bank_verify_response,
    build_kyc_bank_preverify_status_response,
    KycBootstrapResponse,
    KycCountryItem,
    KycDigilockerStartResponse,
    KycFormSubmitRequest,
    KycFormSubmitResponse,
    KycIdentityDocumentResponse,
    KycJourneyStateRequest,
    KycJourneyStateResponse,
    KycMasterDataEnumsResponse,
    KycMasterDataOption,
    KycNomineeEnumsResponse,
    KycPanConfirmNamesRequest,
    KycPanConfirmNamesResponse,
    KycPanFailure,
    KycPanVerifyRequest,
    KycPanVerifyResponse,
    KycPincodeResponse,
    KycReadinessCheckResponse,
    KycReadinessInfo,
    KycStateItem,
    KycStepStatuses,
)
from app.application.kyc.bank_verification_service import (
    get_bank_preverify_status,
    upload_bank_proof,
    verify_bank_hybrid,
    verify_bank_manual,
)
from app.application.kyc.digilocker_service import load_identity_document, start_digilocker
from app.application.kyc.eligibility import kyc_eligibility_status
from app.application.kyc.errors import KycError
from app.application.kyc.journey_gate_service import (
    require_digilocker_or_kra_skip,
    require_entry_gate,
    require_pan_verified,
    require_phase1_complete,
)
from app.application.kyc.bootstrap_redaction import redact_pan_draft
from app.application.kyc.journey_state_service import (
    find_journey_by_identity_document,
    get_or_create_journey,
    get_or_create_status,
    journey_to_bootstrap_dict,
    resolve_active_step_index,
    save_journey_state,
)
from app.application.kyc.kyc_form_service import (
    continue_kyc_form,
    get_kyc_form_status,
    mark_esign_callback,
    mark_proof_callback,
    submit_kyc_form,
)
from app.application.kyc.master_data import master_data_enums
from app.application.kyc.nominee_master_data import nominee_master_data_enums
from app.application.kyc.pan_verification_service import confirm_pan_names, verify_pan
from app.application.kyc.user_name_sync_service import sync_user_name_from_verified_kyc
from app.application.investor.investor_nominee_sync_service import sync_nominees_from_kyc_draft
from app.application.kyc.readiness_check_service import check_kra_readiness_status
from app.core.config import get_settings
from app.core.database import get_db
from app.infrastructure.kyc.fp_clients import ensure_kyc_tokens, list_countries, list_states, lookup_pincode
from app.infrastructure.persistence.models import KycOverallStatus, User

router = APIRouter(prefix="/kyc", tags=["kyc"])


def _handle_kyc_error(exc: KycError) -> HTTPException:
    return HTTPException(
        status_code=exc.status_code,
        detail={"code": exc.code, "message": exc.message},
    )


@router.post("/token/ensure")
async def post_kyc_token_ensure(
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, bool]:
    try:
        require_entry_gate(current_user)
    except KycError as exc:
        raise _handle_kyc_error(exc) from exc
    await ensure_kyc_tokens()
    return {"ok": True}


@router.get("/journey/bootstrap", response_model=KycBootstrapResponse)
async def get_kyc_journey_bootstrap(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> KycBootstrapResponse:
    eligibility = kyc_eligibility_status(current_user)
    journey = await get_or_create_journey(db, current_user.id) if eligibility["eligible"] else None
    status = await get_or_create_status(db, current_user.id) if eligibility["eligible"] else None
    if (
        journey
        and status
        and status.overall_status == KycOverallStatus.completed
        and not (current_user.first_name or "").strip()
    ):
        await sync_user_name_from_verified_kyc(db, user=current_user, journey=journey)
        await db.flush()
    payload = journey_to_bootstrap_dict(journey, status)
    step_statuses = payload.get("stepStatuses")
    return KycBootstrapResponse(
        eligible=eligibility["eligible"],
        reasons=eligibility["reasons"],
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
    )


@router.post("/pan/verify", response_model=KycPanVerifyResponse)
async def post_kyc_pan_verify(
    body: KycPanVerifyRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> KycPanVerifyResponse:
    require_entry_gate(current_user)
    try:
        result = await verify_pan(db, user=current_user, pan_number=body.pan_number)
    except KycError as exc:
        raise _handle_kyc_error(exc) from exc
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
        pan_draft=redact_pan_draft(result.get("panDraft")),
        kyc_already_registered=result.get("kycAlreadyRegistered"),
        readiness=KycReadinessInfo(**result["readiness"]) if result.get("readiness") else None,
        requires_digilocker=result.get("requiresDigilocker"),
    )


@router.post("/pan/confirm-names", response_model=KycPanConfirmNamesResponse)
async def post_kyc_pan_confirm_names(
    body: KycPanConfirmNamesRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> KycPanConfirmNamesResponse:
    require_entry_gate(current_user)
    try:
        result = await confirm_pan_names(
            db,
            user=current_user,
            first_name=body.first_name,
            middle_name=body.middle_name,
            last_name=body.last_name,
        )
    except KycError as exc:
        raise _handle_kyc_error(exc) from exc
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
        pan_draft=redact_pan_draft(result.get("panDraft")),
    )


@router.post("/kyc-request/start", response_model=KycDigilockerStartResponse)
async def post_kyc_digilocker_start(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> KycDigilockerStartResponse:
    require_entry_gate(current_user)
    try:
        result = await start_digilocker(db, user=current_user)
    except KycError as exc:
        raise _handle_kyc_error(exc) from exc
    await db.commit()
    return KycDigilockerStartResponse(redirect_url=result["redirectUrl"])


@router.get("/identity-document/{document_id}", response_model=KycIdentityDocumentResponse)
async def get_kyc_identity_document(
    document_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> KycIdentityDocumentResponse:
    require_entry_gate(current_user)
    try:
        result = await load_identity_document(db, user=current_user, document_id=document_id)
    except KycError as exc:
        raise _handle_kyc_error(exc) from exc
    await db.commit()
    return KycIdentityDocumentResponse(
        success=result["success"],
        fetch_status=result.get("fetchStatus"),
        reason=result.get("reason"),
        aadhaar_not_selected=bool(result.get("aadhaarNotSelected")),
        contact_draft=result.get("contactDraft"),
        personal_draft=result.get("personalDraft"),
        aadhaar_last4=result.get("aadhaarLast4"),
    )


@router.api_route("/public/digilocker-callback", methods=["GET", "POST"])
async def kyc_public_digilocker_callback(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    identity_document: str | None = Query(default=None),
    status: str | None = Query(default=None),
) -> RedirectResponse:
    settings = get_settings()
    doc_id = identity_document or request.query_params.get("identity_document")
    fetch_status = status or request.query_params.get("status") or "failed"
    if not doc_id:
        params = urlencode({"kyc_digilocker_return": "1", "digilocker_error": "missing_document"})
        return RedirectResponse(url=f"{settings.frontend_url.rstrip('/')}/dashboard?{params}")

    journey = await find_journey_by_identity_document(db, doc_id)
    if journey:
        if fetch_status == "successful":
            journey.external_kyc_status = "returned_success"
        else:
            journey.external_kyc_status = "returned_failed"
            journey.digilocker_failure_reason = "DigiLocker was not completed successfully."
        await db.commit()

    params = urlencode(
        {
            "kyc_digilocker_return": "1",
            "identity_document": doc_id,
            "status": fetch_status,
        }
    )
    return RedirectResponse(url=f"{settings.frontend_url.rstrip('/')}/dashboard?{params}")


@router.post("/journey/state", response_model=KycJourneyStateResponse)
async def post_kyc_journey_state(
    body: KycJourneyStateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> KycJourneyStateResponse:
    require_entry_gate(current_user)
    journey = await get_or_create_journey(db, current_user.id)
    require_pan_verified(journey)

    payload: dict[str, object] = {}
    if body.pan_draft_json is not None:
        payload["panDraftJson"] = body.pan_draft_json
    elif body.middle_name is not None and journey.pan_draft_json:
        pan_draft = dict(journey.pan_draft_json)
        pan_draft["middleName"] = body.middle_name.strip()
        payload["panDraftJson"] = pan_draft
    if body.contact_draft_json is not None:
        require_digilocker_or_kra_skip(journey)
        payload["contactDraftJson"] = body.contact_draft_json
    if body.personal_draft_json is not None:
        require_digilocker_or_kra_skip(journey)
        payload["personalDraftJson"] = body.personal_draft_json
    if body.nominee_draft_json is not None:
        require_phase1_complete(journey)
        payload["nomineeDraftJson"] = body.nominee_draft_json
    if body.bank_draft_json is not None:
        require_phase1_complete(journey)
        payload["bankDraftJson"] = body.bank_draft_json
    if body.signature_draft_json is not None:
        from app.application.kyc.journey_gate_service import require_phase2_complete

        require_phase2_complete(journey)
        payload["signatureDraftJson"] = body.signature_draft_json
    if body.geolocation_json is not None:
        from app.application.kyc.journey_gate_service import require_phase2_complete

        require_phase2_complete(journey)
        payload["geolocationJson"] = body.geolocation_json.model_dump(by_alias=True)
    if body.last_completed_step is not None:
        payload["lastCompletedStep"] = body.last_completed_step

    journey, _ = await save_journey_state(db, user=current_user, payload=payload)
    if body.nominee_draft_json is not None:
        await sync_nominees_from_kyc_draft(db, user=current_user, journey=journey)
    await db.commit()
    return KycJourneyStateResponse(
        last_completed_step=journey.last_completed_step,
        active_step_index=resolve_active_step_index(journey),
    )


@router.get("/master-data/enums", response_model=KycMasterDataEnumsResponse)
async def get_kyc_master_data_enums(
    current_user: Annotated[User, Depends(get_current_user)],
) -> KycMasterDataEnumsResponse:
    require_entry_gate(current_user)
    enums = master_data_enums()
    return KycMasterDataEnumsResponse(
        gender=[KycMasterDataOption(**item) for item in enums["gender"]],
        marital_status=[KycMasterDataOption(**item) for item in enums["maritalStatus"]],
        occupation=[KycMasterDataOption(**item) for item in enums["occupation"]],
        income_slab=[KycMasterDataOption(**item) for item in enums["incomeSlab"]],
        pep_exposed=[KycMasterDataOption(**item) for item in enums["pepExposed"]],
    )


@router.get("/master-data/pincode/{pincode}", response_model=KycPincodeResponse)
async def get_kyc_pincode(
    pincode: str,
    current_user: Annotated[User, Depends(get_current_user)],
) -> KycPincodeResponse:
    require_entry_gate(current_user)
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


@router.get("/master-data/states", response_model=list[KycStateItem])
async def get_kyc_states(
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[KycStateItem]:
    require_entry_gate(current_user)
    items = await list_states()
    return [KycStateItem(**item) for item in items]


@router.get("/master-data/countries", response_model=list[KycCountryItem])
async def get_kyc_countries(
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[KycCountryItem]:
    require_entry_gate(current_user)
    items = await list_countries()
    return [KycCountryItem(name=item["name"], ansi_code=item["ansi_code"]) for item in items]


@router.get("/master-data/nominee-enums", response_model=KycNomineeEnumsResponse)
async def get_kyc_nominee_enums(
    current_user: Annotated[User, Depends(get_current_user)],
) -> KycNomineeEnumsResponse:
    require_entry_gate(current_user)
    enums = nominee_master_data_enums()
    return KycNomineeEnumsResponse(
        relationships=[KycMasterDataOption(**item) for item in enums["relationships"]],
        source_of_wealth=[KycMasterDataOption(**item) for item in enums["sourceOfWealth"]],
        document_types=[KycMasterDataOption(**item) for item in enums["documentTypes"]],
    )


@router.post("/bank/verify-hybrid", response_model=KycBankVerifyResponse)
async def post_kyc_bank_verify_hybrid(
    body: KycBankVerifyRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> KycBankVerifyResponse:
    require_entry_gate(current_user)
    try:
        result = await verify_bank_hybrid(
            db,
            user=current_user,
            account_number=body.account_number,
            account_type=body.account_type,
            ifsc_code=body.ifsc_code,
        )
    except KycError as exc:
        raise _handle_kyc_error(exc) from exc
    await db.commit()
    return build_kyc_bank_verify_response(result)


@router.post("/bank/upload-proof", response_model=KycBankProofUploadResponse)
async def post_kyc_bank_upload_proof(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
) -> KycBankProofUploadResponse:
    require_entry_gate(current_user)
    content = await file.read()
    try:
        result = await upload_bank_proof(
            db,
            user=current_user,
            file_bytes=content,
            filename=file.filename or "bank-proof.pdf",
            content_type=file.content_type or "application/octet-stream",
        )
    except KycError as exc:
        raise _handle_kyc_error(exc) from exc
    await db.commit()
    return KycBankProofUploadResponse(file_id=result["fileId"])


@router.post("/bank/verify-manual", response_model=KycBankManualVerifyResponse)
async def post_kyc_bank_verify_manual(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> KycBankManualVerifyResponse:
    require_entry_gate(current_user)
    try:
        result = await verify_bank_manual(db, user=current_user)
    except KycError as exc:
        raise _handle_kyc_error(exc) from exc
    await db.commit()
    return KycBankManualVerifyResponse(
        success=bool(result.get("success")),
        bank_verified=bool(result.get("bankVerified")),
        requires_manual_verification=bool(result.get("requiresManualVerification")),
        requires_proof_upload=bool(result.get("requiresProofUpload")),
        failure=KycBankFailure(**result["failure"]) if result.get("failure") else None,
    )


@router.get("/bank/preverify/{preverify_id}", response_model=KycBankPreverifyStatusResponse)
async def get_kyc_bank_preverify_status(
    preverify_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> KycBankPreverifyStatusResponse:
    require_entry_gate(current_user)
    try:
        result = await get_bank_preverify_status(db, user_id=current_user.id, preverify_id=preverify_id)
    except KycError as exc:
        raise _handle_kyc_error(exc) from exc
    return build_kyc_bank_preverify_status_response(result)


def _form_response(result: dict[str, object]) -> KycFormSubmitResponse:
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


@router.post("/form/submit", response_model=KycFormSubmitResponse)
async def post_kyc_form_submit(
    body: KycFormSubmitRequest,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> KycFormSubmitResponse:
    require_entry_gate(current_user)
    try:
        result = await submit_kyc_form(
            db,
            user=current_user,
            latitude=body.latitude,
            longitude=body.longitude,
            accuracy_meters=body.accuracy_meters,
            client_ip=get_client_ip(request),
        )
    except KycError as exc:
        raise _handle_kyc_error(exc) from exc
    await db.commit()
    return _form_response(result)


@router.post("/form/continue", response_model=KycFormSubmitResponse)
async def post_kyc_form_continue(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> KycFormSubmitResponse:
    require_entry_gate(current_user)
    try:
        result = await continue_kyc_form(db, user=current_user)
    except KycError as exc:
        raise _handle_kyc_error(exc) from exc
    await db.commit()
    return _form_response(result)


@router.get("/form/status", response_model=KycFormSubmitResponse)
async def get_kyc_form_status_route(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> KycFormSubmitResponse:
    require_entry_gate(current_user)
    result = await get_kyc_form_status(db, user=current_user)
    await db.commit()
    return _form_response(result)


@router.post("/readiness/check", response_model=KycReadinessCheckResponse)
async def post_kyc_readiness_check(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> KycReadinessCheckResponse:
    require_entry_gate(current_user)
    try:
        result = await check_kra_readiness_status(db, user=current_user)
    except KycError as exc:
        raise _handle_kyc_error(exc) from exc
    await db.commit()
    return KycReadinessCheckResponse(
        kra_verified=bool(result.get("kraVerified")),
        overall_status=str(result.get("overallStatus") or "submitted"),
        readiness=KycReadinessInfo(**result["readiness"]),
        message=str(result.get("message") or ""),
    )


@router.api_route("/public/proof-callback", methods=["GET", "POST"])
async def kyc_public_proof_callback(
    db: Annotated[AsyncSession, Depends(get_db)],
    kyc_form_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
) -> RedirectResponse:
    settings = get_settings()
    form_id = kyc_form_id or ""
    fetch_status = status or "failed"
    if form_id:
        await mark_proof_callback(db, form_id=form_id, callback_status=fetch_status)
        await db.commit()

    params = urlencode({"kyc_proof_return": "1", "kyc_form_id": form_id, "status": fetch_status})
    return RedirectResponse(url=f"{settings.frontend_url.rstrip('/')}/dashboard?{params}")


@router.api_route("/public/esign-callback", methods=["GET", "POST"])
async def kyc_public_esign_callback(
    db: Annotated[AsyncSession, Depends(get_db)],
    kyc_form_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
) -> RedirectResponse:
    settings = get_settings()
    form_id = kyc_form_id or ""
    fetch_status = status or "failed"
    if form_id:
        await mark_esign_callback(db, form_id=form_id, callback_status=fetch_status)
        await db.commit()

    params = urlencode({"kyc_esign_return": "1", "kyc_form_id": form_id, "status": fetch_status})
    return RedirectResponse(url=f"{settings.frontend_url.rstrip('/')}/dashboard?{params}")
