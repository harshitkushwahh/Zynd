"""Decide whether a customer message is about Zynd, and which modules it touches."""

from __future__ import annotations

import re
from dataclasses import dataclass

TOPICS = ("kyc", "payment", "portfolio", "family", "goals", "account", "referrals")

BOT_NAME = "Zynd Help Bot"
OUT_OF_SCOPE_REPLY = (
    "I can only help with your Zynd account KYC, payments, portfolio, goals, "
    "family groups, settings, and referrals."
)

_TOPIC_PATTERNS: dict[str, re.Pattern[str]] = {
    "kyc": re.compile(
        r"\b(kyc|pan|aadhaar|aadhar|digilocker|e-?sign|nominee|ckyc|verification)\b",
        re.I,
    ),
    "payment": re.compile(
        r"\b(payment|payments|debit|debited|order|orders|sip|mandate|transaction|"
        r"transactions|refund|upi|netbanking|failed|failure|amount|rupees|inr|₹)\b",
        re.I,
    ),
    "portfolio": re.compile(
        r"\b(portfolio|holding|holdings|folio|units|nav|allot|allotted|invested|aum)\b",
        re.I,
    ),
    "family": re.compile(r"\b(family|families|household)\b", re.I),
    "goals": re.compile(r"\b(goal|goals|calculator|target amount|sip calculator)\b", re.I),
    "account": re.compile(
        r"\b(setting|settings|password|mfa|otp|login|log in|sign in|account|profile|email|phone)\b",
        re.I,
    ),
    "referrals": re.compile(r"\b(referral|referrals|refer|invite code|referral code)\b", re.I),
}

_HUMAN_REQUEST = re.compile(
    r"\b(human|real person|real agent|talk to (a |an )?(person|agent|someone)|"
    r"customer support agent|speak to (a |an )?(person|agent|someone)|escalate)\b",
    re.I,
)

_OFF_TOPIC = re.compile(
    r"\b(weather|world today|news|sports|cricket|football|politics|politician|"
    r"joke|recipe|movie|song|president|capital of|who won|stock tip|bitcoin|"
    r"crypto|chatgpt|write (me )?a poem)\b",
    re.I,
)

_FOLLOW_UP = re.compile(
    r"^(yes|no|ok|okay|thanks|thank you|and|what next|then|continue|go on|"
    r"tell me more|why|how|what about that|same issue)[\s?.!]*$",
    re.I,
)

_GREETING = re.compile(
    r"^(hi|hello|hey|hiya|yo|whats up|what's up|sup|good (morning|afternoon|evening)|"
    r"how are you|howdy)[\s?.!]*$",
    re.I,
)


@dataclass(frozen=True)
class ScopeDecision:
    in_scope: bool
    topics: tuple[str, ...]
    needs_human: bool

    @property
    def primary_topic(self) -> str:
        return self.topics[0] if self.topics else "other"


def classify_message(text: str, *, previous_topics: tuple[str, ...] = ()) -> ScopeDecision:
    normalized = " ".join(text.strip().split())
    if not normalized:
        return ScopeDecision(in_scope=False, topics=(), needs_human=False)

    needs_human = _HUMAN_REQUEST.search(normalized) is not None
    if _GREETING.match(normalized):
        return ScopeDecision(in_scope=True, topics=("account",), needs_human=needs_human)

    found: list[str] = []
    for topic in TOPICS:
        if _TOPIC_PATTERNS[topic].search(normalized):
            found.append(topic)

    if found:
        return ScopeDecision(in_scope=True, topics=tuple(found), needs_human=needs_human)

    if needs_human:
        topics = previous_topics or ("other",)
        return ScopeDecision(in_scope=True, topics=topics, needs_human=True)

    if _OFF_TOPIC.search(normalized):
        return ScopeDecision(in_scope=False, topics=(), needs_human=False)

    word_count = len(normalized.split())
    if previous_topics and (word_count <= 12 or _FOLLOW_UP.match(normalized)):
        return ScopeDecision(in_scope=True, topics=previous_topics, needs_human=False)

    return ScopeDecision(in_scope=False, topics=(), needs_human=False)
