"""Deterministic Help Bot answers for KYC address questions (not portfolio)."""

from __future__ import annotations

import re
from typing import Any

_ADDRESS_QUESTION = re.compile(
    r"\b(address|adress|addres|pata|pincode|postal|zip code)\b|"
    r"\b(mera|meri|mer|mere)\s+(address|adress|pata)\b",
    re.I,
)
_NOT_RESIDENTIAL_ADDRESS = re.compile(
    r"\b(portfolio|holding|holdings|folio|nav|units|email address|e-?mail address)\b",
    re.I,
)


def _kyc(pack: dict[str, Any]) -> dict[str, Any] | None:
    block = pack.get("kyc")
    return block if isinstance(block, dict) and block.get("available") else None


def try_kyc_address_deterministic_reply(question: str, pack: dict[str, Any]) -> str | None:
    normalized = " ".join(question.strip().split())
    if not normalized or _NOT_RESIDENTIAL_ADDRESS.search(normalized):
        return None
    if not _ADDRESS_QUESTION.search(normalized):
        return None

    kyc = _kyc(pack)
    residential = kyc.get("residential_address") if kyc else None
    step_status = None
    steps = kyc.get("steps") if kyc else None
    if isinstance(steps, dict):
        step_status = steps.get("address")

    location_bits: list[str] = []
    if isinstance(residential, dict) and residential.get("on_file"):
        city = (residential.get("city") or "").strip()
        state = (residential.get("state") or "").strip()
        postal = (residential.get("postal_code") or "").strip()
        country = (residential.get("country") or "IN").strip()
        if city and state and postal:
            location_bits.append(f"{city}, {state} {postal}, {country}")
        elif city and postal:
            location_bits.append(f"{city} {postal}, {country}")
        elif postal:
            location_bits.append(f"PIN {postal}, {country}")

    parts: list[str] = []
    if location_bits:
        parts.append(f"Your registered residential address on Zynd is {location_bits[0]}.")
    elif step_status:
        parts.append(f"Your KYC address proof step is {step_status}.")
    else:
        parts.append(
            "I don't see a saved residential address in your Zynd profile yet. "
            "Complete or review the address step under Complete KYC."
        )

    if step_status and location_bits:
        parts.append(f"KYC address proof step status: {step_status}.")

    parts.append("To update your address, use Complete KYC or Settings if your profile allows edits.")
    return " ".join(parts)
