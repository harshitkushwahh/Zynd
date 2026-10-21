from __future__ import annotations

from fastapi import HTTPException

from app.application.kyc.errors import KycError
from app.infrastructure.kyc.cybrilla_terminal_log import log_exception_dump


def handle_kyc_error(exc: KycError) -> HTTPException:
    log_exception_dump(
        "KYC request failed",
        exc,
        code=exc.code,
        status_code=exc.status_code,
        message=exc.message,
    )
    cause = exc.__cause__
    detail: dict[str, object] = {"code": exc.code, "message": exc.message}
    if cause is not None:
        detail["cause"] = str(getattr(cause, "message", None) or cause)
        response_data = getattr(cause, "response_data", None)
        if response_data is not None:
            detail["provider"] = response_data
    return HTTPException(status_code=exc.status_code, detail=detail)
