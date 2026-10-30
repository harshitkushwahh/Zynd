"""Conversation-aware topic and context selection for Help Bot."""

from __future__ import annotations

import re

from app.application.support.scope_gate import TOPICS

_TOPIC_TRANSCRIPT_HINTS: dict[str, re.Pattern[str]] = {
    "kyc": re.compile(r"\b(kyc|pan|aadhaar|digilocker|nominee|verif|address|adress|pata)\b", re.I),
    "payment": re.compile(
        r"\b(transaction|payment|sip|order|debit|failed|failure|refund|mandate|inr|₹)\b",
        re.I,
    ),
    "portfolio": re.compile(r"\b(portfolio|holding|nav|invested|units|folio)\b", re.I),
    "family": re.compile(r"\b(family|household|member)\b", re.I),
    "goals": re.compile(r"\b(goal|target amount|calculator)\b", re.I),
    "account": re.compile(
        r"\b(login|password|mfa|otp|email|phone|google|apple|linked|settings|profile|"
        r"pin|authenticator|backup|b[aou]*k[aou]*p|nominee|device|devices|session|sessions)\b",
        re.I,
    ),
    "referrals": re.compile(
        r"\b(referral|referrals|referal|referals|invite code|refer|kitne referral)\b",
        re.I,
    ),
    "risk_profile": re.compile(r"\b(risk profile|risk porfile|risk tier|risk score)\b", re.I),
    "reports": re.compile(r"\b(report|reports|statement|capital gains)\b", re.I),
}


def topics_from_transcript(transcript: list[dict[str, str]]) -> tuple[str, ...]:
    blob = " ".join((row.get("body") or "") for row in transcript[-8:])
    found = [topic for topic in TOPICS if _TOPIC_TRANSCRIPT_HINTS[topic].search(blob)]
    return tuple(found)


def resolve_help_topics(
    *,
    message_topics: tuple[str, ...],
    transcript: list[dict[str, str]],
    latest_text: str,
) -> tuple[str, ...]:
    """Merge classifier topics with what the thread is actually about."""
    merged: list[str] = list(message_topics)
    for topic in topics_from_transcript(transcript):
        if topic not in merged:
            merged.append(topic)
    for topic in TOPICS:
        if topic in merged:
            continue
        if _TOPIC_TRANSCRIPT_HINTS[topic].search(latest_text):
            merged.append(topic)
    if not merged:
        return ("account",)
    if "account" not in merged:
        merged.append("account")
    return tuple(merged)
