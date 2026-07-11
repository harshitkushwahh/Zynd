from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import jwt

from app.core.config import Settings, get_settings


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def _signing_material(settings: Settings) -> tuple[str, str, str | None]:
    if settings.jwt_private_key_pem:
        return settings.jwt_private_key_pem, "RS256", settings.jwt_kid
    return settings.secret_key, settings.jwt_algorithm, None


def _verification_material(settings: Settings) -> tuple[str, list[str]]:
    if settings.jwt_public_key_pem:
        return settings.jwt_public_key_pem, ["RS256"]
    return settings.secret_key, [settings.jwt_algorithm]


def create_access_token(
    *,
    user_id: UUID,
    role: str,
    session_id: UUID,
    settings: Settings | None = None,
) -> str:
    settings = settings or get_settings()
    now = datetime.now(timezone.utc)
    signing_key, algorithm, kid = _signing_material(settings)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "sid": str(session_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
        "type": "access",
    }
    headers = {"kid": kid} if kid else None
    return jwt.encode(payload, signing_key, algorithm=algorithm, headers=headers)


def decode_access_token(token: str, settings: Settings | None = None) -> dict[str, Any]:
    settings = settings or get_settings()
    verification_key, algorithms = _verification_material(settings)
    payload = jwt.decode(token, verification_key, algorithms=algorithms)
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Invalid token type")
    return payload


def get_jwks_document(settings: Settings | None = None) -> dict[str, Any]:
    settings = settings or get_settings()
    if not settings.jwt_public_key_pem:
        return {"keys": []}

    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    import base64

    public_key = serialization.load_pem_public_key(settings.jwt_public_key_pem.encode())
    if not isinstance(public_key, rsa.RSAPublicKey):
        return {"keys": []}

    numbers = public_key.public_numbers()
    def _b64_uint(value: int) -> str:
        length = (value.bit_length() + 7) // 8
        return base64.urlsafe_b64encode(value.to_bytes(length, "big")).decode().rstrip("=")

    return {
        "keys": [
            {
                "kty": "RSA",
                "use": "sig",
                "alg": "RS256",
                "kid": settings.jwt_kid,
                "n": _b64_uint(numbers.n),
                "e": _b64_uint(numbers.e),
            }
        ]
    }
