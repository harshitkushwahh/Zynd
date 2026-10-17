from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.deps import get_current_user, require_permission
from app.api.v1.distributor.schemas import DistributorClientDetailResponse
from app.api.v1.support.schemas import (
    AgentMessageRequest,
    ConversationOut,
    HelpBotStatusOut,
    PostMessageRequest,
    ResolutionChoiceRequest,
    CustomerTicketListOut,
    SupportConsoleUserListOut,
    SupportKycQueueListOut,
    SupportKycRegistrySnapshotOut,
    SupportTransactionListOut,
    TicketDetailOut,
    TicketListOut,
    UpdateTicketRequest,
)
from app.application.support.ollama_client import check_ollama_ready
from app.application.support.help_bot_service import (
    begin_new_customer_conversation,
    get_current_conversation,
    post_customer_message,
)
from app.application.support.ticket_attachments import read_message_attachment
from app.api.v1.admin.risk_profile_schemas import (
    UserRiskProfileAssessmentDetailResponse,
    UserRiskProfileAssessmentListResponse,
)
from app.application.distributor.distributor_client_service import (
    download_distributor_client_risk_report,
    get_distributor_client_risk_assessment_detail,
    get_support_console_user_detail,
    list_distributor_client_risk_assessments,
    list_support_console_users_page,
)
from app.application.support.ticket_service import (
    SupportActionError,
    add_agent_reply,
    console_ticket_detail,
    customer_ticket_thread,
    list_console_tickets,
    list_customer_tickets_page,
    respond_to_resolution,
    update_console_ticket,
)
from app.core.database import get_db
from app.infrastructure.persistence.models import User

from app.api.v1.support.ws_router import router as support_ws_router

router = APIRouter(prefix="/support", tags=["support"])
router.include_router(support_ws_router)


def _raise_support_error(exc: SupportActionError) -> None:
    raise HTTPException(
        status_code=exc.status_code,
        detail={"code": exc.code, "message": exc.message},
    ) from exc


