from __future__ import annotations

import httpx

from app.core.config import get_settings


async def verify_turnstile(
    token: str | None,
    remote_ip: str | None = None,
    *,
    required: bool = True,
) -> bool:
    settings = get_settings()
    if not settings.turnstile_secret_key:
        return True
    if not required:
        return True
    if not token:
        return False

    data = {"secret": settings.turnstile_secret_key, "response": token}
    if remote_ip:
        data["remoteip"] = remote_ip

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            data=data,
        )
        response.raise_for_status()
        result = response.json()
        return bool(result.get("success"))
