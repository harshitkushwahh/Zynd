from __future__ import annotations


def finprim_partner_url_is_production(url: str | None) -> bool:
    if not url:
        return False
    lower = url.strip().lower()
    if "s.finprim.com" in lower:
        return False
    return "api.fintechprimitives.com" in lower or "fintechprimitives.com/v2/esigns" in lower
