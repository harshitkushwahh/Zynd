from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.admin.admin_invitations_router import router as admin_invitations_router
from app.api.v1.admin.mf_integrations_router import router as mf_integrations_router
from app.api.v1.admin.mf_router import router as mf_admin_router
from app.api.v1.admin.mf_transactions_router import router as mf_transactions_router
from app.api.v1.admin.zynd_logs_router import router as zynd_logs_router
from app.api.v1.admin.risk_profile_router import router as risk_profile_router
from app.api.v1.admin.family_groups_router import router as family_groups_router
from app.api.v1.admin.schemas import (
    AdminActionListResponse,
    AdminActionRequestResponse,
    AdminDocumentDownloadResponse,
    AdminDocumentListResponse,
    AdminDocumentResponse,
    AdminDocumentWormResponse,
    AdminDeleteDocumentRequest,
    AdminKycDocumentResponse,
    AdminKycReviewResponse,
    AdminLegalHoldRequest,
    AdminRejectKycDocumentRequest,
    AdminVerifyKycDocumentsResponse,
    AdminPermissionsListResponse,
    AdminPermissionResponse,
    AdminPermissionsResponse,
    AdminRoleResponse,
    AdminRolesResponse,
    CreateAdminPermissionRequest,
    CreateAdminRoleRequest,
    UpdateAdminRoleRequest,
    AdminTransferRequest,
    AdminTransferResponse,
    AdminUserListItemResponse,
    AdminUserListResponse,
    AdminUserProfileDetailResponse,
    AdminUserRolesResponse,
    AdminUserSummaryResponse,
    AssignAdminRoleRequest,
    CreateAdminUserRequest,
    CreateAdminUserResponse,
    SetAdminUserRolesRequest,
    AuditLogItemResponse,
    AuditLogListResponse,
    PendingActionResponse,
    PendingDeletionItemResponse,
    PendingDeletionsResponse,
    RejectAdminActionRequest,
    ResolveSecurityReviewRequest,
    ResolveSecurityReviewResponse,
    RetentionPolicyResponse,
    RetentionScheduleResponse,
    SecurityConfigItemResponse,
    SecurityConfigListResponse,
    SecurityConfigUpdateRequest,
    SecurityReviewItemResponse,
    SecurityReviewListResponse,
    SuspendUserRequest,
)
from app.api.v1.auth.deps import get_client_ip, require_admin_user, require_permission
from app.application.admin.admin_action_service import (
    approve_admin_action_request,
    create_admin_action_request,
    list_admin_action_requests,
    reject_admin_action_request,
)
from app.application.admin.audit_admin_service import list_audit_logs
from app.application.admin.document_admin_service import (
    get_document_admin,
    get_document_admin_row,
    list_documents_for_user_admin,
)
from app.application.admin.document_kyc_service import get_user_kyc_review, reject_kyc_document
from app.application.admin.rbac_service import (
    assign_role_to_admin_user,
    create_admin_permission,
    create_admin_role,
    delete_admin_role,
    get_user_permission_keys,
    list_admin_permissions,
    list_admin_roles,
    list_user_role_keys,
    revoke_role_from_admin_user,
    set_admin_user_roles,
    update_admin_role,
)
from app.application.auth.security_review_service import (
    list_security_review_items,
    resolve_security_review_item,
)
from app.application.documents.document_audit_service import (
    audit_document_viewed_by_admin,
    audit_documents_viewed_by_admin,
)
from app.application.documents.document_download_service import issue_admin_document_download
from app.application.documents.document_worm_service import (
    delete_document_admin,
    set_document_legal_hold,
    verify_document,
    verify_user_kyc_documents,
)
from app.application.documents.errors import DocumentError
from app.application.admin.user_admin_service import (
    create_admin_user,
    get_user_by_reference,
    get_user_summary,
    get_user_summary_by_reference,
    list_users,
)
from app.application.admin.user_profile_admin_service import get_user_profile_detail
from app.application.compliance.retention_service import list_retention_policies
from app.application.security.security_config_service import list_security_config
from app.core.database import get_db
from app.infrastructure.persistence.models import (
    AdminActionStatus,
    AdminActionType,
    AuditEventType,
    AuditLog,
    SecurityReviewStatus,
    User,
    UserRole,
    UserStatus,
)

