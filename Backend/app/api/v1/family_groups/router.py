from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.deps import get_client_ip, get_current_user
from app.api.v1.family_groups.schemas import (
    CreateFamilyGroupInviteRequest,
    CreateFamilyGroupRequest,
    FamilyGroupBadgePresetListResponse,
    FamilyGroupBadgePresetResponse,
    FamilyGroupActivityListResponse,
    FamilyGroupActivityResponse,
    FamilyGroupDetailResponse,
    FamilyGroupInviteActionRequest,
    FamilyGroupInviteListResponse,
    FamilyGroupInvitePreviewResponse,
    FamilyGroupInviteResponse,
    FamilyGroupListResponse,
    FamilyGroupMemberPreviewResponse,
    FamilyGroupResponse,
    PendingFamilyGroupInviteListResponse,
    PendingFamilyGroupInviteResponse,
    TransferFamilyGroupHeadRequest,
    UpdateFamilyGroupMemberRequest,
    UpdateFamilyGroupRequest,
    LeaveFamilyGroupResponse,
    NomineeFamilyGroupAddRequest,
    NomineeFamilyGroupAddResponse,
    NomineeFamilyGroupPreviewRequest,
    NomineeFamilyGroupPreviewResponse,
)
from app.application.family_groups.constants import MAX_FAMILY_GROUPS_PER_USER
from app.application.family_groups.errors import FamilyGroupError
from app.application.family_groups.group_service import (
    archive_family_group,
    count_active_groups_created_by_user,
    create_family_group,
    get_family_group_for_user,
    list_family_groups_for_user,
    list_group_members_preview,
    update_family_group,
    upload_family_group_avatar,
)
from app.application.family_groups.membership_service import (
    leave_family_group,
    remove_group_member,
    transfer_group_head,
    update_group_member,
)
from app.application.family_groups.activity_service import list_family_group_activity
from app.application.family_groups.nominee_bridge_service import (
    add_nominee_to_family_group,
    preview_nominee_family_group_add,
)
from app.application.family_groups.invite_service import (
    accept_family_group_invite,
    accept_family_group_invite_by_id,
    create_family_group_invite,
    decline_family_group_invite,
    decline_family_group_invite_by_id,
    list_badge_presets,
    list_group_invites,
    list_pending_invites_for_user,
    preview_family_group_invite,
    resend_family_group_invite,
    revoke_family_group_invite,
)
from app.core.database import get_db
from app.infrastructure.persistence.family_group_models import FamilyGroupMemberRole
from app.infrastructure.persistence.models import User

router = APIRouter(prefix="/family-groups", tags=["family-groups"])


def _handle_family_group_error(exc: FamilyGroupError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": {"code": exc.code, "message": exc.message}},
    )


def _to_group_response(payload: dict[str, object]) -> FamilyGroupResponse:
    return FamilyGroupResponse.model_validate(payload)


