from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.user_admin_service import suspend_user, unsuspend_user
from app.application.compliance.deletion_executor_service import run_deletion_executor
from app.application.security.key_rotation_service import rotate_mfa_secrets_to_current_version
from app.application.security.security_config_service import apply_security_config_update
from app.infrastructure.persistence.models import (
    AdminActionRequest,
    AdminActionStatus,
    AdminActionType,
    AuditEventType,
    AuditLog,
    User,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


HIGH_IMPACT_ACTIONS = {
    AdminActionType.account_suspend,
    AdminActionType.account_unsuspend,
    AdminActionType.encryption_rotate_mfa,
    AdminActionType.deletion_executor_run,
    AdminActionType.security_config_update,
}


async def create_admin_action_request(
    db: AsyncSession,
    *,
    action_type: AdminActionType,
    requester: User,
    payload: dict[str, Any],
    target_type: str | None = None,
    target_id: UUID | None = None,
    reason: str | None = None,
    ip: str | None = None,
) -> dict[str, Any]:
    request = AdminActionRequest(
        action_type=action_type,
        status=AdminActionStatus.pending,
        target_type=target_type,
        target_id=target_id,
        payload=payload,
        reason=reason,
        requested_by=requester.id,
    )
    db.add(request)
    db.add(
        AuditLog(
            user_id=requester.id,
            event_type=AuditEventType.admin_action_requested,
            ip_address=ip,
            metadata_={
                "action_type": action_type.value,
                "target_type": target_type,
                "target_id": str(target_id) if target_id else None,
            },
        )
    )
    await db.flush()
    return await _serialize_request(db, request)


async def list_admin_action_requests(
    db: AsyncSession,
    *,
    status: AdminActionStatus | None = AdminActionStatus.pending,
) -> list[dict[str, Any]]:
    query = select(AdminActionRequest).order_by(AdminActionRequest.created_at.desc())
    if status:
        query = query.where(AdminActionRequest.status == status)
    result = await db.execute(query)
    return [await _serialize_request(db, item) for item in result.scalars()]


async def approve_admin_action_request(
    db: AsyncSession,
    *,
    action_id: UUID,
    approver: User,
    ip: str | None = None,
) -> dict[str, Any]:
    result = await db.execute(select(AdminActionRequest).where(AdminActionRequest.id == action_id))
    request = result.scalar_one_or_none()
    if not request:
        raise ValueError("Action request not found.")
    if request.status != AdminActionStatus.pending:
        raise ValueError("Action request is no longer pending.")
    if request.requested_by == approver.id:
        raise ValueError("Maker-checker violation: approver cannot be the requester.")

    outcome = await _execute_action(db, request=request, approver=approver, ip=ip)
    request.status = AdminActionStatus.approved
    request.approved_by = approver.id
    request.resolved_at = _now()
    db.add(
        AuditLog(
            user_id=approver.id,
            event_type=AuditEventType.admin_action_approved,
            ip_address=ip,
            metadata_={
                "action_id": str(request.id),
                "action_type": request.action_type.value,
                "requested_by": str(request.requested_by),
            },
        )
    )
    await db.flush()
    serialized = await _serialize_request(db, request)
    serialized["outcome"] = outcome
    return serialized


async def reject_admin_action_request(
    db: AsyncSession,
    *,
    action_id: UUID,
    approver: User,
    notes: str | None = None,
    ip: str | None = None,
) -> dict[str, Any]:
    result = await db.execute(select(AdminActionRequest).where(AdminActionRequest.id == action_id))
    request = result.scalar_one_or_none()
    if not request:
        raise ValueError("Action request not found.")
    if request.status != AdminActionStatus.pending:
        raise ValueError("Action request is no longer pending.")
    if request.requested_by == approver.id:
        raise ValueError("Maker-checker violation: approver cannot be the requester.")

    request.status = AdminActionStatus.rejected
    request.approved_by = approver.id
    request.rejection_notes = notes
    request.resolved_at = _now()
    db.add(
        AuditLog(
            user_id=approver.id,
            event_type=AuditEventType.admin_action_rejected,
            ip_address=ip,
            metadata_={
                "action_id": str(request.id),
                "action_type": request.action_type.value,
                "notes": notes,
            },
        )
    )
    await db.flush()
    return await _serialize_request(db, request)


async def _execute_action(
    db: AsyncSession,
    *,
    request: AdminActionRequest,
    approver: User,
    ip: str | None,
) -> dict[str, Any]:
    payload = request.payload or {}
    if request.action_type == AdminActionType.account_suspend:
        if not request.target_id:
            raise ValueError("Missing target user for suspension.")
        user = await _load_user(db, request.target_id)
        return await suspend_user(
            db,
            user=user,
            admin=approver,
            reason_code=payload["reason_code"],
            ip=ip,
            notes=payload.get("notes"),
        )
    if request.action_type == AdminActionType.account_unsuspend:
        if not request.target_id:
            raise ValueError("Missing target user for unsuspension.")
        user = await _load_user(db, request.target_id)
        return await unsuspend_user(
            db,
            user=user,
            admin=approver,
            ip=ip,
            notes=payload.get("notes"),
        )
    if request.action_type == AdminActionType.encryption_rotate_mfa:
        return await rotate_mfa_secrets_to_current_version(db)
    if request.action_type == AdminActionType.deletion_executor_run:
        return await run_deletion_executor(db, ip=ip)
    if request.action_type == AdminActionType.security_config_update:
        key = payload.get("key")
        if not key:
            raise ValueError("Missing security config key.")
        if "value" not in payload:
            raise ValueError("Missing security config value.")
        return await apply_security_config_update(
            db,
            key=str(key),
            value=payload["value"],
            changed_by=request.requested_by,
            approved_by=approver.id,
            reason=request.reason,
        )
    raise ValueError(f"Unsupported action type: {request.action_type.value}")


async def _load_user(db: AsyncSession, user_id: UUID) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError("Target user not found.")
    return user


async def _serialize_request(db: AsyncSession, request: AdminActionRequest) -> dict[str, Any]:
    requester = await db.get(User, request.requested_by)
    approver = await db.get(User, request.approved_by) if request.approved_by else None
    target_email = None
    if request.target_id:
        target = await db.get(User, request.target_id)
        target_email = target.email if target else None
    return {
        "id": request.id,
        "action_type": request.action_type.value,
        "status": request.status.value,
        "target_type": request.target_type,
        "target_id": request.target_id,
        "target_email": target_email,
        "payload": request.payload,
        "reason": request.reason,
        "requested_by": request.requested_by,
        "requested_by_email": requester.email if requester else None,
        "approved_by": request.approved_by,
        "approved_by_email": approver.email if approver else None,
        "rejection_notes": request.rejection_notes,
        "resolved_at": request.resolved_at,
        "created_at": request.created_at,
    }
