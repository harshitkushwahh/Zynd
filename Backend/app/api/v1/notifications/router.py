from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.deps import get_current_user
from app.application.notifications.notification_stream_service import iter_user_notification_stream
from app.application.notifications.notification_service import (
    count_unread,
    get_notification,
    get_preferences,
    list_notifications,
    mark_all_read,
    mark_notification_read,
    update_preference,
)
from app.infrastructure.notifications.notification_realtime_publisher import publish_unread_count_updated
from app.application.notifications.push_device_service import (
    list_user_push_devices,
    register_push_device,
    revoke_push_device,
)
from app.core.database import get_db
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.notification_models import NotificationCategory, PushPlatform

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationItemResponse(BaseModel):
    id: UUID
    category: NotificationCategory
    notification_type: str
    title: str
    body: str
    metadata: dict | None = None
    read_at: datetime | None = None
    created_at: datetime


class NotificationListResponse(BaseModel):
    items: list[NotificationItemResponse]
    total: int
    unread_count: int


class UnreadCountResponse(BaseModel):
    unread_count: int


class NotificationPreferenceResponse(BaseModel):
    category: NotificationCategory
    email_enabled: bool
    in_app_enabled: bool
    email_locked: bool = False


class NotificationPreferencesResponse(BaseModel):
    preferences: list[NotificationPreferenceResponse]


class UpdateNotificationPreferenceRequest(BaseModel):
    category: NotificationCategory
    email_enabled: bool | None = None
    in_app_enabled: bool | None = None


class RegisterPushDeviceRequest(BaseModel):
    platform: PushPlatform
    fcm_token: str
    device_label: str | None = None
    app_version: str | None = None


class PushDeviceResponse(BaseModel):
    id: UUID
    platform: PushPlatform
    device_label: str | None = None
    app_version: str | None = None
    last_seen_at: datetime | None = None
    revoked_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class PushDeviceListResponse(BaseModel):
    items: list[PushDeviceResponse]


def _to_push_device_response(device) -> PushDeviceResponse:
    return PushDeviceResponse(
        id=device.id,
        platform=device.platform,
        device_label=device.device_label,
        app_version=device.app_version,
        last_seen_at=device.last_seen_at,
        revoked_at=device.revoked_at,
        created_at=device.created_at,
        updated_at=device.updated_at,
    )


@router.get("/stream")
async def stream_notifications(
    current_user: Annotated[User, Depends(get_current_user)],
) -> StreamingResponse:
    return StreamingResponse(
        iter_user_notification_stream(current_user.id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("", response_model=NotificationListResponse)
async def get_notifications(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    unread_only: bool = False,
) -> NotificationListResponse:
    items, total = await list_notifications(
        db,
        user_id=current_user.id,
        limit=limit,
        offset=offset,
        unread_only=unread_only,
    )
    unread = await count_unread(db, current_user.id)
    await db.commit()
    return NotificationListResponse(
        items=[
            NotificationItemResponse(
                id=item.id,
                category=item.category,
                notification_type=item.notification_type,
                title=item.title,
                body=item.body,
                metadata=item.metadata_json,
                read_at=item.read_at,
                created_at=item.created_at,
            )
            for item in items
        ],
        total=total,
        unread_count=unread,
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UnreadCountResponse:
    unread = await count_unread(db, current_user.id)
    await db.commit()
    return UnreadCountResponse(unread_count=unread)


@router.get("/devices", response_model=PushDeviceListResponse)
async def get_push_devices(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PushDeviceListResponse:
    devices = await list_user_push_devices(db, current_user.id)
    await db.commit()
    return PushDeviceListResponse(items=[_to_push_device_response(device) for device in devices])


@router.post("/devices", response_model=PushDeviceResponse)
async def post_push_device(
    body: RegisterPushDeviceRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PushDeviceResponse:
    token = body.fcm_token.strip()
    if not token:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_token", "message": "FCM token is required"},
        )

    device = await register_push_device(
        db,
        user_id=current_user.id,
        platform=body.platform,
        fcm_token=token,
        device_label=body.device_label,
        app_version=body.app_version,
    )
    await db.commit()
    return _to_push_device_response(device)


@router.delete("/devices/{device_id}")
async def delete_push_device(
    device_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, bool]:
    revoked = await revoke_push_device(db, user_id=current_user.id, device_id=device_id)
    if not revoked:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "Push device not found"},
        )
    await db.commit()
    return {"revoked": True}


@router.get("/preferences", response_model=NotificationPreferencesResponse)
async def get_notification_preferences(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> NotificationPreferencesResponse:
    prefs = await get_preferences(db, current_user.id)
    await db.commit()
    return NotificationPreferencesResponse(
        preferences=[
            NotificationPreferenceResponse(
                category=p.category,
                email_enabled=p.email_enabled,
                in_app_enabled=p.in_app_enabled,
                email_locked=p.category == NotificationCategory.security,
            )
            for p in sorted(prefs, key=lambda row: row.category.value)
        ]
    )


@router.put("/preferences", response_model=NotificationPreferenceResponse)
async def put_notification_preference(
    body: UpdateNotificationPreferenceRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> NotificationPreferenceResponse:
    pref = await update_preference(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        category=body.category,
        email_enabled=body.email_enabled,
        in_app_enabled=body.in_app_enabled,
    )
    await db.commit()
    return NotificationPreferenceResponse(
        category=pref.category,
        email_enabled=pref.email_enabled,
        in_app_enabled=pref.in_app_enabled,
        email_locked=pref.category == NotificationCategory.security,
    )


def _to_notification_item_response(row) -> NotificationItemResponse:
    return NotificationItemResponse(
        id=row.id,
        category=row.category,
        notification_type=row.notification_type,
        title=row.title,
        body=row.body,
        metadata=row.metadata_json,
        read_at=row.read_at,
        created_at=row.created_at,
    )


@router.post("/read-all")
async def read_all(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, int]:
    updated = await mark_all_read(db, user_id=current_user.id)
    await db.commit()
    await publish_unread_count_updated(user_id=current_user.id, unread_count=0)
    return {"updated": updated}


@router.get("/{notification_id}", response_model=NotificationItemResponse)
async def get_notification_by_id(
    notification_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> NotificationItemResponse:
    row = await get_notification(
        db,
        user_id=current_user.id,
        notification_id=notification_id,
    )
    if not row:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "Notification not found"},
        )
    await db.commit()
    return _to_notification_item_response(row)


@router.patch("/{notification_id}/read", response_model=NotificationItemResponse)
async def mark_read(
    notification_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> NotificationItemResponse:
    row = await mark_notification_read(db, user_id=current_user.id, notification_id=notification_id)
    if not row:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Notification not found"})
    unread = await count_unread(db, current_user.id)
    await db.commit()
    await publish_unread_count_updated(user_id=current_user.id, unread_count=unread)
    return _to_notification_item_response(row)
