from __future__ import annotations

import base64
import json
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers.parse_authentication_credential_json import parse_authentication_credential_json
from webauthn.helpers.parse_registration_credential_json import parse_registration_credential_json
from webauthn.helpers.structs import (
    AuthenticatorAttachment,
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from app.application.auth.audit_service import write_audit
from app.application.auth.errors import AuthError
from app.application.auth.pin_service import store_pin_unlock, user_has_pin
from app.core.config import get_settings
from app.infrastructure.persistence.models import (
    AuditEventType,
    User,
    WebAuthnCredential,
    WebAuthnCredentialPurpose,
)
from app.infrastructure.security.pending_auth import (
    consume_pending_auth,
    generate_pending_token,
    store_pending_auth,
)

WEBAUTHN_CHALLENGE_TTL_SECONDS = 300
PENDING_REGISTER_KIND = "webauthn_pin_register"
PENDING_UNLOCK_KIND = "webauthn_pin_unlock"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _encode_credential_id(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _decode_credential_id(value: str) -> bytes:
    padded = value + "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode(padded)


def _assert_origin(origin: str | None) -> str:
    settings = get_settings()
    if not origin:
        raise AuthError("Missing request origin.", "invalid_origin", 400)
    normalized = origin.rstrip("/")
    allowed = {item.rstrip("/") for item in settings.webauthn_origin_list}
    if normalized not in allowed:
        raise AuthError("Origin is not allowed for WebAuthn.", "invalid_origin", 403)
    return normalized


def _user_handle(user_id: UUID) -> bytes:
    return user_id.bytes


async def _get_pin_biometric_credentials(
    db: AsyncSession,
    user_id: UUID,
) -> list[WebAuthnCredential]:
    result = await db.execute(
        select(WebAuthnCredential).where(
            WebAuthnCredential.user_id == user_id,
            WebAuthnCredential.purpose == WebAuthnCredentialPurpose.pin_biometric,
        )
    )
    return list(result.scalars().all())


async def list_pin_biometric_credentials(
    db: AsyncSession,
    user_id: UUID,
) -> list[dict[str, Any]]:
    credentials = await _get_pin_biometric_credentials(db, user_id)
    return [
        {
            "id": str(credential.id),
            "credential_id": credential.credential_id,
            "device_name": credential.device_name,
            "created_at": credential.created_at,
            "last_used_at": credential.last_used_at,
        }
        for credential in credentials
    ]


async def begin_pin_biometric_register(
    db: AsyncSession,
    *,
    user: User,
) -> dict[str, Any]:
    if not user_has_pin(user):
        raise AuthError("Set up Zynd PIN before enabling biometric unlock.", "pin_not_set", 400)

    settings = get_settings()
    challenge_token = generate_pending_token()
    options = generate_registration_options(
        rp_id=settings.resolved_webauthn_rp_id,
        rp_name=settings.webauthn_rp_name,
        user_id=_user_handle(user.id),
        user_name=user.email,
        user_display_name=user.email,
        authenticator_selection=AuthenticatorSelectionCriteria(
            authenticator_attachment=AuthenticatorAttachment.PLATFORM,
            resident_key=ResidentKeyRequirement.DISCOURAGED,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
    )
    await store_pending_auth(
        PENDING_REGISTER_KIND,
        challenge_token,
        {
            "user_id": str(user.id),
            "challenge": base64.b64encode(options.challenge).decode("ascii"),
        },
        WEBAUTHN_CHALLENGE_TTL_SECONDS,
    )
    return {
        "challenge_token": challenge_token,
        "options": json.loads(options_to_json(options)),
    }


async def finish_pin_biometric_register(
    db: AsyncSession,
    *,
    user: User,
    challenge_token: str,
    credential_json: dict[str, Any],
    origin: str | None,
    device_name: str | None,
    ip: str | None,
) -> dict[str, Any]:
    if not user_has_pin(user):
        raise AuthError("Set up Zynd PIN before enabling biometric unlock.", "pin_not_set", 400)

    pending = await consume_pending_auth(PENDING_REGISTER_KIND, challenge_token)
    if not pending or pending.get("user_id") != str(user.id):
        raise AuthError("Registration challenge expired. Try again.", "invalid_challenge", 400)

    expected_origin = _assert_origin(origin)
    settings = get_settings()
    challenge = base64.b64decode(pending["challenge"])
    credential = parse_registration_credential_json(json.dumps(credential_json))

    verification = verify_registration_response(
        credential=credential,
        expected_challenge=challenge,
        expected_rp_id=settings.resolved_webauthn_rp_id,
        expected_origin=expected_origin,
        require_user_verification=True,
    )

    credential_id = _encode_credential_id(verification.credential_id)
    public_key = base64.b64encode(verification.credential_public_key).decode("ascii")

    existing = await db.execute(
        select(WebAuthnCredential).where(WebAuthnCredential.credential_id == credential_id)
    )
    if existing.scalar_one_or_none():
        raise AuthError("This biometric credential is already registered.", "credential_exists", 409)

    record = WebAuthnCredential(
        user_id=user.id,
        credential_id=credential_id,
        public_key=public_key,
        sign_count=verification.sign_count,
        device_name=(device_name or "This device")[:128],
        purpose=WebAuthnCredentialPurpose.pin_biometric,
    )
    db.add(record)
    await write_audit(
        db,
        event_type=AuditEventType.pin_biometric_enrolled,
        user_id=user.id,
        ip=ip,
        metadata={"device_name": record.device_name},
    )
    await db.flush()
    return {
        "ok": True,
        "credential_id": credential_id,
        "id": str(record.id),
        "device_name": record.device_name,
    }


async def begin_pin_biometric_unlock(
    db: AsyncSession,
    *,
    user: User,
    credential_id: str | None = None,
) -> dict[str, Any]:
    if not user_has_pin(user):
        raise AuthError("Zynd PIN is not set.", "pin_not_set", 400)

    credentials = await _get_pin_biometric_credentials(db, user.id)
    if not credentials:
        raise AuthError("Biometric unlock is not set up.", "biometric_not_enrolled", 400)

    allow_credentials = credentials
    if credential_id:
        allow_credentials = [item for item in credentials if item.credential_id == credential_id]
        if not allow_credentials:
            raise AuthError("Biometric credential not found on this account.", "credential_not_found", 404)

    settings = get_settings()
    challenge_token = generate_pending_token()
    descriptors = [
        PublicKeyCredentialDescriptor(id=_decode_credential_id(item.credential_id))
        for item in allow_credentials
    ]
    options = generate_authentication_options(
        rp_id=settings.resolved_webauthn_rp_id,
        allow_credentials=descriptors,
        user_verification=UserVerificationRequirement.REQUIRED,
    )

    await store_pending_auth(
        PENDING_UNLOCK_KIND,
        challenge_token,
        {
            "user_id": str(user.id),
            "challenge": base64.b64encode(options.challenge).decode("ascii"),
            "credential_ids": [item.credential_id for item in allow_credentials],
        },
        WEBAUTHN_CHALLENGE_TTL_SECONDS,
    )
    return {
        "challenge_token": challenge_token,
        "options": json.loads(options_to_json(options)),
    }


async def finish_pin_biometric_unlock(
    db: AsyncSession,
    *,
    user: User,
    session_id: UUID,
    challenge_token: str,
    credential_json: dict[str, Any],
    origin: str | None,
    ip: str | None,
) -> dict[str, Any]:
    if not user_has_pin(user):
        raise AuthError("Zynd PIN is not set.", "pin_not_set", 400)

    pending = await consume_pending_auth(PENDING_UNLOCK_KIND, challenge_token)
    if not pending or pending.get("user_id") != str(user.id):
        raise AuthError("Unlock challenge expired. Try again.", "invalid_challenge", 400)

    expected_origin = _assert_origin(origin)
    settings = get_settings()
    challenge = base64.b64decode(pending["challenge"])
    assertion = parse_authentication_credential_json(json.dumps(credential_json))

    credential_id = _encode_credential_id(assertion.raw_id)

    result = await db.execute(
        select(WebAuthnCredential).where(
            WebAuthnCredential.user_id == user.id,
            WebAuthnCredential.credential_id == credential_id,
            WebAuthnCredential.purpose == WebAuthnCredentialPurpose.pin_biometric,
        )
    )
    stored = result.scalar_one_or_none()
    if not stored:
        await write_audit(
            db,
            event_type=AuditEventType.pin_biometric_unlock_failed,
            user_id=user.id,
            ip=ip,
        )
        raise AuthError("Biometric verification failed.", "biometric_verification_failed", 401)

    public_key = base64.b64decode(stored.public_key)
    try:
        verification = verify_authentication_response(
            credential=assertion,
            expected_challenge=challenge,
            expected_rp_id=settings.resolved_webauthn_rp_id,
            expected_origin=expected_origin,
            credential_public_key=public_key,
            credential_current_sign_count=stored.sign_count,
            require_user_verification=True,
        )
    except Exception as exc:
        await write_audit(
            db,
            event_type=AuditEventType.pin_biometric_unlock_failed,
            user_id=user.id,
            ip=ip,
        )
        raise AuthError("Biometric verification failed.", "biometric_verification_failed", 401) from exc

    stored.sign_count = verification.new_sign_count
    stored.last_used_at = _now()
    await write_audit(
        db,
        event_type=AuditEventType.pin_biometric_unlock_success,
        user_id=user.id,
        ip=ip,
    )
    return await store_pin_unlock(user.id, session_id)


async def delete_pin_biometric_credential(
    db: AsyncSession,
    *,
    user: User,
    credential_record_id: UUID,
) -> dict[str, bool]:
    result = await db.execute(
        select(WebAuthnCredential).where(
            WebAuthnCredential.id == credential_record_id,
            WebAuthnCredential.user_id == user.id,
            WebAuthnCredential.purpose == WebAuthnCredentialPurpose.pin_biometric,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise AuthError("Biometric credential not found.", "credential_not_found", 404)
    await db.delete(record)
    return {"ok": True, "credential_id": record.credential_id}
