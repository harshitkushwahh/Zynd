"""Sandbox Cybrilla lookup responses — deterministic fixtures for local/dev (ZTO_MODE=sandbox)."""

from __future__ import annotations

import time
import uuid
from typing import Any

from app.infrastructure.kyc.cybrilla_terminal_log import log_zto_http

SANDBOX_BANK_ACCOUNT_NUMBER = "123456789012"
SANDBOX_IFSC = "HDFC0000001"
SANDBOX_PAN = "ABCDE1234F"
SANDBOX_DOB = "1990-05-15"

# Phones ending in this suffix simulate a terminal provider failure.
SANDBOX_FAILURE_PHONE_SUFFIX = "0000"

_STORE: dict[str, dict[str, Any]] = {}


def _failed(kind: str, source_ref_id: str, phone_number: str) -> dict[str, Any]:
    return {
        "id": f"{kind}_sandbox_{uuid.uuid4().hex[:12]}",
        "object": f"{kind}_lookup",
        "status": "failed",
        "source_ref_id": source_ref_id,
        "phone_number": phone_number,
        "data": None,
        "error": "sandbox_no_data",
    }


def sandbox_bank_lookup_response(*, source_ref_id: str, phone_number: str) -> dict[str, Any]:
    if phone_number.endswith(SANDBOX_FAILURE_PHONE_SUFFIX):
        return _failed("bank_account", source_ref_id, phone_number)
    return {
        "id": f"bal_sandbox_{uuid.uuid4().hex[:12]}",
        "object": "bank_account_lookup",
        "status": "success",
        "source_ref_id": source_ref_id,
        "phone_number": phone_number,
        "data": {
            "bank_accounts": [
                {
                    "account_number": SANDBOX_BANK_ACCOUNT_NUMBER,
                    "ifsc_code": SANDBOX_IFSC,
                    "bank_name": "HDFC Bank",
                }
            ]
        },
    }


def sandbox_customer_lookup_response(*, source_ref_id: str, phone_number: str, name: str) -> dict[str, Any]:
    if phone_number.endswith(SANDBOX_FAILURE_PHONE_SUFFIX):
        return _failed("customer_data", source_ref_id, phone_number)
    return {
        "id": f"cdl_sandbox_{uuid.uuid4().hex[:12]}",
        "object": "customer_data_lookup",
        "status": "success",
        "source_ref_id": source_ref_id,
        "phone_number": phone_number,
        "data": {
            "name": name,
            "pan": SANDBOX_PAN,
            "date_of_birth": SANDBOX_DOB,
            "addresses": [
                {
                    "line1": "221B Baker Street",
                    "line2": "Indiranagar",
                    "city": "Bengaluru",
                    "state": "Karnataka",
                    "pincode": "560038",
                }
            ],
        },
    }


class SandboxZtoLookupClient:
    """In-memory stand-in for Cybrilla lookup APIs. Lookups resolve immediately."""

    async def create_bank_lookup(
        self, *, source_ref_id: str, phone_number: str, consent: dict[str, Any]
    ) -> dict[str, Any]:
        started = time.perf_counter()
        body = {
            "source_ref_id": source_ref_id,
            "phone_number": phone_number,
            "consent": consent,
        }
        response = sandbox_bank_lookup_response(source_ref_id=source_ref_id, phone_number=phone_number)
        _STORE[response["id"]] = response
        log_zto_http(
            sandbox=True,
            method="POST",
            path="/v2/bank_account_lookups",
            duration_ms=int((time.perf_counter() - started) * 1000),
            request_body=body,
            response_body=response,
        )
        return response

    async def get_bank_lookup(self, lookup_id: str) -> dict[str, Any]:
        started = time.perf_counter()
        response = _STORE[lookup_id]
        log_zto_http(
            sandbox=True,
            method="GET",
            path=f"/v2/bank_account_lookups/{lookup_id}",
            duration_ms=int((time.perf_counter() - started) * 1000),
            request_body={"id": lookup_id},
            response_body=response,
        )
        return response

    async def create_customer_lookup(
        self, *, source_ref_id: str, phone_number: str, name: str, consent: dict[str, Any]
    ) -> dict[str, Any]:
        started = time.perf_counter()
        body = {
            "source_ref_id": source_ref_id,
            "phone_number": phone_number,
            "name": name,
            "consent": consent,
        }
        response = sandbox_customer_lookup_response(
            source_ref_id=source_ref_id, phone_number=phone_number, name=name
        )
        _STORE[response["id"]] = response
        log_zto_http(
            sandbox=True,
            method="POST",
            path="/v2/customer_data_lookups",
            duration_ms=int((time.perf_counter() - started) * 1000),
            request_body=body,
            response_body=response,
        )
        return response

    async def get_customer_lookup(self, lookup_id: str) -> dict[str, Any]:
        started = time.perf_counter()
        response = _STORE[lookup_id]
        log_zto_http(
            sandbox=True,
            method="GET",
            path=f"/v2/customer_data_lookups/{lookup_id}",
            duration_ms=int((time.perf_counter() - started) * 1000),
            request_body={"id": lookup_id},
            response_body=response,
        )
        return response
