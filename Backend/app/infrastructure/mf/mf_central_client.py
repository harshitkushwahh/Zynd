from __future__ import annotations

import asyncio
import base64
import logging
import time
from typing import Any

import httpx

from app.core.config import Settings, get_settings
from app.infrastructure.mf.mf_central_crypto import (
    MfCentralCryptoError,
    decrypt_api_payload,
    encrypt_api_payload,
    encrypt_launch_payload,
    load_private_key,
    load_public_key,
    sign_detached,
    verify_detached,
)

logger = logging.getLogger(__name__)

_token_lock = asyncio.Lock()
_cached_token = ""
_cached_token_expires_at = 0.0


class MfCentralClientError(Exception):
    pass


def _require_settings(settings: Settings) -> None:
    missing = [
        name
        for name, value in (
            ("ZYND_MF_CENTRAL_BASE_URL", settings.zynd_mf_central_base_url),
            ("ZYND_MF_CENTRAL_REDIRECT_BASE_URL", settings.zynd_mf_central_redirect_base_url),
            ("ZYND_MF_CENTRAL_CLIENT_ID", settings.zynd_mf_central_client_id),
            ("ZYND_MF_CENTRAL_CLIENT_SECRET", settings.zynd_mf_central_client_secret),
            ("ZYND_MF_CENTRAL_USERNAME", settings.zynd_mf_central_username),
            ("ZYND_MF_CENTRAL_PASSWORD", settings.zynd_mf_central_password),
            ("ZYND_MF_CENTRAL_ENCRYPTION_KEY", settings.zynd_mf_central_encryption_key),
            ("ZYND_MF_CENTRAL_AES_IV", settings.zynd_mf_central_aes_iv),
            ("ZYND_MF_CENTRAL_URL_ENCRYPTION_KEY", settings.zynd_mf_central_url_encryption_key),
            ("ZYND_MF_CENTRAL_PRIVATE_KEY", settings.zynd_mf_central_private_key),
            ("ZYND_MF_CENTRAL_PUBLIC_KEY", settings.zynd_mf_central_public_key),
        )
        if not str(value).strip()
    ]
    if missing:
        raise MfCentralClientError("MF Central is not configured: " + ", ".join(missing))


async def _access_token(settings: Settings) -> str:
    global _cached_token, _cached_token_expires_at
    now = time.time()
    if _cached_token and now < _cached_token_expires_at:
        return _cached_token

    async with _token_lock:
        now = time.time()
        if _cached_token and now < _cached_token_expires_at:
            return _cached_token
        credentials = base64.b64encode(
            f"{settings.zynd_mf_central_client_id}:{settings.zynd_mf_central_client_secret}".encode("utf-8")
        ).decode("ascii")
        timeout = float(settings.zynd_mf_fetch_timeout_seconds)
        base = settings.zynd_mf_central_base_url.rstrip("/")
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{base}/oauth/token",
                data={
                    "username": settings.zynd_mf_central_username,
                    "password": settings.zynd_mf_central_password,
                    "grant_type": "password",
                },
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": f"Basic {credentials}",
                },
            )
        _raise_for_status(response, action="token")
        body = response.json()
        token = str(body.get("access_token") or "")
        if not token:
            raise MfCentralClientError("MF Central did not return an access token")
        expires_in = int(body.get("expires_in") or 3600)
        _cached_token = token
        _cached_token_expires_at = time.time() + max(expires_in - 120, 60)
        return token


def _raise_for_status(response: httpx.Response, *, action: str) -> None:
    if response.status_code < 400:
        return
    message = f"MF Central {action} failed ({response.status_code})"
    try:
        body = response.json()
    except Exception:
        body = None
    if isinstance(body, dict):
        detail = body.get("message") or body.get("error_description") or body.get("error")
        if detail:
            message = f"{message}: {detail}"
    raise MfCentralClientError(message)


