from __future__ import annotations

from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.admin.risk_profile_schemas import (
    CreateRiskCategoryRequest,
    CreateRiskQuestionRequest,
    CreateRiskTemplateRequest,
    RiskBulkPreviewResponse,
    RiskBulkSubmitRequest,
    RiskBulkSubmitResponse,
    RiskCategoryListResponse,
    RiskCategoryResponse,
    RiskQuestionListResponse,
    RiskQuestionResponse,
    RiskScorePreviewRequest,
    RiskScorePreviewResponse,
    RiskTemplateAutoSelectRequest,
    RiskTemplateAutoSelectResponse,
    RiskTemplateListResponse,
    RiskTemplateQuestionsResponse,
    RiskTemplateResponse,
    RiskTierListResponse,
    RiskTierResponse,
    UpdateRiskCategoryRequest,
    UpdateRiskQuestionRequest,
    UpdateRiskTemplateRequest,
    UpdateRiskTierRequest,
    RiskProfileUnlockConfirmRequest,
    RiskProfileUnlockResponse,
    RiskProfileUnlockJourneyResponse,
    RiskProfileUnlockJourneyStepResponse,
    LockedRiskProfileListResponse,
    LockedRiskProfileUserResponse,
    UserRiskProfileListResponse,
    UserRiskProfileItemResponse,
    UserRiskProfileDetailResponse,
    UserRiskProfileAssessmentListResponse,
    UserRiskProfileAssessmentItemResponse,
    UserRiskProfileAssessmentDetailResponse,
    RiskAuditLogListResponse,
    RiskAuditLogItemResponse,
)
from app.api.v1.auth.deps import get_client_ip, require_permission
from app.application.risk_profile.attempt_service import list_locked_users
from app.application.risk_profile.audit_service import list_risk_profile_audit_logs
from app.application.risk_profile.unlock_service import confirm_unlock_otp, request_unlock_otp
from app.application.risk_profile.unlock_journey_service import get_unlock_journey
from app.application.risk_profile.bulk_import_service import preview_bulk_questions, submit_bulk_questions
from app.application.risk_profile.category_service import (
    create_category,
    get_category,
    list_categories,
    update_category,
)
from app.application.risk_profile.errors import RiskProfileError
from app.application.risk_profile.question_service import (
    create_question,
    delete_question,
    get_question,
    list_questions,
    update_question,
)
from app.application.risk_profile.scoring_service import (
    get_assessment_admin_detail,
    get_user_risk_profile,
    list_user_assessments,
    list_user_risk_profiles,
    preview_score,
)
from app.application.risk_profile.report_service import get_or_create_report_pdf
from app.application.risk_profile.template_service import (
    auto_select_template,
    create_template,
    get_template,
    list_templates,
    resolve_template_questions,
    update_template,
)
from app.application.risk_profile.tier_service import get_tier, list_tiers, update_tier
from app.core.database import get_db
from app.infrastructure.persistence.models import AuditEventType, User
from app.infrastructure.persistence.risk_profile_models import RiskProfileAssessment, RiskTemplateSelectionMode, RiskTier

router = APIRouter(prefix="/risk-profile", tags=["admin-risk-profile"])


def _handle_risk_profile_error(exc: RiskProfileError) -> HTTPException:
    return HTTPException(
        status_code=exc.status_code,
        detail={"code": exc.code, "message": exc.message},
    )


@router.get("/categories", response_model=RiskCategoryListResponse)
async def get_risk_categories(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("risk_profile.read"))],
    include_inactive: bool = Query(default=False),
) -> RiskCategoryListResponse:
    categories = await list_categories(db, include_inactive=include_inactive)
    return RiskCategoryListResponse(categories=[RiskCategoryResponse(**item) for item in categories])


@router.post("/categories", response_model=RiskCategoryResponse)
async def post_risk_category(
    body: CreateRiskCategoryRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("risk_profile.categories.manage"))],
) -> RiskCategoryResponse:
    try:
        result = await create_category(
            db,
            name=body.name,
            description=body.description,
            weight=body.weight,
            sort_order=body.sort_order,
            admin=admin,
            ip=get_client_ip(request),
        )
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc
    await db.commit()
    return RiskCategoryResponse(**result)