@router.get("/conversations/current", response_model=ConversationOut)
async def get_support_conversation(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ConversationOut:
    return ConversationOut.model_validate(await get_current_conversation(db, current_user))


@router.post("/conversations/new", response_model=ConversationOut)
async def new_support_conversation(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ConversationOut:
    return ConversationOut.model_validate(
        await begin_new_customer_conversation(db, current_user),
    )


@router.get("/help-bot/status", response_model=HelpBotStatusOut)
async def get_help_bot_status(
    _current_user: Annotated[User, Depends(get_current_user)],
) -> HelpBotStatusOut:
    ready, model = await check_ollama_ready()
    return HelpBotStatusOut(
        ollama="connected" if ready else "unavailable",
        model=model,
    )


def _attachment_response(content: bytes, mime_type: str, filename: str) -> Response:
    safe_name = filename.replace('"', "").replace("\n", "") or "image"
    return Response(
        content=content,
        media_type=mime_type,
        headers={"Content-Disposition": f'inline; filename="{safe_name}"'},
    )


@router.post("/conversations/messages", response_model=ConversationOut)
async def post_support_message(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ConversationOut:
    upload: tuple[str, bytes] | None = None
    content_type = request.headers.get("content-type", "")
    try:
        if "multipart/form-data" in content_type:
            form = await request.form()
            text = str(form.get("body") or "")
            file = form.get("file")
            if file is not None and hasattr(file, "read"):
                payload = await file.read()
                filename = getattr(file, "filename", None) or "image"
                if payload:
                    upload = (str(filename), payload)
        else:
            raw = await request.body()
            body = PostMessageRequest.model_validate_json(raw or b"{}")
            text = body.body
    except SupportActionError as exc:
        _raise_support_error(exc)
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_message", "message": "Could not read that message."},
        ) from exc
    try:
        payload = await post_customer_message(db, current_user, body=text, upload=upload)
    except SupportActionError as exc:
        _raise_support_error(exc)
    return ConversationOut.model_validate(payload)


@router.get("/messages/{message_id}/attachment")
async def get_my_message_attachment(
    message_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Response:
    try:
        content, mime_type, filename = await read_message_attachment(
            db,
            message_id=message_id,
            actor=current_user,
            as_agent=False,
        )
    except SupportActionError as exc:
        _raise_support_error(exc)
    return _attachment_response(content, mime_type, filename)


@router.get("/tickets/{ticket_id}", response_model=ConversationOut)
async def get_my_support_ticket(
    ticket_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ConversationOut:
    try:
        payload = await customer_ticket_thread(db, current_user, ticket_id)
    except SupportActionError as exc:
        _raise_support_error(exc)
    return ConversationOut.model_validate(payload)


@router.post("/tickets/{ticket_id}/resolution", response_model=ConversationOut)
async def post_ticket_resolution(
    ticket_id: str,
    body: ResolutionChoiceRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ConversationOut:
    try:
        payload = await respond_to_resolution(db, current_user, ticket_id, body.choice)
    except SupportActionError as exc:
        _raise_support_error(exc)
    return ConversationOut.model_validate(payload)


@router.get("/tickets", response_model=CustomerTicketListOut)
async def get_my_support_tickets(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> CustomerTicketListOut:
    payload = await list_customer_tickets_page(db, current_user, offset=offset, limit=limit)
    return CustomerTicketListOut.model_validate(payload)


@router.get("/console/messages/{message_id}/attachment")
async def get_console_message_attachment(
    message_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    agent: Annotated[User, Depends(require_permission("support.tickets.read"))],
) -> Response:
    try:
        content, mime_type, filename = await read_message_attachment(
            db,
            message_id=message_id,
            actor=agent,
            as_agent=True,
        )
    except SupportActionError as exc:
        _raise_support_error(exc)
    return _attachment_response(content, mime_type, filename)


@router.get("/console/users", response_model=SupportConsoleUserListOut)
async def get_support_console_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    agent: Annotated[User, Depends(require_permission("support.tickets.read"))],
    email: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> SupportConsoleUserListOut:
    payload = await list_support_console_users_page(
        db,
        actor=agent,
        email=email,
        limit=limit,
        offset=offset,
    )
    await db.commit()
    return SupportConsoleUserListOut(**payload)


@router.get("/console/kyc-verifications", response_model=SupportKycQueueListOut)
async def get_support_console_kyc_verifications(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("support.tickets.read"))],
    search: Annotated[str | None, Query()] = None,
    queue_status: Annotated[str | None, Query()] = None,
    review_type: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> SupportKycQueueListOut:
    from app.application.support.support_console_directory_service import (
        list_support_kyc_verifications_page,
    )

    payload = await list_support_kyc_verifications_page(
        db,
        search=search,
        queue_status=queue_status,
        review_type=review_type,
        limit=limit,
        offset=offset,
    )
    await db.commit()
    return SupportKycQueueListOut(**payload)


@router.get("/console/transactions", response_model=SupportTransactionListOut)
async def get_support_console_transactions(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("support.tickets.read"))],
    search: Annotated[str | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
    order_type: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> SupportTransactionListOut:
    from app.application.support.support_console_directory_service import list_support_transactions_page

    payload = await list_support_transactions_page(
        db,
        search=search,
        status=status,
        order_type=order_type,
        limit=limit,
        offset=offset,
    )
    await db.commit()
    return SupportTransactionListOut(**payload)


@router.get(
    "/console/users/{client_reference}/risk-profile/assessments",
    response_model=UserRiskProfileAssessmentListResponse,
)
async def get_support_console_user_risk_assessments(
    client_reference: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("support.tickets.read"))],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
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
            detail={"code": "client_not_found", "message": "User not found."},
        )
    await db.commit()
    return UserRiskProfileAssessmentListResponse(**result)


@router.get(
    "/console/users/{client_reference}/risk-profile/assessments/{assessment_id}",
    response_model=UserRiskProfileAssessmentDetailResponse,
)
async def get_support_console_user_risk_assessment_detail(
    client_reference: str,
    assessment_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("support.tickets.read"))],
) -> UserRiskProfileAssessmentDetailResponse:
    result = await get_distributor_client_risk_assessment_detail(
        db,
        client_reference,
        assessment_id,
    )
    if result is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "client_not_found", "message": "Assessment not found."},
        )
    await db.commit()
    return UserRiskProfileAssessmentDetailResponse(**result)


