from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt

from app.core.config import Settings, get_settings
from app.infrastructure.security.tokens import _signing_material, _verification_material

DOCUMENT_DOWNLOAD_TOKEN_TYPE = "document_download"


def create_document_download_token(
    *,
    document_id: UUID,
    user_id: UUID,
    settings: Settings | None = None,
) -> tuple[str, int]:
    settings = settings or get_settings()
    ttl = settings.documents_download_url_ttl_seconds
    now = datetime.now(timezone.utc)
    signing_key, algorithm, kid = _signing_material(settings)
    payload = {
        "sub": str(user_id),
        "doc_id": str(document_id),
        "iat": now,
        "exp": now + timedelta(seconds=ttl),
        "type": DOCUMENT_DOWNLOAD_TOKEN_TYPE,
    }
    headers = {"kid": kid} if kid else None
    token = jwt.encode(payload, signing_key, algorithm=algorithm, headers=headers)
    return token, ttl


def decode_document_download_token(token: str, settings: Settings | None = None) -> dict:
    settings = settings or get_settings()
    verification_key, algorithms = _verification_material(settings)
    payload = jwt.decode(token, verification_key, algorithms=algorithms)
    if payload.get("type") != DOCUMENT_DOWNLOAD_TOKEN_TYPE:
        raise jwt.InvalidTokenError("Invalid token type")
    if "doc_id" not in payload or "sub" not in payload:
        raise jwt.InvalidTokenError("Missing document download claims")
    return payload