router = APIRouter(prefix="/admin", tags=["admin"])
router.include_router(mf_admin_router)
router.include_router(risk_profile_router)
router.include_router(family_groups_router)
router.include_router(admin_invitations_router)
router.include_router(mf_integrations_router)
router.include_router(mf_transactions_router)
router.include_router(zynd_logs_router)


async def _require_user_by_reference(db: AsyncSession, reference: str) -> User:
    user = await get_user_by_reference(db, reference)
    if not user:
        raise HTTPException(
            status_code=404,
            detail={"code": "user_not_found", "message": "User not found."},
        )
    return user


@router.get("/security-reviews", response_model=SecurityReviewListResponse)
async def get_security_reviews(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("security_reviews.read"))],
    status: Optional[str] = "open",
) -> SecurityReviewListResponse:
    review_status = SecurityReviewStatus(status) if status else None
    items = await list_security_review_items(db, status=review_status)
    return SecurityReviewListResponse(items=[SecurityReviewItemResponse(**item) for item in items])


@router.post("/security-reviews/{item_id}/resolve", response_model=ResolveSecurityReviewResponse)
async def post_resolve_security_review(
    item_id: str,
    body: ResolveSecurityReviewRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    reviewer: Annotated[User, Depends(require_permission("security_reviews.resolve"))],
) -> ResolveSecurityReviewResponse:
    try:
        parsed_id = UUID(item_id)
        result = await resolve_security_review_item(
            db,
            item_id=parsed_id,
            reviewer=reviewer,
            status=SecurityReviewStatus(body.status),
            notes=body.notes,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=404 if "not found" in str(exc).lower() else 409,
            detail={"code": "invalid_review", "message": str(exc)},
        ) from exc

    await db.commit()
    return ResolveSecurityReviewResponse(**result)


@router.get("/rbac/me", response_model=AdminPermissionsResponse)
async def get_admin_permissions(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_admin_user)],
) -> AdminPermissionsResponse:
    permissions = sorted(await get_user_permission_keys(db, current_user.id))
    return AdminPermissionsResponse(permissions=permissions)


@router.get("/rbac/roles", response_model=AdminRolesResponse)
async def get_admin_roles(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("rbac.manage"))],
) -> AdminRolesResponse:
    roles = await list_admin_roles(db)
    return AdminRolesResponse(roles=[AdminRoleResponse(**role) for role in roles])


@router.get("/rbac/permissions", response_model=AdminPermissionsListResponse)
async def get_admin_permissions_catalog(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("rbac.manage"))],
) -> AdminPermissionsListResponse:
    permissions = await list_admin_permissions(db)
    return AdminPermissionsListResponse(
        permissions=[AdminPermissionResponse(**item) for item in permissions]
    )


@router.post("/rbac/permissions", response_model=AdminPermissionResponse)
async def post_admin_permission(
    body: CreateAdminPermissionRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("rbac.manage"))],
) -> AdminPermissionResponse:
    try:
        permission = await create_admin_permission(
            db,
            key=body.key,
            description=body.description,
        )
    except ValueError as exc:
        message = str(exc)
        status_code = 409 if "already exists" in message.lower() else 400
        raise HTTPException(
            status_code=status_code,
            detail={"code": "permission_create_failed", "message": message},
        ) from exc

    db.add(
        AuditLog(
            user_id=admin.id,
            event_type=AuditEventType.admin_action_requested,
            ip_address=get_client_ip(request),
            metadata_={
                "kind": "rbac_permission_created",
                "permission_key": permission["key"],
            },
        )
    )
    await db.commit()
    return AdminPermissionResponse(**permission)


@router.post("/rbac/roles", response_model=AdminRoleResponse)
async def post_admin_role(
    body: CreateAdminRoleRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("rbac.manage"))],
) -> AdminRoleResponse:
    try:
        role = await create_admin_role(
            db,
            key=body.key,
            name=body.name,
            description=body.description,
            permission_keys=body.permissions,
        )
    except ValueError as exc:
        message = str(exc)
        status_code = 409 if "already exists" in message.lower() else 400
        raise HTTPException(
            status_code=status_code,
            detail={"code": "role_create_failed", "message": message},
        ) from exc

    db.add(
        AuditLog(
            user_id=admin.id,
            event_type=AuditEventType.admin_action_requested,
            ip_address=get_client_ip(request),
            metadata_={
                "kind": "rbac_role_created",
                "role_key": role["key"],
            },
        )
    )
    await db.commit()
    return AdminRoleResponse(**role)