async def _signed_call(
    settings: Settings,
    *,
    path: str,
    payload: dict[str, Any],
    action: str,
) -> dict[str, Any]:
    _require_settings(settings)
    try:
        encrypted = encrypt_api_payload(
            payload,
            encryption_key=settings.zynd_mf_central_encryption_key,
            iv=settings.zynd_mf_central_aes_iv,
        )
        private_key, kid = load_private_key(settings.zynd_mf_central_private_key)
        public_key = load_public_key(settings.zynd_mf_central_public_key)
        signature = sign_detached(encrypted, private_key=private_key, kid=kid)
    except MfCentralCryptoError as exc:
        raise MfCentralClientError(str(exc)) from exc

    token = await _access_token(settings)
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "ClientId": settings.zynd_mf_central_client_id,
    }
    if settings.zynd_mf_central_origin.strip():
        headers["Origin"] = settings.zynd_mf_central_origin.strip()

    timeout = float(settings.zynd_mf_fetch_timeout_seconds)
    base = settings.zynd_mf_central_base_url.rstrip("/")
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{base}{path}",
            json={"signature": signature, "request": encrypted},
            headers=headers,
        )
    _raise_for_status(response, action=action)
    try:
        body = response.json()
    except Exception as exc:
        raise MfCentralClientError(f"MF Central {action} returned a non-JSON body") from exc
    if not isinstance(body, dict):
        raise MfCentralClientError(f"MF Central {action} returned an unexpected body")
    if body.get("code") == "error" or (body.get("message") and "response" not in body):
        raise MfCentralClientError(str(body.get("message") or f"MF Central {action} failed"))
    encrypted_response = body.get("response")
    response_signature = body.get("signature")
    if not isinstance(encrypted_response, str) or not isinstance(response_signature, str):
        raise MfCentralClientError(f"MF Central {action} response was not encrypted")
    try:
        verify_detached(response_signature, encrypted_response, public_key=public_key)
        return decrypt_api_payload(
            encrypted_response,
            encryption_key=settings.zynd_mf_central_encryption_key,
            iv=settings.zynd_mf_central_aes_iv,
        )
    except MfCentralCryptoError as exc:
        raise MfCentralClientError(str(exc)) from exc


async def create_cas_request(
    *,
    client_ref_no: str,
    pan: str,
    mobile: str,
    redirect_url: str,
) -> dict[str, Any]:
    settings = get_settings()
    payload = {
        "clientRefNo": client_ref_no,
        "reqId": "",
        "pan": pan,
        "pekrn": "",
        "email": "",
        "mobile": mobile,
        "fromDate": "",
        "toDate": "",
        "redirectUrl": redirect_url,
    }
    decrypted = await _signed_call(
        settings,
        path="/api/client/V1/newCasRequest",
        payload=payload,
        action="newCasRequest",
    )
    req_id = str(decrypted.get("reqId") or "").strip()
    otp_ref = str(decrypted.get("otpRef") or "").strip()
    if not req_id or not otp_ref:
        raise MfCentralClientError("MF Central did not return a request id")
    launch_payload = {
        "reqId": req_id,
        "otpRef": otp_ref,
        "token": "",
        "pan": pan,
        "email": "",
        "mobile": mobile,
        "clientRefNo": client_ref_no,
        "redirectUrl": redirect_url,
    }
    try:
        encoded = encrypt_launch_payload(
            launch_payload,
            url_key=settings.zynd_mf_central_url_encryption_key,
        )
    except MfCentralCryptoError as exc:
        raise MfCentralClientError(str(exc)) from exc
    redirect_base = settings.zynd_mf_central_redirect_base_url.rstrip("/")
    return {
        "req_id": req_id,
        "otp_ref": otp_ref,
        "client_ref_no": str(decrypted.get("clientRefNo") or client_ref_no),
        "launch_url": f"{redirect_base}/api/auth/start?data={encoded}",
    }


async def validate_cas_qr(*, req_id: str, client_ref_no: str, qr_code: str) -> dict[str, Any]:
    settings = get_settings()
    return await _signed_call(
        settings,
        path="/api/client/V1/validateQRCode",
        payload={"reqId": req_id, "clientRefNo": client_ref_no, "qrCode": qr_code},
        action="validateQRCode",
    )
