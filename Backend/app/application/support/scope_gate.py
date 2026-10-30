"""Decide whether a customer message is about Zynd, and which modules it touches."""

from __future__ import annotations

import re
from dataclasses import dataclass

TOPICS = ("kyc", "payment", "portfolio", "family", "goals", "account", "referrals", "risk_profile", "reports")

BOT_NAME = "Zynd Help Bot"
OUT_OF_SCOPE_REPLY = (
    "I can only help with your Zynd account KYC, payments, portfolio, goals, "
    "family groups, settings, risk profile, reports, and referrals."
)

_TOPIC_PATTERNS: dict[str, re.Pattern[str]] = {
    "kyc": re.compile(
        r"\b(kyc|pan|aadhaar|aadhar|digilocker|e-?sign|nominee|ckyc|verif(?:y|ication|ied)|"
        r"kyc completed|kyc approved|submitted|under review|"
        r"address|adress|addres|pata|pincode|postal code)\b|"
        r"\b(mera|meri|mer|mere)\s+(address|adress|pata)\b",
        re.I,
    ),
    "payment": re.compile(
        r"\b(payment|payments|debit|debited|deduct(?:ed|ion)?|charged|charge|installment|"
        r"order|orders|sip|sips|mandate|transaction|transactions|refund|upi|netbanking|"
        r"failed|failure|declin(?:ed|e)|amount|rupees|inr|₹|autopay|auto-?pay|cart)\b",
        re.I,
    ),
    "portfolio": re.compile(
        r"\b(portfolio|portfoilo|porotlfio|protfolio|portfilio|holding|holdings|folio|units|nav|"
        r"allot|allotted|invested|aum)\b",
        re.I,
    ),
    "family": re.compile(r"\b(family|families|household)\b", re.I),
    "goals": re.compile(r"\b(goal|goals|calculator|target amount|sip calculator)\b", re.I),
    "account": re.compile(
        r"\b(setting|settings|password|mfa|otp|login|log in|sign in|sign-?in|account|profile|"
        r"email|phone|google|apple|oauth|social|linked|link(?:ed)?|connect(?:ed)?|"
        r"disconnect(?:ed)?|authenticator|backup codes?|b[aou]*k[aou]*p codes?|recovery codes?|"
        r"zynd pin|pin reset|nominee|device|devices|session|sessions|logged in|log(?:ged|)? in)\b|"
        r"\bkitne\s+(device|devices|phone|mobile|session|sessions)\b",
        re.I,
    ),
    "referrals": re.compile(
        r"\b(referral|referrals|referal|referals|refer and earn|invite code|referral code)\b|"
        r"\bmer[ei]\s+(kitne\s+)?(referral|referal)\b|"
        r"\bkitne\s+(referral|referal|referrals)\b|"
        r"\b(referral|referal|referrals).{0,20}\b(kya hai|smajao|samjhao|samjha|explain|matlab)\b|"
        r"\b(kya hai|smajao|samjhao|samjha|explain|matlab).{0,20}\b(referral|referal|referrals)\b",
        re.I,
    ),
    "risk_profile": re.compile(
        r"\b(risk profile|risk porfile|risk assessment|risk tier|risk score)\b",
        re.I,
    ),
    "reports": re.compile(
        r"\b(report|reports|statement|capital gains|account statement|tax report)\b",
        re.I,
    ),
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
    r"tell me more|why|how|what about that|same issue|smajao|samjhao|samjha|explain)[\s?.!]*$",
    re.I,
)

_EDUCATIONAL = re.compile(
    r"\b(explain|smajao|samjhao|samjha|kya hai|what is|tell me about|matlab|meaning)\b",
    re.I,
)

_FUZZY_TOPIC_HINTS: dict[str, re.Pattern[str]] = {
    "referrals": re.compile(r"referr?a?ls?|refer and earn|invite code", re.I),
    "portfolio": re.compile(r"portfo\w*|porotlf\w*|protfolio|holdings?", re.I),
    "kyc": re.compile(r"\bkyc\b|pan card|aadhaar|address|adress|pata", re.I),
    "payment": re.compile(r"\bsip\b|payment|mandate|transaction", re.I),
    "goals": re.compile(r"\bgoals?\b", re.I),
    "account": re.compile(
        r"zynd pin|settings|mfa|nominee|b[aou]*k[aou]*p|backup|device|session|kitne device",
        re.I,
    ),
    "risk_profile": re.compile(r"risk profile|risk tier", re.I),
    "reports": re.compile(r"\breports?\b|statement", re.I),
    "family": re.compile(r"family group", re.I),
}

_GREETING = re.compile(
    r"^(hi|hello|hey|hiya|yo|whats up|what's up|sup|good (morning|afternoon|evening)|"
    r"how are you|howdy)[\s?.!]*$",
    re.I,
)

# Natural-language account questions (typed free-form, not quick-reply chips).
_PERSONAL_ACCOUNT_QUESTION = re.compile(
    r"(?:"
    r"\b(?:when|what|where|why|how|is|are|was|were|did|does|do|can|could|will|would|should|tell me|check|show)\b"
    r".*\b(?:my|me|i|i'm|i've|i'd)\b"
    r"|"
    r"\b(?:my|me|i)\b.*\b(?:when|what|where|why|how|status|last|latest|recent|today|yesterday|date|time)\b"
    r")",
    re.I,
)

_DEFAULT_NL_TOPICS: tuple[str, ...] = ("kyc", "payment", "account")


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

    if not found and _EDUCATIONAL.search(normalized):
        for topic in TOPICS:
            if _FUZZY_TOPIC_HINTS[topic].search(normalized):
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

    if (
        word_count <= 32
        and _PERSONAL_ACCOUNT_QUESTION.search(normalized)
        and not _OFF_TOPIC.search(normalized)
    ):
        return ScopeDecision(
            in_scope=True,
            topics=_DEFAULT_NL_TOPICS,
            needs_human=needs_human,
        )

    return ScopeDecision(in_scope=False, topics=(), needs_human=False)
