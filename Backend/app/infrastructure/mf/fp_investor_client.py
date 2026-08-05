"""Finprim v2 investor profile + child object API client (MF tenant)."""

from __future__ import annotations

from typing import Any

from app.infrastructure.mf.fp_oms_client import extract_fp_id, extract_fp_old_id, fp_mf_patch, fp_mf_post


async def create_investor_profile(body: dict[str, Any]) -> dict[str, Any]:
    payload = await fp_mf_post("/v2/investor_profiles", body=body)
    return {
        "id": extract_fp_id(payload),
        "old_id": extract_fp_old_id(payload),
        "raw": payload,
    }


async def create_bank_account(body: dict[str, Any]) -> dict[str, Any]:
    payload = await fp_mf_post("/v2/bank_accounts", body=body)
    return {
        "id": extract_fp_id(payload),
        "old_id": extract_fp_old_id(payload),
        "raw": payload,
    }


async def create_address(body: dict[str, Any]) -> dict[str, Any]:
    payload = await fp_mf_post("/v2/addresses", body=body)
    return {"id": extract_fp_id(payload), "raw": payload}


async def create_email_address(body: dict[str, Any]) -> dict[str, Any]:
    payload = await fp_mf_post("/v2/email_addresses", body=body)
    return {"id": extract_fp_id(payload), "raw": payload}


async def create_phone_number(body: dict[str, Any]) -> dict[str, Any]:
    payload = await fp_mf_post("/v2/phone_numbers", body=body)
    return {"id": extract_fp_id(payload), "raw": payload}


async def patch_related_party(body: dict[str, Any]) -> dict[str, Any]:
    payload = await fp_mf_patch("/v2/related_parties", body=body)
    return {"id": extract_fp_id(payload), "raw": payload}


async def create_related_party(body: dict[str, Any]) -> dict[str, Any]:
    payload = await fp_mf_post("/v2/related_parties", body=body)
    return {"id": extract_fp_id(payload), "raw": payload}
