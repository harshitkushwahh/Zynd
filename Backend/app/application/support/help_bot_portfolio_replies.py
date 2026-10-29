"""Deterministic Help Bot answers for portfolio questions (including typos)."""

from __future__ import annotations

import re
from typing import Any

_PORTFOLIO_TOPIC = re.compile(
    r"\b(portfolio|portfoilo|porotlfio|protfolio|portfilio|holdings?|folio|nav|units)\b",
    re.I,
)
_EDUCATIONAL = re.compile(
    r"\b(explain|smajao|samjhao|samjha|kya hai|what is|tell me about|matlab|meaning|help me understand)\b",
    re.I,
)
_SINGLE_TOPIC = re.compile(
    r"^(portfolio|portfoilo|porotlfio|protfolio|holdings?)[\s?.!]*$",
    re.I,
)


def _portfolio(pack: dict[str, Any]) -> dict[str, Any] | None:
    block = pack.get("portfolio")
    return block if isinstance(block, dict) and block.get("available") else None


def _education_with_optional_stats(port: dict[str, Any] | None) -> str:
    base = (
        "Your Zynd portfolio is your live mutual fund holdings — invested amount, current value, "
        "units, and returns. Open Dashboard → Portfolio to see each fund and folio."
    )
    if port is None:
        return base
    value = port.get("current_value")
    invested = port.get("invested")
    count = port.get("holdings_count")
    if value or invested:
        extra = []
        if value:
            extra.append(f"current value {value}")
        if invested:
            extra.append(f"invested {invested}")
        if count is not None:
            extra.append(f"{count} holding(s)")
        return f"{base} From your account right now: {', '.join(extra)}."
    return base


def try_portfolio_deterministic_reply(question: str, pack: dict[str, Any]) -> str | None:
    normalized = " ".join(question.strip().split())
    if not _PORTFOLIO_TOPIC.search(normalized):
        return None

    port = _portfolio(pack)
    wants_education = bool(_EDUCATIONAL.search(normalized) or _SINGLE_TOPIC.match(normalized))

    if wants_education:
        return _education_with_optional_stats(port)

    if port is None:
        return (
            "I couldn't refresh your portfolio numbers just now. Open Dashboard → Portfolio "
            "for holdings and current value."
        )

    value = port.get("current_value")
    invested = port.get("invested")
    count = port.get("holdings_count")
    as_on = port.get("as_on")
    parts = ["From your Zynd portfolio"]
    if value:
        parts.append(f"current value is {value}")
    if invested:
        parts.append(f"you have invested {invested}")
    if count is not None:
        parts.append(f"across {count} holding(s)")
    if as_on:
        parts.append(f"as of {as_on}")
    return ", ".join(parts) + "."

