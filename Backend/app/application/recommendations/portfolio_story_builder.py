from __future__ import annotations

from typing import Any

from app.infrastructure.persistence.recommendation_models import RecommendationBasket
from app.infrastructure.persistence.risk_profile_models import RiskTier

_TIER_WHY_FALLBACK: dict[str, str] = {
    RiskTier.secure.value: "This mix prioritizes capital stability with a defensive allocation suited to a Secure risk profile.",
    RiskTier.conservative.value: "This mix leans toward stability with meaningful debt exposure while keeping some equity for long-term growth.",
    RiskTier.moderate.value: "This mix balances equity growth with debt stability for a Moderate risk profile.",
    RiskTier.growth.value: "This mix emphasizes equity growth while keeping diversification across asset classes.",
    RiskTier.aggressive.value: "This mix is tilted toward equity growth for investors comfortable with higher volatility.",
}


def _mix_summary(allocation_slices: list[dict[str, Any]]) -> str:
    parts = [
        f"{slice_row.get('label', '').strip()} {float(slice_row.get('value_pct') or 0):g}%"
        for slice_row in allocation_slices
        if slice_row.get("label")
    ]
    return " · ".join(parts)


def build_portfolio_story(
    *,
    basket: RecommendationBasket,
    tier: str | None,
    allocation_slices: list[dict[str, Any]],
) -> dict[str, str | None]:
    display_name = (basket.portfolio_display_name or basket.name or basket.slug or "").strip() or None
    mix_summary = _mix_summary(allocation_slices) or None
    why_this_mix = (
        (basket.objective_summary or "").strip()
        or (basket.description or "").strip()
        or _TIER_WHY_FALLBACK.get(str(tier or "").lower(), "")
        or None
    )
    basket_objective = (basket.description or "").strip() or None

    return {
        "display_name": display_name,
        "mix_summary": mix_summary,
        "why_this_mix": why_this_mix,
        "basket_objective": basket_objective,
    }