@router.patch("/rbac/roles/{role_key}", response_model=AdminRoleResponse)
async def patch_admin_role(
    role_key: str,
    body: UpdateAdminRoleRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("rbac.manage"))],
) -> AdminRoleResponse:
    try:
        role = await update_admin_role(
            db,
            role_key=role_key,
            name=body.name,
            description=body.description,
            permission_keys=body.permissions,
        )
    except ValueError as exc:
        message = str(exc)
        status_code = 404 if "not found" in message.lower() else 400
        raise HTTPException(
            status_code=status_code,
            detail={"code": "role_update_failed", "message": message},
        ) from exc

    db.add(
        AuditLog(
            user_id=admin.id,
            event_type=AuditEventType.admin_action_requested,
            ip_address=get_client_ip(request),
            metadata_={
                "kind": "rbac_role_updated",
                "role_key": role_key,
            },
        )
    )
    await db.commit()
    return AdminRoleResponse(**role)


@router.delete("/rbac/roles/{role_key}")
async def delete_admin_role_endpoint(
    role_key: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("rbac.manage"))],
) -> dict[str, str]:
    try:
        await delete_admin_role(db, role_key=role_key)
    except ValueError as exc:
        message = str(exc)
        status_code = 404 if "not found" in message.lower() else 409
        raise HTTPException(
            status_code=status_code,
            detail={"code": "role_delete_failed", "message": message},
        ) from exc

    db.add(
        AuditLog(
            user_id=admin.id,
            event_type=AuditEventType.admin_action_requested,
            ip_address=get_client_ip(request),
            metadata_={
                "kind": "rbac_role_deleted",
                "role_key": role_key,
            },
        )
    )
    await db.commit()
    return {"message": f"Role {role_key} deleted."}


@router.get("/rbac/users/{user_id}/roles", response_model=AdminUserRolesResponse)
async def get_admin_user_roles(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("rbac.manage"))],
) -> AdminUserRolesResponse:
    user = await _require_user_by_reference(db, user_id)
    roles = await list_user_role_keys(db, user.id)
    return AdminUserRolesResponse(user_id=user.id, roles=roles)


@router.post("/rbac/users/{user_id}/roles", response_model=AdminUserRolesResponse)
async def post_assign_admin_role(
    user_id: str,
    body: AssignAdminRoleRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("rbac.manage"))],
) -> AdminUserRolesResponse:
    user = await _require_user_by_reference(db, user_id)
    try:
        roles = await assign_role_to_admin_user(
            db,
            user_id=user.id,
            role_key=body.role_key,
        )
    except ValueError as exc:
        message = str(exc)
        status_code = 404 if "not found" in message.lower() else 409
        raise HTTPException(
            status_code=status_code,
            detail={"code": "role_assign_failed", "message": message},
        ) from exc

    db.add(
        AuditLog(
            user_id=admin.id,
            event_type=AuditEventType.admin_action_requested,
            ip_address=get_client_ip(request),
            metadata_={
                "kind": "rbac_role_assigned",
                "target_user_id": str(user.id),
                "role_key": body.role_key,
            },
        )
    )
    await db.commit()
    return AdminUserRolesResponse(user_id=user.id, roles=roles)


@router.delete("/rbac/users/{user_id}/roles/{role_key}", response_model=AdminUserRolesResponse)
async def delete_admin_role_assignment(
    user_id: str,
    role_key: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("rbac.manage"))],
) -> AdminUserRolesResponse:
    user = await _require_user_by_reference(db, user_id)
    try:
        roles = await revoke_role_from_admin_user(
            db,
            user_id=user.id,
            role_key=role_key,
        )
    except ValueError as exc:
        message = str(exc)
        status_code = 404 if "not found" in message.lower() else 409
        raise HTTPException(
            status_code=status_code,
            detail={"code": "role_revoke_failed", "message": message},
        ) from exc

    db.add(
        AuditLog(
            user_id=admin.id,
            event_type=AuditEventType.admin_action_requested,
            ip_address=get_client_ip(request),
            metadata_={
                "kind": "rbac_role_revoked",
                "target_user_id": str(user.id),
                "role_key": role_key,
            },
        )
    )
    await db.commit()
    return AdminUserRolesResponse(user_id=user.id, roles=roles)


