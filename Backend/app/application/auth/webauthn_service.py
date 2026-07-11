from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import WebAuthnCredential, WebAuthnCredentialPurpose


async def list_user_passkeys(db: AsyncSession, user_id) -> list[dict[str, Any]]:
    from sqlalchemy import select

    result = await db.execute(
        select(WebAuthnCredential).where(
            WebAuthnCredential.user_id == user_id,
            WebAuthnCredential.purpose == WebAuthnCredentialPurpose.passkey,
        )
    )
    return [
        {
            "id": str(credential.id),
            "device_name": credential.device_name,
            "created_at": credential.created_at,
            "last_used_at": credential.last_used_at,
        }
        for credential in result.scalars()
    ]


async def passkeys_enabled() -> bool:
    """Phase 4 scaffold — full WebAuthn enrollment ships later."""
    return False