@router.get("/console/users/{client_reference}/risk-profile/assessments/{assessment_id}/report/download")
async def download_support_console_user_risk_report(
    client_reference: str,
    assessment_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("support.tickets.read"))],
) -> Response:
    payload = await download_distributor_client_risk_report(db, client_reference, assessment_id)
    if payload is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "client_not_found", "message": "Report not found."},
        )
    pdf_bytes, filename = payload
    await db.commit()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/console/users/{client_reference}/kyc-registry",
    response_model=SupportKycRegistrySnapshotOut,
)
async def get_support_console_user_kyc_registry(
    client_reference: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("support.tickets.read"))],
) -> SupportKycRegistrySnapshotOut:
    from app.application.support.support_kyc_registry_service import get_support_kyc_registry_for_reference

    payload = await get_support_kyc_registry_for_reference(db, client_reference)
    if payload is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "client_not_found", "message": "User not found."},
        )
    await db.commit()
    return SupportKycRegistrySnapshotOut(**payload)


@router.get("/console/users/{client_reference}", response_model=DistributorClientDetailResponse)
async def get_support_console_user(
    client_reference: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("support.tickets.read"))],
) -> DistributorClientDetailResponse:
    payload = await get_support_console_user_detail(db, client_reference)
    if payload is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "client_not_found", "message": "User not found."},
        )
    await db.commit()
    return DistributorClientDetailResponse(**payload)


@router.get("/console/tickets", response_model=TicketListOut)
async def get_console_tickets(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("support.tickets.read"))],
    queue: Annotated[Literal["escalated", "bot", "all"], Query()] = "escalated",
    client_id: Annotated[str | None, Query()] = None,
) -> TicketListOut:
    items = await list_console_tickets(db, queue=queue, client_id=client_id)
    return TicketListOut.model_validate({"items": items})


@router.get("/console/tickets/{ticket_id}", response_model=TicketDetailOut)
async def get_console_ticket(
    ticket_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("support.tickets.read"))],
) -> TicketDetailOut:
    try:
        payload = await console_ticket_detail(db, ticket_id)
    except SupportActionError as exc:
        _raise_support_error(exc)
    return TicketDetailOut.model_validate(payload)


@router.post("/console/tickets/{ticket_id}/messages", response_model=TicketDetailOut)
async def post_console_ticket_message(
    ticket_id: str,
    body: AgentMessageRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    agent: Annotated[User, Depends(require_permission("support.tickets.manage"))],
) -> TicketDetailOut:
    try:
        payload = await add_agent_reply(
            db,
            ticket_id,
            agent,
            body=body.body,
            internal=body.visibility == "internal",
            resolution_prompt=body.resolution_prompt,
        )
    except SupportActionError as exc:
        _raise_support_error(exc)
    return TicketDetailOut.model_validate(payload)


@router.patch("/console/tickets/{ticket_id}", response_model=TicketDetailOut)
async def patch_console_ticket(
    ticket_id: str,
    body: UpdateTicketRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    agent: Annotated[User, Depends(require_permission("support.tickets.manage"))],
) -> TicketDetailOut:
    try:
        payload = await update_console_ticket(
            db,
            ticket_id,
            agent,
            status=body.status,
            assign_to_self=body.assign_to_self,
        )
    except SupportActionError as exc:
        _raise_support_error(exc)
    return TicketDetailOut.model_validate(payload)