@router.put("/rbac/users/{user_id}/roles", response_model=AdminUserRolesResponse)
async def put_admin_user_roles(
    user_id: str,
    body: SetAdminUserRolesRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("rbac.manage"))],
) -> AdminUserRolesResponse:
    user = await _require_user_by_reference(db, user_id)
    try:
        roles = await set_admin_user_roles(
            db,
            user_id=user.id,
            role_keys=body.role_keys,
        )
    except ValueError as exc:
        message = str(exc)
        status_code = 404 if "not found" in message.lower() else 400
        raise HTTPException(
            status_code=status_code,
            detail={"code": "role_set_failed", "message": message},
        ) from exc

    db.add(
        AuditLog(
            user_id=admin.id,
            event_type=AuditEventType.admin_action_requested,
            ip_address=get_client_ip(request),
            metadata_={
                "kind": "rbac_roles_set",
                "target_user_id": str(user.id),
                "role_keys": body.role_keys,
            },
        )
    )
    await db.commit()
    return AdminUserRolesResponse(user_id=user.id, roles=roles)


@router.post("/rbac/admin-users", response_model=CreateAdminUserResponse, status_code=201)
async def post_create_admin_user(
    body: CreateAdminUserRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("rbac.manage"))],
) -> CreateAdminUserResponse:
    try:
        summary = await create_admin_user(
            db,
            actor=admin,
            email=body.email,
            first_name=body.first_name,
            last_name=body.last_name,
            password=body.password,
            role_keys=body.role_keys,
            ip=get_client_ip(request),
        )
    except ValueError as exc:
        message = str(exc)
        status_code = 409 if "already" in message.lower() else 400
        raise HTTPException(
            status_code=status_code,
            detail={"code": "admin_user_create_failed", "message": message},
        ) from exc

    await db.commit()
    return CreateAdminUserResponse(**summary)


@router.get("/security/config", response_model=SecurityConfigListResponse)
async def get_security_config(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("security.manage"))],
) -> SecurityConfigListResponse:
    items = await list_security_config(db)
    return SecurityConfigListResponse(
        items=[SecurityConfigItemResponse(**item) for item in items]
    )


@router.post("/security/config/update", response_model=PendingActionResponse)
async def post_security_config_update(
    body: SecurityConfigUpdateRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("security.manage"))],
) -> PendingActionResponse:
    try:
        result = await create_admin_action_request(
            db,
            action_type=AdminActionType.security_config_update,
            requester=admin,
            payload={"key": body.key, "value": body.value},
            reason=body.reason or f"Update security config: {body.key}",
            ip=get_client_ip(request),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail={"code": "config_update_failed", "message": str(exc)},
        ) from exc

    await db.commit()
    return PendingActionResponse(
        action_id=result["id"],
        message="Security configuration update submitted for approval.",
    )


@router.get("/audit", response_model=AuditLogListResponse)
async def get_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("audit.read"))],
    user_id: Optional[str] = None,
    event_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> AuditLogListResponse:
    parsed_user_id: UUID | None = None
    if user_id:
        try:
            parsed_user_id = UUID(user_id)
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail={"code": "invalid_user_id", "message": "Invalid user ID."},
            ) from exc

    parsed_event_type: AuditEventType | None = None
    if event_type:
        try:
            parsed_event_type = AuditEventType(event_type)
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail={"code": "invalid_event_type", "message": "Invalid audit event type."},
            ) from exc

    items = await list_audit_logs(
        db,
        user_id=parsed_user_id,
        event_type=parsed_event_type,
        limit=limit,
        offset=offset,
    )
    return AuditLogListResponse(items=[AuditLogItemResponse(**item) for item in items])


@router.post("/encryption/rotate-mfa-keys", response_model=PendingActionResponse)
async def post_rotate_mfa_keys(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("encryption.rotate"))],
) -> PendingActionResponse:
    result = await create_admin_action_request(
        db,
        action_type=AdminActionType.encryption_rotate_mfa,
        requester=admin,
        payload={},
        reason="MFA encryption key rotation",
        ip=get_client_ip(request),
    )
    await db.commit()
    return PendingActionResponse(
        action_id=result["id"],
        message="MFA key rotation submitted for approval.",
    )


@router.get("/actions", response_model=AdminActionListResponse)
async def get_admin_actions(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("admin_actions.approve"))],
    status: Optional[str] = "pending",
) -> AdminActionListResponse:
    action_status = AdminActionStatus(status) if status else None
    items = await list_admin_action_requests(db, status=action_status)
    return AdminActionListResponse(items=[AdminActionRequestResponse(**item) for item in items])


