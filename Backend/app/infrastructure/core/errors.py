from __future__ import annotations

from typing import Any

import httpx

from app.infrastructure.kyc.cybrilla_terminal_log import log_exception_dump


class CybrillaClientError(Exception):
    def __init__(
        self,
        message: str,
        code: str = "cybrilla_client_error",
        status_code: int = 502,
        response_data: Any = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.response_data = response_data


# Backward-compatible alias used across MF/KYC services.
FpClientError = CybrillaClientError


def parse_fp_error_message(payload: Any, *, fallback: str) -> str:
    if not isinstance(payload, dict):
        return fallback

    error_block = payload.get("error")
    if isinstance(error_block, dict):
        errors = error_block.get("errors")
        if isinstance(errors, list):
            messages: list[str] = []
            for item in errors:
                if not isinstance(item, dict):
                    continue
                field = str(item.get("field") or "").strip()
                message = str(item.get("message") or "").strip()
                if field and message:
                    messages.append(f"{field}: {message}")
                elif message:
                    messages.append(message)
            if messages:
                return "; ".join(messages)
        message = str(error_block.get("message") or "").strip()
        if message:
            return message

    detail = payload.get("detail")
    if isinstance(detail, dict):
        message = str(detail.get("message") or "").strip()
        if message:
            return message
    if isinstance(detail, str) and detail.strip():
        return detail.strip()

    message = str(payload.get("message") or "").strip()
    return message or fallback


def raise_for_fp_response(response: httpx.Response) -> None:
    if not response.is_error:
        return
    fallback = "Verification service rejected the request. Check your details and try again."
    try:
        payload = response.json()
    except ValueError:
        payload = {"raw": (response.text or "")[:4000]}
    message = parse_fp_error_message(payload, fallback=fallback)
    log_exception_dump(
        "Finprim HTTP error",
        status_code=response.status_code,
        url=str(response.request.url) if response.request else None,
        method=response.request.method if response.request else None,
        message=message,
        response=payload,
    )
    raise CybrillaClientError(message, "fp_client_error", response.status_code, response_data=payload)


_raise_for_fp_response = raise_for_fp_response