@router.get("/categories/{category_id}", response_model=RiskCategoryResponse)
async def get_risk_category(
    category_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("risk_profile.read"))],
) -> RiskCategoryResponse:
    try:
        result = await get_category(db, category_id)
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc
    return RiskCategoryResponse(**result)


@router.patch("/categories/{category_id}", response_model=RiskCategoryResponse)
async def patch_risk_category(
    category_id: UUID,
    body: UpdateRiskCategoryRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("risk_profile.categories.manage"))],
) -> RiskCategoryResponse:
    try:
        result = await update_category(
            db,
            category_id=category_id,
            name=body.name,
            description=body.description,
            weight=body.weight,
            sort_order=body.sort_order,
            is_active=body.is_active,
            admin=admin,
            ip=get_client_ip(request),
        )
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc
    await db.commit()
    return RiskCategoryResponse(**result)


@router.get("/questions", response_model=RiskQuestionListResponse)
async def get_risk_questions(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("risk_profile.read"))],
    category_id: Optional[UUID] = Query(default=None),
    include_inactive: bool = Query(default=False),
) -> RiskQuestionListResponse:
    questions = await list_questions(db, category_id=category_id, include_inactive=include_inactive)
    return RiskQuestionListResponse(questions=[RiskQuestionResponse(**item) for item in questions])


@router.post("/questions", response_model=RiskQuestionResponse)
async def post_risk_question(
    body: CreateRiskQuestionRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("risk_profile.questions.manage"))],
) -> RiskQuestionResponse:
    try:
        result = await create_question(
            db,
            category_id=body.category_id,
            prompt=body.prompt,
            help_text=body.help_text,
            sort_order=body.sort_order,
            options=[option.model_dump() for option in body.options],
            admin=admin,
            ip=get_client_ip(request),
        )
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc
    await db.commit()
    return RiskQuestionResponse(**result)


@router.get("/questions/{question_id}", response_model=RiskQuestionResponse)
async def get_risk_question(
    question_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("risk_profile.read"))],
) -> RiskQuestionResponse:
    try:
        result = await get_question(db, question_id)
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc
    return RiskQuestionResponse(**result)


@router.patch("/questions/{question_id}", response_model=RiskQuestionResponse)
async def patch_risk_question(
    question_id: UUID,
    body: UpdateRiskQuestionRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("risk_profile.questions.manage"))],
) -> RiskQuestionResponse:
    try:
        result = await update_question(
            db,
            question_id=question_id,
            category_id=body.category_id,
            prompt=body.prompt,
            help_text=body.help_text,
            sort_order=body.sort_order,
            is_active=body.is_active,
            options=[option.model_dump() for option in body.options] if body.options is not None else None,
            admin=admin,
            ip=get_client_ip(request),
        )
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc
    await db.commit()
    return RiskQuestionResponse(**result)


@router.delete("/questions/{question_id}", response_model=RiskQuestionResponse)
async def delete_risk_question(
    question_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("risk_profile.questions.manage"))],
) -> RiskQuestionResponse:
    try:
        result = await delete_question(
            db,
            question_id=question_id,
            admin=admin,
            ip=get_client_ip(request),
        )
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc
    await db.commit()
    return RiskQuestionResponse(**result)


@router.get("/tiers", response_model=RiskTierListResponse)
async def get_risk_tiers(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("risk_profile.read"))],
) -> RiskTierListResponse:
    tiers = await list_tiers(db)
    return RiskTierListResponse(tiers=[RiskTierResponse(**item) for item in tiers])


@router.get("/tiers/{tier}", response_model=RiskTierResponse)
async def get_risk_tier(
    tier: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("risk_profile.read"))],
) -> RiskTierResponse:
    try:
        result = await get_tier(db, RiskTier(tier))
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_tier", "message": "Invalid risk tier."},
        ) from exc
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc
    return RiskTierResponse(**result)