@router.post("/actions/{action_id}/approve", response_model=AdminActionRequestResponse)
async def post_approve_admin_action(
    action_id: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    approver: Annotated[User, Depends(require_permission("admin_actions.approve"))],
) -> AdminActionRequestResponse:
    try:
        parsed_id = UUID(action_id)
        result = await approve_admin_action_request(
            db,
            action_id=parsed_id,
            approver=approver,
            ip=get_client_ip(request),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=409 if "not found" not in str(exc).lower() else 404,
            detail={"code": "approval_failed", "message": str(exc)},
        ) from exc
    await db.commit()
    return AdminActionRequestResponse(**result)


@router.post("/actions/{action_id}/reject", response_model=AdminActionRequestResponse)
async def post_reject_admin_action(
    action_id: str,
    body: RejectAdminActionRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    approver: Annotated[User, Depends(require_permission("admin_actions.approve"))],
) -> AdminActionRequestResponse:
    try:
        parsed_id = UUID(action_id)
        result = await reject_admin_action_request(
            db,
            action_id=parsed_id,
            approver=approver,
            notes=body.notes,
            ip=get_client_ip(request),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=409 if "not found" not in str(exc).lower() else 404,
            detail={"code": "rejection_failed", "message": str(exc)},
        ) from exc
    await db.commit()
    return AdminActionRequestResponse(**result)


@router.get("/retention/schedule", response_model=RetentionScheduleResponse)
async def get_retention_schedule(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("retention.read"))],
) -> RetentionScheduleResponse:
    policies = await list_retention_policies(db)
    return RetentionScheduleResponse(
        policies=[RetentionPolicyResponse(**policy) for policy in policies]
    )


@router.get("/deletions/pending", response_model=PendingDeletionsResponse)
async def get_pending_deletions(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("deletion.execute"))],
) -> PendingDeletionsResponse:
    result = await db.execute(
        select(User)
        .where(User.status == UserStatus.deletion_pending)
        .order_by(User.deletion_scheduled_at.asc())
    )
    now = datetime.now(timezone.utc)
    items = [
        PendingDeletionItemResponse(
            user_id=user.id,
            email=user.email,
            deletion_requested_at=user.deletion_requested_at,
            deletion_scheduled_at=user.deletion_scheduled_at,
            is_due=bool(user.deletion_scheduled_at and user.deletion_scheduled_at <= now),
        )
        for user in result.scalars()
    ]
    return PendingDeletionsResponse(items=items)


@router.post("/deletions/run-executor", response_model=PendingActionResponse)
async def post_run_deletion_executor(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("deletion.execute"))],
) -> PendingActionResponse:
    result = await create_admin_action_request(
        db,
        action_type=AdminActionType.deletion_executor_run,
        requester=admin,
        payload={},
        reason="Manual deletion executor run",
        ip=get_client_ip(request),
    )
    await db.commit()
    return PendingActionResponse(
        action_id=result["id"],
        message="Deletion executor run submitted for approval.",
    )


@router.get("/users", response_model=AdminUserListResponse)
async def get_admin_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("users.read"))],
    email: Optional[str] = None,
    status: Optional[str] = None,
    role: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> AdminUserListResponse:
    parsed_status: UserStatus | None = None
    if status:
        try:
            parsed_status = UserStatus(status)
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail={"code": "invalid_status", "message": "Invalid user status."},
            ) from exc

    parsed_role: UserRole | None = None
    if role:
        try:
            parsed_role = UserRole(role)
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail={"code": "invalid_role", "message": "Invalid user role."},
            ) from exc

    items = await list_users(
        db,
        email=email,
        status=parsed_status,
        role=parsed_role,
        limit=limit,
        offset=offset,
    )
    return AdminUserListResponse(
        items=[AdminUserListItemResponse(**item) for item in items]
    )


@router.get("/users/{user_id}", response_model=AdminUserSummaryResponse)
async def get_admin_user_summary(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("users.read"))],
) -> AdminUserSummaryResponse:
    summary = await get_user_summary_by_reference(db, user_id)
    if not summary:
        raise HTTPException(
            status_code=404,
            detail={"code": "user_not_found", "message": "User not found."},
        )
    return AdminUserSummaryResponse(**summary)