@router.get("/me", response_model=FamilyGroupListResponse)
async def list_my_family_groups(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> FamilyGroupListResponse:
    items = await list_family_groups_for_user(db, user_id=current_user.id)
    active_count = await count_active_groups_created_by_user(db, current_user.id)
    return FamilyGroupListResponse(
        items=[_to_group_response(item) for item in items],
        limit=MAX_FAMILY_GROUPS_PER_USER,
        active_count=active_count,
    )


@router.get("/badges", response_model=FamilyGroupBadgePresetListResponse)
async def get_family_group_badges() -> FamilyGroupBadgePresetListResponse:
    return FamilyGroupBadgePresetListResponse(
        items=[FamilyGroupBadgePresetResponse.model_validate(item) for item in list_badge_presets()]
    )


@router.get("/invites/pending", response_model=PendingFamilyGroupInviteListResponse)
async def list_pending_family_invites(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PendingFamilyGroupInviteListResponse:
    items = await list_pending_invites_for_user(db, user_id=current_user.id)
    return PendingFamilyGroupInviteListResponse(
        items=[PendingFamilyGroupInviteResponse.model_validate(item) for item in items]
    )


@router.get("/invites/preview", response_model=FamilyGroupInvitePreviewResponse)
async def preview_family_invite(
    db: Annotated[AsyncSession, Depends(get_db)],
    token: Annotated[str, Query(min_length=8, max_length=256)],
) -> FamilyGroupInvitePreviewResponse:
    try:
        payload = await preview_family_group_invite(db, token=token)
    except FamilyGroupError as exc:
        return _handle_family_group_error(exc)
    return FamilyGroupInvitePreviewResponse.model_validate(payload)


@router.post("/invites/accept", response_model=FamilyGroupResponse)
async def accept_family_invite(
    body: FamilyGroupInviteActionRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> FamilyGroupResponse:
    try:
        payload = await accept_family_group_invite(
            db,
            token=body.token,
            user=current_user,
            ip=get_client_ip(request),
        )
    except FamilyGroupError as exc:
        return _handle_family_group_error(exc)
    return _to_group_response(payload)


@router.post("/invites/decline")
async def decline_family_invite(
    body: FamilyGroupInviteActionRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, bool]:
    try:
        return await decline_family_group_invite(
            db,
            token=body.token,
            user=current_user,
            ip=get_client_ip(request),
        )
    except FamilyGroupError as exc:
        return _handle_family_group_error(exc)


@router.post("/invites/{invite_id}/accept", response_model=FamilyGroupResponse)
async def accept_family_invite_by_id(
    invite_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> FamilyGroupResponse:
    try:
        payload = await accept_family_group_invite_by_id(
            db,
            invite_id=invite_id,
            user=current_user,
            ip=get_client_ip(request),
        )
    except FamilyGroupError as exc:
        return _handle_family_group_error(exc)
    return _to_group_response(payload)


@router.post("/invites/{invite_id}/decline")
async def decline_family_invite_by_id(
    invite_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, bool]:
    try:
        return await decline_family_group_invite_by_id(
            db,
            invite_id=invite_id,
            user=current_user,
            ip=get_client_ip(request),
        )
    except FamilyGroupError as exc:
        return _handle_family_group_error(exc)


@router.post("", response_model=FamilyGroupResponse, status_code=201)
async def post_family_group(
    request: Request,
    body: CreateFamilyGroupRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> FamilyGroupResponse:
    try:
        payload = await create_family_group(
            db,
            user=current_user,
            title=body.title,
            description=body.description,
            tag=body.tag,
            ip=get_client_ip(request),
        )
    except FamilyGroupError as exc:
        return _handle_family_group_error(exc)
    return _to_group_response(payload)


@router.get("/{group_id}", response_model=FamilyGroupDetailResponse)
async def get_family_group(
    group_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> FamilyGroupDetailResponse:
    try:
        payload = await get_family_group_for_user(db, group_id=group_id, user_id=current_user.id)
        members = await list_group_members_preview(db, group_id=group_id, user_id=current_user.id)
        invites: list[dict[str, object]] = []
        if payload.get("my_role") == FamilyGroupMemberRole.head.value:
            invites = await list_group_invites(db, group_id=group_id, user_id=current_user.id)
    except FamilyGroupError as exc:
        return _handle_family_group_error(exc)

    return FamilyGroupDetailResponse(
        **_to_group_response(payload).model_dump(),
        members=[FamilyGroupMemberPreviewResponse.model_validate(member) for member in members],
        invites=[FamilyGroupInviteResponse.model_validate(invite) for invite in invites],
    )


@router.get("/{group_id}/activity", response_model=FamilyGroupActivityListResponse)
async def get_family_group_activity(
    group_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    cursor: Annotated[UUID | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> FamilyGroupActivityListResponse:
    try:
        payload = await list_family_group_activity(
            db,
            group_id=group_id,
            user_id=current_user.id,
            cursor=cursor,
            limit=limit,
        )
    except FamilyGroupError as exc:
        return _handle_family_group_error(exc)
    return FamilyGroupActivityListResponse(
        items=[FamilyGroupActivityResponse.model_validate(item) for item in payload["items"]],
        next_cursor=payload["next_cursor"],
        has_more=payload["has_more"],
    )


@router.patch("/{group_id}", response_model=FamilyGroupResponse)
async def patch_family_group(
    group_id: UUID,
    body: UpdateFamilyGroupRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> FamilyGroupResponse:
    if body.title is None and body.description is None and body.tag is None:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_request", "message": "No fields to update."},
        )

    try:
        payload = await update_family_group(
            db,
            group_id=group_id,
            user=current_user,
            title=body.title,
            description=body.description,
            tag=body.tag,
            ip=get_client_ip(request),
        )
    except FamilyGroupError as exc:
        return _handle_family_group_error(exc)
    return _to_group_response(payload)


@router.post("/{group_id}/avatar", response_model=FamilyGroupResponse)
async def post_family_group_avatar(
    group_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    file: Annotated[UploadFile, File()],
) -> FamilyGroupResponse:
    content = await file.read()
    try:
        payload = await upload_family_group_avatar(
            db,
            group_id=group_id,
            user=current_user,
            filename=file.filename or "avatar.jpg",
            mime_type=file.content_type or "application/octet-stream",
            content=content,
            ip=get_client_ip(request),
        )
    except FamilyGroupError as exc:
        return _handle_family_group_error(exc)
    return _to_group_response(payload)


@router.delete("/{group_id}", response_model=FamilyGroupResponse)
async def delete_family_group(
    group_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> FamilyGroupResponse:
    try:
        payload = await archive_family_group(
            db,
            group_id=group_id,
            user=current_user,
            ip=get_client_ip(request),
        )
    except FamilyGroupError as exc:
        return _handle_family_group_error(exc)
    return _to_group_response(payload)


@router.post("/{group_id}/invites", response_model=FamilyGroupInviteResponse, status_code=201)
async def post_family_group_invite(
    group_id: UUID,
    body: CreateFamilyGroupInviteRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> FamilyGroupInviteResponse:
    try:
        payload = await create_family_group_invite(
            db,
            group_id=group_id,
            inviter=current_user,
            invitee_email=body.invitee_email,
            intended_role=FamilyGroupMemberRole(body.intended_role),
            intended_badge_key=body.intended_badge_key,
            intended_badge_label=body.intended_badge_label,
            ip=get_client_ip(request),
        )
    except FamilyGroupError as exc:
        return _handle_family_group_error(exc)
    return FamilyGroupInviteResponse.model_validate(payload)


@router.get("/{group_id}/invites", response_model=FamilyGroupInviteListResponse)
async def get_family_group_invites(
    group_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> FamilyGroupInviteListResponse:
    try:
        items = await list_group_invites(db, group_id=group_id, user_id=current_user.id)
    except FamilyGroupError as exc:
        return _handle_family_group_error(exc)
    return FamilyGroupInviteListResponse(
        items=[FamilyGroupInviteResponse.model_validate(item) for item in items]
    )


@router.post("/{group_id}/invites/{invite_id}/revoke", response_model=FamilyGroupInviteResponse)
async def revoke_family_group_invite_route(
    group_id: UUID,
    invite_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> FamilyGroupInviteResponse:
    try:
        payload = await revoke_family_group_invite(
            db,
            group_id=group_id,
            invite_id=invite_id,
            user=current_user,
            ip=get_client_ip(request),
        )
    except FamilyGroupError as exc:
        return _handle_family_group_error(exc)
    return FamilyGroupInviteResponse.model_validate(payload)


@router.post("/{group_id}/invites/{invite_id}/resend", response_model=FamilyGroupInviteResponse)
async def resend_family_group_invite_route(
    group_id: UUID,
    invite_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> FamilyGroupInviteResponse:
    try:
        payload = await resend_family_group_invite(
            db,
            group_id=group_id,
            invite_id=invite_id,
            user=current_user,
            ip=get_client_ip(request),
        )
    except FamilyGroupError as exc:
        return _handle_family_group_error(exc)
    return FamilyGroupInviteResponse.model_validate(payload)


@router.post("/nominee-add/preview", response_model=NomineeFamilyGroupPreviewResponse)
async def post_nominee_family_group_preview(
    body: NomineeFamilyGroupPreviewRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> NomineeFamilyGroupPreviewResponse:
    payload = await preview_nominee_family_group_add(
        db,
        user=current_user,
        nominee_email=body.nominee_email,
        nominee_name=body.nominee_name,
        relationship=body.relationship,
        kyc_nominee_id=body.kyc_nominee_id,
        group_id=body.group_id,
    )
    groups = [_to_group_response(group) for group in payload.get("groups", [])]
    return NomineeFamilyGroupPreviewResponse(
        status=str(payload["status"]),
        message=str(payload["message"]),
        groups=groups,
        group_id=payload.get("group_id"),
        suggested_badge_key=payload.get("suggested_badge_key"),
        suggested_badge_label=payload.get("suggested_badge_label"),
        invitee_email_masked=payload.get("invitee_email_masked"),
        existing_status=payload.get("existing_status"),
    )


@router.post("/nominee-add", response_model=NomineeFamilyGroupAddResponse)
async def post_nominee_family_group_add(
    body: NomineeFamilyGroupAddRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> NomineeFamilyGroupAddResponse:
    try:
        payload = await add_nominee_to_family_group(
            db,
            user=current_user,
            nominee_email=body.nominee_email,
            nominee_name=body.nominee_name,
            relationship=body.relationship,
            kyc_nominee_id=body.kyc_nominee_id,
            group_id=body.group_id,
            create_group_title=body.create_group_title,
            action=body.action,
            ip=get_client_ip(request),
        )
    except FamilyGroupError as exc:
        return _handle_family_group_error(exc)

    group = payload.get("group")
    invite = payload.get("invite")
    return NomineeFamilyGroupAddResponse(
        ok=bool(payload.get("ok")),
        action=str(payload.get("action")),
        group=_to_group_response(group) if isinstance(group, dict) else None,
        invite=FamilyGroupInviteResponse.model_validate(invite) if invite else None,
    )


@router.patch("/{group_id}/members/{user_id}", response_model=FamilyGroupMemberPreviewResponse)
async def patch_family_group_member(
    group_id: UUID,
    user_id: UUID,
    body: UpdateFamilyGroupMemberRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> FamilyGroupMemberPreviewResponse:
    nickname_provided = body.display_nickname is not None or body.clear_nickname
    if body.role is None and not body.clear_badge and body.badge_key is None and not nickname_provided:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_request", "message": "No fields to update."},
        )

    try:
        payload = await update_group_member(
            db,
            group_id=group_id,
            actor=current_user,
            target_user_id=user_id,
            role=FamilyGroupMemberRole(body.role) if body.role else None,
            badge_key=body.badge_key,
            badge_label=body.badge_label,
            clear_badge=body.clear_badge,
            display_nickname=body.display_nickname,
            clear_nickname=body.clear_nickname,
            nickname_provided=nickname_provided,
            ip=get_client_ip(request),
        )
    except FamilyGroupError as exc:
        return _handle_family_group_error(exc)
    return FamilyGroupMemberPreviewResponse.model_validate(payload)


@router.delete("/{group_id}/members/{user_id}")
async def delete_family_group_member(
    group_id: UUID,
    user_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, bool]:
    try:
        return await remove_group_member(
            db,
            group_id=group_id,
            actor=current_user,
            target_user_id=user_id,
            ip=get_client_ip(request),
        )
    except FamilyGroupError as exc:
        return _handle_family_group_error(exc)


@router.post("/{group_id}/leave", response_model=LeaveFamilyGroupResponse)
async def post_family_group_leave(
    group_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> LeaveFamilyGroupResponse:
    try:
        payload = await leave_family_group(
            db,
            group_id=group_id,
            user=current_user,
            ip=get_client_ip(request),
        )
    except FamilyGroupError as exc:
        return _handle_family_group_error(exc)
    return LeaveFamilyGroupResponse.model_validate(payload)


@router.post("/{group_id}/transfer-head", response_model=FamilyGroupResponse)
async def post_family_group_transfer_head(
    group_id: UUID,
    body: TransferFamilyGroupHeadRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> FamilyGroupResponse:
    try:
        payload = await transfer_group_head(
            db,
            group_id=group_id,
            actor=current_user,
            new_head_user_id=body.new_head_user_id,
            ip=get_client_ip(request),
        )
    except FamilyGroupError as exc:
        return _handle_family_group_error(exc)
    return _to_group_response(payload)