@router.patch("/tiers/{tier}", response_model=RiskTierResponse)
async def patch_risk_tier(
    tier: str,
    body: UpdateRiskTierRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("risk_profile.tiers.manage"))],
) -> RiskTierResponse:
    try:
        result = await update_tier(
            db,
            tier=RiskTier(tier),
            min_score=body.min_score,
            max_score=body.max_score,
            title=body.title,
            message_body=body.message_body,
            sort_order=body.sort_order,
            admin=admin,
            ip=get_client_ip(request),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_tier", "message": "Invalid risk tier."},
        ) from exc
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc
    await db.commit()
    return RiskTierResponse(**result)


@router.post("/score/preview", response_model=RiskScorePreviewResponse)
async def post_risk_score_preview(
    body: RiskScorePreviewRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("risk_profile.read"))],
) -> RiskScorePreviewResponse:
    try:
        result = await preview_score(
            db,
            answers=[answer.model_dump() for answer in body.answers],
        )
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc
    return RiskScorePreviewResponse(**result)


@router.get("/users", response_model=UserRiskProfileListResponse)
async def get_user_risk_profiles(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("risk_profile.users.read"))],
    tier: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> UserRiskProfileListResponse:
    result = await list_user_risk_profiles(db, tier=tier, limit=limit, offset=offset)
    return UserRiskProfileListResponse(
        items=[UserRiskProfileItemResponse(**item) for item in result["items"]],
        limit=result["limit"],
        offset=result["offset"],
    )


@router.post("/questions/bulk/preview", response_model=RiskBulkPreviewResponse)
async def post_risk_questions_bulk_preview(
    body: RiskBulkSubmitRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("risk_profile.read"))],
) -> RiskBulkPreviewResponse:
    try:
        result = await preview_bulk_questions(db, csv_text=body.csv)
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc
    return RiskBulkPreviewResponse(**result)


@router.post("/questions/bulk/submit", response_model=RiskBulkSubmitResponse)
async def post_risk_questions_bulk_submit(
    body: RiskBulkSubmitRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("risk_profile.questions.manage"))],
) -> RiskBulkSubmitResponse:
    try:
        result = await submit_bulk_questions(
            db,
            csv_text=body.csv,
            create_missing_categories=False,
            default_category_weight=float(body.default_category_weight),
            admin=admin,
            ip=get_client_ip(request),
        )
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc
    await db.commit()
    return RiskBulkSubmitResponse(**result)


@router.get("/templates", response_model=RiskTemplateListResponse)
async def get_risk_templates(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("risk_profile.read"))],
    include_inactive: bool = Query(default=False),
) -> RiskTemplateListResponse:
    templates = await list_templates(db, include_inactive=include_inactive)
    return RiskTemplateListResponse(templates=[RiskTemplateResponse(**item) for item in templates])


@router.post("/templates", response_model=RiskTemplateResponse)
async def post_risk_template(
    body: CreateRiskTemplateRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("risk_profile.templates.manage"))],
) -> RiskTemplateResponse:
    try:
        result = await create_template(
            db,
            name=body.name,
            description=body.description,
            is_default=body.is_default,
            selection_mode=RiskTemplateSelectionMode(body.selection_mode),
            sort_order=body.sort_order,
            rules=[rule.model_dump() for rule in body.rules],
            admin=admin,
            ip=get_client_ip(request),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_selection_mode", "message": "Invalid template selection mode."},
        ) from exc
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc
    await db.commit()
    return RiskTemplateResponse(**result)


@router.get("/templates/{template_id}", response_model=RiskTemplateResponse)
async def get_risk_template(
    template_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("risk_profile.read"))],
) -> RiskTemplateResponse:
    try:
        result = await get_template(db, template_id)
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc
    return RiskTemplateResponse(**result)


@router.patch("/templates/{template_id}", response_model=RiskTemplateResponse)
async def patch_risk_template(
    template_id: UUID,
    body: UpdateRiskTemplateRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("risk_profile.templates.manage"))],
) -> RiskTemplateResponse:
    selection_mode = None
    if body.selection_mode is not None:
        try:
            selection_mode = RiskTemplateSelectionMode(body.selection_mode)
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail={"code": "invalid_selection_mode", "message": "Invalid template selection mode."},
            ) from exc
    try:
        result = await update_template(
            db,
            template_id=template_id,
            name=body.name,
            description=body.description,
            is_default=body.is_default,
            is_active=body.is_active,
            selection_mode=selection_mode,
            sort_order=body.sort_order,
            rules=[rule.model_dump() for rule in body.rules] if body.rules is not None else None,
            admin=admin,
            ip=get_client_ip(request),
        )
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc
    await db.commit()
    return RiskTemplateResponse(**result)