@router.get("/users/{user_id}/profile-detail", response_model=AdminUserProfileDetailResponse)
async def get_admin_user_profile_detail(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("users.read"))],
) -> AdminUserProfileDetailResponse:
    from app.application.admin.rbac_service import user_has_permission

    user = await _require_user_by_reference(db, user_id)
    include_kyc = await user_has_permission(db, admin.id, "documents.read")
    include_investments = await user_has_permission(db, admin.id, "mf.transactions.read")

    detail = await get_user_profile_detail(
        db,
        user.id,
        include_kyc=include_kyc,
        include_investments=include_investments,
    )
    if not detail:
        raise HTTPException(
            status_code=404,
            detail={"code": "user_not_found", "message": "User not found."},
        )
    return AdminUserProfileDetailResponse(**detail)


@router.post("/users/{user_id}/suspend", response_model=PendingActionResponse)
async def post_suspend_user(
    user_id: str,
    body: SuspendUserRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("users.suspend"))],
) -> PendingActionResponse:
    user = await _require_user_by_reference(db, user_id)

    try:
        action = await create_admin_action_request(
            db,
            action_type=AdminActionType.account_suspend,
            requester=admin,
            payload={"reason_code": body.reason_code, "notes": body.notes},
            target_type="user",
            target_id=user.id,
            reason=body.notes,
            ip=get_client_ip(request),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail={"code": "suspend_failed", "message": str(exc)},
        ) from exc

    await db.commit()
    return PendingActionResponse(
        action_id=action["id"],
        message="Account suspension submitted for approval.",
    )


@router.post("/users/{user_id}/unsuspend", response_model=PendingActionResponse)
async def post_unsuspend_user(
    user_id: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("users.suspend"))],
) -> PendingActionResponse:
    user = await _require_user_by_reference(db, user_id)

    try:
        action = await create_admin_action_request(
            db,
            action_type=AdminActionType.account_unsuspend,
            requester=admin,
            payload={},
            target_type="user",
            target_id=user.id,
            reason="Account reactivation request",
            ip=get_client_ip(request),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail={"code": "unsuspend_failed", "message": str(exc)},
        ) from exc

    await db.commit()
    return PendingActionResponse(
        action_id=action["id"],
        message="Account reactivation submitted for approval.",
    )


@router.post("/transactions/transfer", response_model=AdminTransferResponse)
async def post_admin_transfer(
    body: AdminTransferRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("transactions.execute"))],
) -> AdminTransferResponse:
    user = await db.get(User, body.user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail={"code": "user_not_found", "message": "User not found."},
        )

    transfer_id = str(uuid4())
    db.add(
        AuditLog(
            user_id=admin.id,
            event_type=AuditEventType.transfer_requested,
            ip_address=get_client_ip(request),
            metadata_={
                "transfer_id": transfer_id,
                "on_behalf_of_user_id": str(body.user_id),
                "amount_inr": body.amount_inr,
                "destination_label": body.destination_label,
                "note": body.note,
                "initiated_by": "admin",
            },
        )
    )
    await db.commit()
    return AdminTransferResponse(
        transfer_id=transfer_id,
        status="accepted_stub",
        user_id=body.user_id,
        amount_inr=body.amount_inr,
        destination_label=body.destination_label,
        message=(
            "Admin transfer accepted by stub endpoint. "
            "Settlement wiring comes in a later sprint."
        ),
    )


def _handle_document_error(exc: DocumentError) -> HTTPException:
    return HTTPException(
        status_code=exc.status_code,
        detail={"code": exc.code, "message": exc.message},
    )


@router.get("/users/{user_id}/documents", response_model=AdminDocumentListResponse)
async def get_admin_user_documents(
    user_id: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("documents.read"))],
) -> AdminDocumentListResponse:
    user = await _require_user_by_reference(db, user_id)

    documents = await list_documents_for_user_admin(db, user_id=user.id)
    await audit_documents_viewed_by_admin(
        db,
        target_user_id=user.id,
        admin_user_id=admin.id,
        document_count=len(documents),
        ip=get_client_ip(request),
    )
    await db.commit()
    return AdminDocumentListResponse(
        documents=[AdminDocumentResponse(**item) for item in documents],
    )


@router.get("/documents/{document_id}", response_model=AdminDocumentResponse)
async def get_admin_document(
    document_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("documents.read"))],
) -> AdminDocumentResponse:
    document = await get_document_admin(db, document_id=document_id)
    if not document:
        raise HTTPException(
            status_code=404,
            detail={"code": "document_not_found", "message": "Document not found."},
        )

    row = await get_document_admin_row(db, document_id=document_id)
    assert row is not None
    await audit_document_viewed_by_admin(
        db,
        document=row,
        admin_user_id=admin.id,
        ip=get_client_ip(request),
    )
    await db.commit()
    return AdminDocumentResponse(**document)


