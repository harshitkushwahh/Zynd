from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.application.investor.investor_bank_account_errors import InvestorBankAccountError
from app.application.mf.mf_calculator_errors import MfCalculatorError
from app.application.mf.mf_order_errors import MfCasError, MfOrderError

logger = logging.getLogger(__name__)


def _structured_domain_error_response(exc: Exception, *, status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"detail": {"code": code, "message": message}},
    )


def register_domain_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(MfOrderError)
    async def mf_order_error_handler(_: Request, exc: MfOrderError) -> JSONResponse:
        return _structured_domain_error_response(
            exc,
            status_code=exc.status_code,
            code=exc.code,
            message=exc.message,
        )

    @app.exception_handler(MfCasError)
    async def mf_cas_error_handler(_: Request, exc: MfCasError) -> JSONResponse:
        return _structured_domain_error_response(
            exc,
            status_code=exc.status_code,
            code=exc.code,
            message=exc.message,
        )

    @app.exception_handler(MfCalculatorError)
    async def mf_calculator_error_handler(_: Request, exc: MfCalculatorError) -> JSONResponse:
        return _structured_domain_error_response(
            exc,
            status_code=exc.status_code,
            code=exc.code,
            message=exc.message,
        )

    @app.exception_handler(InvestorBankAccountError)
    async def investor_bank_account_error_handler(_: Request, exc: InvestorBankAccountError) -> JSONResponse:
        return _structured_domain_error_response(
            exc,
            status_code=exc.status_code,
            code=exc.code,
            message=exc.message,
        )

    logger.info(
        "Registered domain exception handlers (%s, %s, %s, %s)",
        MfOrderError.__name__,
        MfCasError.__name__,
        MfCalculatorError.__name__,
        InvestorBankAccountError.__name__,
    )
