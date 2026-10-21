"""Invalidate Redis auth-related caches after user or policy mutations."""

from __future__ import annotations

from uuid import UUID

from app.application.shared.redis_json_cache import delete_keys

USER_PUBLIC_PREFIX = "auth:user_public:"
USER_ROW_PREFIX = "auth:user_row:"
PROFILE_IMAGE_PREFIX = "auth:profile_image_url:"
RBAC_PERMISSIONS_PREFIX = "rbac:permissions:"
FUND_POLICY_KEY = "auth:fund_movement_policy"


async def invalidate_auth_user_caches(user_id: UUID) -> None:
    uid = str(user_id)
    await delete_keys(
        f"{USER_PUBLIC_PREFIX}{uid}",
        f"{USER_ROW_PREFIX}{uid}",
        f"{PROFILE_IMAGE_PREFIX}{uid}",
        f"{RBAC_PERMISSIONS_PREFIX}{uid}",
    )


async def invalidate_rbac_permissions_cache(user_id: UUID) -> None:
    await delete_keys(f"{RBAC_PERMISSIONS_PREFIX}{user_id}")


async def invalidate_fund_movement_policy_cache() -> None:
    await delete_keys(FUND_POLICY_KEY)