@router.get("/documents/{document_id}/download", response_model=AdminDocumentDownloadResponse)
async def get_admin_document_download(
    document_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("documents.download"))],
) -> AdminDocumentDownloadResponse:
    try:
        payload = await issue_admin_document_download(
            db,
            admin=admin,
            document_id=document_id,
            ip=get_client_ip(request),
        )
    except DocumentError as exc:
        raise _handle_document_error(exc) from exc

    await db.commit()
    return AdminDocumentDownloadResponse(**payload)


@router.get("/users/{user_id}/kyc-review", response_model=AdminKycReviewResponse)
async def get_admin_user_kyc_review(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("documents.read"))],
) -> AdminKycReviewResponse:
    user = await _require_user_by_reference(db, user_id)

    try:
        payload = await get_user_kyc_review(db, user_id=user.id)
    except DocumentError as exc:
        raise _handle_document_error(exc) from exc

    return AdminKycReviewResponse(
        user_id=payload["user_id"],
        client_id=payload["client_id"],
        email=payload["email"],
        documents=[AdminKycDocumentResponse(**item) for item in payload["documents"]],
    )


@router.post("/documents/{document_id}/reject", response_model=AdminKycDocumentResponse)
async def post_reject_kyc_document(
    document_id: UUID,
    body: AdminRejectKycDocumentRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("documents.verify"))],
) -> AdminKycDocumentResponse:
    try:
        result = await reject_kyc_document(
            db,
            document_id=document_id,
            admin=admin,
            ip=get_client_ip(request),
            reason=body.reason,
        )
    except DocumentError as exc:
        raise _handle_document_error(exc) from exc

    await db.commit()
    return AdminKycDocumentResponse(**result)


@router.post("/documents/{document_id}/verify", response_model=AdminDocumentWormResponse)
async def post_verify_document(
    document_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("documents.verify"))],
) -> AdminDocumentWormResponse:
    try:
        result = await verify_document(
            db,
            document_id=document_id,
            admin=admin,
            ip=get_client_ip(request),
        )
    except DocumentError as exc:
        raise _handle_document_error(exc) from exc

    await db.commit()
    return AdminDocumentWormResponse(**result)


@router.post("/users/{user_id}/documents/verify-kyc", response_model=AdminVerifyKycDocumentsResponse)
async def post_verify_user_kyc_documents(
    user_id: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("documents.verify"))],
) -> AdminVerifyKycDocumentsResponse:
    user = await _require_user_by_reference(db, user_id)

    try:
        payload = await verify_user_kyc_documents(
            db,
            user_id=user.id,
            admin=admin,
            ip=get_client_ip(request),
        )
    except DocumentError as exc:
        raise _handle_document_error(exc) from exc

    await db.commit()
    return AdminVerifyKycDocumentsResponse(
        verified_count=payload["verified_count"],
        skipped_count=payload["skipped_count"],
        documents=[AdminDocumentWormResponse(**item) for item in payload["documents"]],
    )


@router.post("/documents/{document_id}/legal-hold", response_model=AdminDocumentWormResponse)
async def post_document_legal_hold(
    document_id: UUID,
    body: AdminLegalHoldRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("documents.legal_hold"))],
) -> AdminDocumentWormResponse:
    try:
        result = await set_document_legal_hold(
            db,
            document_id=document_id,
            enabled=body.enabled,
            admin=admin,
            ip=get_client_ip(request),
        )
    except DocumentError as exc:
        raise _handle_document_error(exc) from exc

    await db.commit()
    return AdminDocumentWormResponse(**result)


@router.delete("/documents/{document_id}", response_model=AdminDocumentWormResponse)
async def delete_admin_document(
    document_id: UUID,
    body: AdminDeleteDocumentRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_permission("documents.delete"))],
) -> AdminDocumentWormResponse:
    try:
        result = await delete_document_admin(
            db,
            document_id=document_id,
            admin=admin,
            ip=get_client_ip(request),
            reason=body.reason,
        )
    except DocumentError as exc:
        raise _handle_document_error(exc) from exc

    await db.commit()
    return AdminDocumentWormResponse(**result)
