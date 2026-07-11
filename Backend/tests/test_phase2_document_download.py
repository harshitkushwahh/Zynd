from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
import pytest

from app.infrastructure.security.document_download_tokens import (
    DOCUMENT_DOWNLOAD_TOKEN_TYPE,
    create_document_download_token,
    decode_document_download_token,
)


def test_create_and_decode_document_download_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DOCUMENTS_DOWNLOAD_URL_TTL_SECONDS", "120")
    from app.core.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()

    document_id = uuid4()
    user_id = uuid4()
    token, ttl = create_document_download_token(
        document_id=document_id,
        user_id=user_id,
        settings=settings,
    )

    assert ttl == 120
    payload = decode_document_download_token(token, settings)
    assert payload["type"] == DOCUMENT_DOWNLOAD_TOKEN_TYPE
    assert payload["doc_id"] == str(document_id)
    assert payload["sub"] == str(user_id)

    get_settings.cache_clear()


def test_expired_document_download_token_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import get_settings
    from app.infrastructure.security.tokens import _signing_material

    get_settings.cache_clear()
    settings = get_settings()
    signing_key, algorithm, kid = _signing_material(settings)
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(uuid4()),
        "doc_id": str(uuid4()),
        "iat": now - timedelta(minutes=5),
        "exp": now - timedelta(minutes=1),
        "type": DOCUMENT_DOWNLOAD_TOKEN_TYPE,
    }
    headers = {"kid": kid} if kid else None
    token = jwt.encode(payload, signing_key, algorithm=algorithm, headers=headers)

    with pytest.raises(jwt.PyJWTError):
        decode_document_download_token(token, settings)

    get_settings.cache_clear()