@router.get("/templates/{template_id}/questions", response_model=RiskTemplateQuestionsResponse)
async def get_risk_template_questions(
    template_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("risk_profile.read"))],
) -> RiskTemplateQuestionsResponse:
    try:
        result = await resolve_template_questions(db, template_id=template_id)
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc
    return RiskTemplateQuestionsResponse(
        template=RiskTemplateResponse(**result["template"]),
        questions=[RiskQuestionResponse(**item) for item in result["questions"]],
        total_questions=result["total_questions"],
    )


@router.post("/templates/auto-select", response_model=RiskTemplateAutoSelectResponse)
async def post_risk_template_auto_select(
    body: RiskTemplateAutoSelectRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("risk_profile.read"))],
) -> RiskTemplateAutoSelectResponse:
    try:
        result = await auto_select_template(
            db,
            user_id=body.user_id,
            target_question_count=body.target_question_count,
        )
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc
    return RiskTemplateAutoSelectResponse(
        selection_reason=result["selection_reason"],
        preferred_question_count=result["preferred_question_count"],
        template=RiskTemplateResponse(**result["template"]),
        questions=[RiskQuestionResponse(**item) for item in result["questions"]],
        total_questions=result["total_questions"],
    )


@router.get("/users/{user_id}", response_model=UserRiskProfileDetailResponse)
async def get_user_risk_profile_detail(
    user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("risk_profile.users.read"))],
) -> UserRiskProfileDetailResponse:
    from app.application.admin.user_admin_service import _display_name
    from app.application.documents.profile_image_url_service import resolve_profile_image_urls_by_user_id

    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail={"code": "user_not_found", "message": "User not found."})
    result = await get_user_risk_profile(db, user_id)
    if not result:
        raise HTTPException(
            status_code=404,
            detail={"code": "risk_profile_not_found", "message": "Risk profile not found for this user."},
        )
    assessment_count_result = await db.execute(
        select(func.count())
        .select_from(RiskProfileAssessment)
        .where(RiskProfileAssessment.user_id == user_id)
    )
    profile_images = await resolve_profile_image_urls_by_user_id(db, [user_id])
    return UserRiskProfileDetailResponse(
        user_id=result["user_id"],
        client_id=target.client_id,
        email=target.email,
        display_name=_display_name(target),
        profile_image_url=profile_images.get(user_id),
        assessment_count=int(assessment_count_result.scalar_one()),
        score=result["score"],
        tier=result["tier"],
        assessment_id=result["assessment_id"],
        computed_at=result["computed_at"],
        updated_at=result["updated_at"],
        tier_config=RiskTierResponse(**result["tier_config"]),
    )


@router.get("/users/{user_id}/assessments", response_model=UserRiskProfileAssessmentListResponse)
async def get_user_risk_profile_assessments(
    user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("risk_profile.users.read"))],
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> UserRiskProfileAssessmentListResponse:
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail={"code": "user_not_found", "message": "User not found."})
    result = await list_user_assessments(db, user_id=user_id, limit=limit, offset=offset)
    return UserRiskProfileAssessmentListResponse(
        items=[UserRiskProfileAssessmentItemResponse(**item) for item in result["items"]],
        limit=result["limit"],
        offset=result["offset"],
    )


@router.get("/users/{user_id}/assessments/{assessment_id}", response_model=UserRiskProfileAssessmentDetailResponse)
async def get_user_risk_profile_assessment_detail(
    user_id: UUID,
    assessment_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("risk_profile.users.read"))],
) -> UserRiskProfileAssessmentDetailResponse:
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail={"code": "user_not_found", "message": "User not found."})
    try:
        result = await get_assessment_admin_detail(db, user_id=user_id, assessment_id=assessment_id)
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc
    return UserRiskProfileAssessmentDetailResponse(**result)


