from __future__ import annotations

SEBI_CATEGORY_TO_SLUG: dict[str, str] = {
    "equity": "equity-funds",
    "debt": "debt-funds",
    "hybrid": "hybrid-funds",
    "solution oriented": "hybrid-funds",
    "elss": "elss-tax-saving",
    "index": "index-funds",
    "liquid": "liquid-funds",
    "other": "hybrid-funds",
}


def category_slug_for_sebi(sebi_category: str | None) -> str:
    if not sebi_category:
        return "equity-funds"
    lowered = sebi_category.lower()
    for key, slug in SEBI_CATEGORY_TO_SLUG.items():
        if key in lowered:
            return slug
    if "tax" in lowered or "elss" in lowered:
        return "elss-tax-saving"
    if "liquid" in lowered or "overnight" in lowered:
        return "liquid-funds"
    if "debt" in lowered or "bond" in lowered or " gilt" in lowered:
        return "debt-funds"
    if "hybrid" in lowered or "balanced" in lowered or "multi asset" in lowered:
        return "hybrid-funds"
    if "index" in lowered:
        return "index-funds"
    return "equity-funds"


def should_exclude_from_catalog(*, scheme_name: str, plan_type: str | None) -> bool:
    name = scheme_name.lower()
    if plan_type and plan_type.lower() == "direct":
        return True
    if "direct plan" in name or " - direct" in name:
        return True
    if "idcw" in name or "dividend" in name:
        return True
    if "etf" in name and "fund of fund" not in name:
        return True
    return False
