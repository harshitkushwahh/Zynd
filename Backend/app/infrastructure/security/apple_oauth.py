from __future__ import annotations

import time
from typing import Any

import jwt
from jwt import PyJWKClient

APPLE_ISSUER = "https://appleid.apple.com"
APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"

_jwk_client: PyJWKClient | None = None


def _get_jwk_client() -> PyJWKClient:
    global _jwk_client
    if _jwk_client is None:
        _jwk_client = PyJWKClient(APPLE_JWKS_URL)
    return _jwk_client


def is_apple_private_relay_email(email: str | None) -> bool:
    if not email:
        return False
    normalized = email.strip().lower()
    return normalized.endswith("@privaterelay.appleid.com")


def verify_apple_identity_token(id_token: str, client_id: str) -> dict[str, Any]:
    signing_key = _get_jwk_client().get_signing_key_from_jwt(id_token)
    claims = jwt.decode(
        id_token,
        signing_key.key,
        algorithms=["RS256"],
        audience=client_id,
        issuer=APPLE_ISSUER,
        options={"require": ["exp", "iat", "sub"]},
    )
    if claims.get("exp", 0) < time.time():
        raise ValueError("expired_token")
    return claims