@router.get("/users/{user_id}/assessments/{assessment_id}/report/download")
async def download_user_risk_profile_assessment_report(
    user_id: UUID,
    assessment_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("risk_profile.users.read"))],
) -> Response:
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail={"code": "user_not_found", "message": "User not found."})
    try:
        pdf_bytes, filename, from_cache = await get_or_create_report_pdf(
            db,
            user=target,
            assessment_id=assessment_id,
        )
        await db.commit()
    except RiskProfileError as exc:
        await db.rollback()
        raise _handle_risk_profile_error(exc) from exc
    except FileNotFoundError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail={"code": "report_asset_missing", "message": "Report branding assets are unavailable."},
        ) from exc
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail={"code": "report_generation_failed", "message": "Could not generate the risk profile report."},
        ) from exc

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Report-Cached": "true" if from_cache else "false",
        },
    )


@router.get("/locked-users", response_model=LockedRiskProfileListResponse)
async def get_locked_risk_profile_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("risk_profile.users.manage"))],
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> LockedRiskProfileListResponse:
    result = await list_locked_users(db, limit=limit, offset=offset)
    return LockedRiskProfileListResponse(
        items=[LockedRiskProfileUserResponse(**item) for item in result["items"]],
        limit=result["limit"],
        offset=result["offset"],
    )


@router.get("/users/{user_id}/unlock-journey", response_model=RiskProfileUnlockJourneyResponse)
async def get_risk_profile_unlock_journey(
    user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("risk_profile.users.read"))],
) -> RiskProfileUnlockJourneyResponse:
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail={"code": "user_not_found", "message": "User not found."})
    result = await get_unlock_journey(db, user_id)
    return RiskProfileUnlockJourneyResponse(
        user_id=result["user_id"],
        attempt_state=result["attempt_state"],
        steps=[RiskProfileUnlockJourneyStepResponse(**step) for step in result["steps"]],
    )


@router.post("/users/{user_id}/unlock/request")
async def post_risk_profile_unlock_request(
    user_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("risk_profile.users.manage"))],
) -> dict[str, int]:
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail={"code": "user_not_found", "message": "User not found."})
    try:
        meta = await request_unlock_otp(
            db,
            target_user=target,
            admin=admin,
            ip=get_client_ip(request),
        )
    except RiskProfileError as exc:
        raise _handle_risk_profile_error(exc) from exc
    await db.commit()
    return meta


@router.post("/users/{user_id}/unlock/confirm", response_model=RiskProfileUnlockResponse)
async def post_risk_profile_unlock_confirm(
    user_id: UUID,
    body: RiskProfileUnlockConfirmRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("risk_profile.users.manage"))],
) -> RiskProfileUnlockResponse:
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail={"code": "user_not_found", "message": "User not found."})
    try:
        result = await confirm_unlock_otp(
            db,
            target_user=target,
            admin=admin,
            code=body.otp_code,
            ip=get_client_ip(request),
        )
    except RiskProfileError as exc:
        if exc.code == "invalid_unlock_otp":
            await db.commit()
        raise _handle_risk_profile_error(exc) from exc
    await db.commit()
    return RiskProfileUnlockResponse(**result)


@router.get("/audit", response_model=RiskAuditLogListResponse)
async def get_risk_profile_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("risk_profile.read"))],
    user_id: Optional[UUID] = Query(default=None),
    event_type: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> RiskAuditLogListResponse:
    parsed_event_type: AuditEventType | None = None
    if event_type:
        try:
            parsed_event_type = AuditEventType(event_type)
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail={"code": "invalid_event_type", "message": "Invalid audit event type."},
            ) from exc
    items = await list_risk_profile_audit_logs(
        db,
        user_id=user_id,
        event_type=parsed_event_type,
        limit=limit,
        offset=offset,
    )
    return RiskAuditLogListResponse(
        items=[
            RiskAuditLogItemResponse(
                id=str(item["id"]),
                user_id=str(item["user_id"]) if item.get("user_id") else None,
                event_type=item["event_type"],
                ip_address=item.get("ip_address"),
                metadata=item.get("metadata") or {},
                created_at=item["created_at"].isoformat() if item.get("created_at") else "",
            )
            for item in items
        ],
        limit=limit,
        offset=offset,
    )
