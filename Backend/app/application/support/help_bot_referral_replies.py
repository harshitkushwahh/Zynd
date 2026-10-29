"""Deterministic Help Bot answers for referral program questions."""

from __future__ import annotations

import re
from typing import Any

_REFERRAL_TOPIC = re.compile(
    r"\b(referral|referrals|referal|referals|invite code|referral code|refer and earn)\b|"
    r"\b(kitne|how many).{0,24}\b(refer|referral|referal|signups?)\b|"
    r"\bmer[ei]\s+(kitne\s+)?(referral|referal)\b",
    re.I,
)
_SIGNUPS = re.compile(
    r"\b(signups?|signed up|friends joined|referral count|kitne referral|kitne referal)\b",
    re.I,
)
_KYC_REFERRALS = re.compile(
    r"\b(referral.*kyc|kyc.*referral|referal.*kyc)\b",
    re.I,
)
_INVESTED_REFERRALS = re.compile(
    r"\b(referral.*invest|invest.*referral|first investment)\b",
    re.I,
)
_CLICKS = re.compile(r"\b(click|clicks|link open)\b", re.I)
_HAS_CODE = re.compile(r"\b(referral code|invite code|mera code|my code)\b", re.I)
_EDUCATIONAL = re.compile(
    r"\b(explain|smajao|samjhao|samjha|kya hai|what is|tell me about|matlab|meaning|help me understand)\b",
    re.I,
)
_SINGLE_TOPIC = re.compile(r"^(referral|referrals|referal|referals)[\s?.!]*$", re.I)
_COUNT = re.compile(r"\b(kitne|how many|count|total)\b", re.I)


def _referral_education(refs: dict[str, Any] | None) -> str:
    base = (
        "Zynd Refer & Earn lets you share an invite link or referral code. When friends sign up "
        "and complete steps like KYC and their first investment, rewards follow the program shown "
        "on Dashboard → Referrals — I won't guess payout amounts."
    )
    if refs is None:
        return base
    signups = int(refs.get("signup_count") or 0)
    if signups:
        return f"{base} You currently have {signups} referral signup(s) on your link."
    return base


def _referrals(pack: dict[str, Any]) -> dict[str, Any] | None:
    block = pack.get("referrals")
    return block if isinstance(block, dict) and block.get("available") else None


def try_referral_deterministic_reply(question: str, pack: dict[str, Any]) -> str | None:
    normalized = " ".join(question.strip().split())
    if not _REFERRAL_TOPIC.search(normalized):
        return None

    refs = _referrals(pack)
    wants_education = bool(_EDUCATIONAL.search(normalized) or _SINGLE_TOPIC.match(normalized))
    wants_count = bool(_COUNT.search(normalized) or _SIGNUPS.search(normalized))

    if wants_education and not wants_count:
        return _referral_education(refs)

    if refs is None:
        if wants_education:
            return _referral_education(None)
        return (
            "I couldn't load your referral stats right now. Open Dashboard → Referrals to see signups, "
            "KYC completions, and rewards."
        )

    signups = int(refs.get("signup_count") or 0)
    kyc_ok = int(refs.get("kyc_verified_count") or 0)
    invested = int(refs.get("first_investment_count") or 0)
    clicks = int(refs.get("click_count") or 0)
    has_code = bool(refs.get("has_code"))

    if _HAS_CODE.search(normalized) and not _SIGNUPS.search(normalized):
        if has_code:
            return "Yes — you have an active referral code on Zynd. Share it from Dashboard → Referrals."
        return "You don't have an active referral code yet. Open Dashboard → Referrals to create or view your link."

    if _CLICKS.search(normalized):
        return f"Your referral link has {clicks} click(s) on Zynd so far."

    if _KYC_REFERRALS.search(normalized):
        return f"{kyc_ok} of your referred friends have completed KYC on Zynd."

    if _INVESTED_REFERRALS.search(normalized):
        return f"{invested} of your referrals have made their first investment on Zynd."

    if _SIGNUPS.search(normalized) or (wants_count and _REFERRAL_TOPIC.search(normalized)):
        parts = [f"You have {signups} referral signup(s) on Zynd."]
        if kyc_ok or invested:
            parts.append(f"{kyc_ok} completed KYC and {invested} made a first investment.")
        parts.append("See the full breakdown under Dashboard → Referrals.")
        return " ".join(parts)

    if _REFERRAL_TOPIC.search(normalized):
        return _referral_education(refs)

    return None
