from __future__ import annotations

CALCULATOR_HORIZONS: dict[str, int] = {
    "3m": 90,
    "6m": 180,
    "1y": 365,
    "3y": 365 * 3,
    "5y": 365 * 5,
}

STAMP_DUTY_PCT = 0.005


def tax_notes_for_fund(*, sebi_category: str | None, option_type: str | None) -> dict:
    category = (sebi_category or "").lower()
    sections: list[dict[str, str]] = []

    if "equity" in category or "elss" in category:
        sections.append(
            {
                "title": "Equity taxation (post Budget 2024)",
                "body": (
                    "Long-term capital gains above ₹1.25 lakh per year are taxed at 12.5%. "
                    "Short-term gains (held ≤12 months) are taxed at 20%. "
                    "Tax rates apply to growth option redemptions; consult your tax advisor."
                ),
            }
        )
    elif "debt" in category or "liquid" in category or "overnight" in category:
        sections.append(
            {
                "title": "Debt fund taxation",
                "body": (
                    "Capital gains on debt mutual funds are taxed per your income slab regardless of holding period "
                    "for units purchased after 1 April 2023. Indexation benefits may apply to older holdings."
                ),
            }
        )
    else:
        sections.append(
            {
                "title": "Tax implication",
                "body": (
                    "Tax treatment depends on the underlying asset allocation and holding period. "
                    "Please read the scheme information document and consult a tax advisor."
                ),
            }
        )

    if "elss" in category:
        sections.append(
            {
                "title": "ELSS lock-in",
                "body": "ELSS schemes have a statutory lock-in of 3 years from the date of investment.",
            }
        )

    return {
        "summary": sections[0]["body"] if sections else None,
        "sections": sections,
        "stamp_duty_note": (
            f"Stamp duty on investment: {STAMP_DUTY_PCT}% (applicable from 1 July 2020 on mutual fund purchases)."
        ),
    }
