"""Account-grounded replies from live context (all topics, not only payments)."""

from __future__ import annotations

import re
from typing import Any

from app.application.support.help_bot_field_catalog import CATALOG, FieldSpec
from app.application.support.help_bot_kyc_replies import try_kyc_address_deterministic_reply
from app.application.support.help_bot_module_replies import try_module_deterministic_reply
from app.application.support.help_bot_payment_replies import try_payment_deterministic_reply
from app.application.support.help_bot_portfolio_replies import try_portfolio_deterministic_reply
from app.application.support.help_bot_referral_replies import try_referral_deterministic_reply
from app.application.support.training_loader import _tokens

_STATUS_QUESTION = re.compile(
    r"\b(status|what'?s happening|where am i|where do i stand)\b",
    re.I,
)

_PREFER_GROUNDED_WITHOUT_LLM = re.compile(
    r"\b(smajao|samjhao|samjha|kya hai|explain|matlab|porotlfio|portfoilo|protfolio|"
    r"referal|referrals|kitne referral|kitne referal|zynd pin|"
    r"b[aou]*k[aou]*p|backup codes?|address|adress|pata|device|devices|session|sessions|kitne device)\b",
    re.I,
)

_BLOCK_WEAK_FIELD_DUMP = re.compile(
    r"\b(b[aou]*k[aou]*p|backup|address|adress|pata|device|devices|session|sessions|login hu|logged in)\b",
    re.I,
)


def should_answer_without_llm(question: str) -> bool:
    """High-confidence deterministic paths — skip LLM to avoid refusal or out-of-scope tone."""
    normalized = " ".join(question.strip().split())
    return bool(_PREFER_GROUNDED_WITHOUT_LLM.search(normalized))


def _get_nested(pack: dict[str, Any], path: str) -> Any:
    parts = path.split(".")
    if not parts:
        return None
    root = parts[0]
    key_map = {"payment": "payments", "family": "family_groups"}
    node: Any = pack.get(key_map.get(root, root))
    if not isinstance(node, dict) or not node.get("available"):
        return None
    for part in parts[1:]:
        if not isinstance(node, dict):
            return None
        node = node.get(part)
    return node


def _score_field(question: str, spec: FieldSpec) -> float:
    q = _tokens(question)
    if not q:
        return 0.0
    best = 0.0
    for hint in spec.question_hints:
        h = _tokens(hint)
        if not h:
            continue
        overlap = len(q & h) / max(len(q | h), 1)
        best = max(best, overlap)
    label_tokens = _tokens(spec.label)
    best = max(best, len(q & label_tokens) / max(len(q), 1) * 0.85)
    return best


def _format_value(spec: FieldSpec, value: Any) -> str | None:
    if value is None:
        return None
    if spec.value_type == "bool":
        return "yes" if value else "no"
    if spec.value_type == "list":
        if not isinstance(value, list) or not value:
            return None
        return f"{len(value)} on your account"
    if isinstance(value, (str, int, float)):
        text = str(value).strip()
        return text[:240] if text else None
    return None


def _reply_from_top_fields(question: str, pack: dict[str, Any], topics: tuple[str, ...]) -> str | None:
    if _BLOCK_WEAK_FIELD_DUMP.search(question):
        return None
    topic_set = set(topics)
    ranked: list[tuple[float, FieldSpec, Any]] = []
    for spec in CATALOG:
        if spec.topic not in topic_set and spec.topic != "account":
            continue
        score = _score_field(question, spec)
        if score < 0.12:
            continue
        value = _get_nested(pack, spec.path)
        formatted = _format_value(spec, value)
        if formatted is None:
            continue
        ranked.append((score, spec, formatted))
    ranked.sort(key=lambda row: (-row[0], row[1].path))
    if not ranked:
        return None
    top = ranked[:3]
    parts = [f"{spec.label}: {formatted}." for _, spec, formatted in top]
    return "From your Zynd account — " + " ".join(parts)


def _general_status_reply(pack: dict[str, Any], topics: tuple[str, ...]) -> str | None:
    chunks: list[str] = []
    if "kyc" in topics:
        kyc = pack.get("kyc")
        if isinstance(kyc, dict) and kyc.get("available"):
            chunks.append(f"KYC is {kyc.get('overall_status') or 'in progress'}.")
    if "payment" in topics:
        pay = pack.get("payments")
        if isinstance(pay, dict) and pay.get("available"):
            ok = len(pay.get("recent_successful_orders") or [])
            bad = len(pay.get("recent_failed_orders") or [])
            chunks.append(f"Recent payments show {ok} completed and {bad} failed orders.")
    if "portfolio" in topics:
        port = pack.get("portfolio")
        if isinstance(port, dict) and port.get("available"):
            chunks.append(
                f"Portfolio is {port.get('current_value') or 'updating'} "
                f"across {port.get('holdings_count') or 0} holdings."
            )
    if not chunks:
        return None
    return " ".join(chunks)


def try_grounded_account_reply(
    question: str,
    pack: dict[str, Any],
    topics: tuple[str, ...],
) -> str | None:
    """Best-effort answer strictly from the context pack."""
    payment = try_payment_deterministic_reply(question, pack)
    if payment:
        return payment

    module = try_module_deterministic_reply(question, pack, topics)
    if module:
        return module

    address = try_kyc_address_deterministic_reply(question, pack)
    if address:
        return address

    referral = try_referral_deterministic_reply(question, pack)
    if referral:
        return referral

    portfolio = try_portfolio_deterministic_reply(question, pack)
    if portfolio:
        return portfolio

    normalized = " ".join(question.strip().split())
    if re.search(r"\bgoal", normalized, re.I):
        goals_block = pack.get("goals")
        if isinstance(goals_block, dict) and goals_block.get("available"):
            items = goals_block.get("goals") or []
            if items:
                titles = ", ".join(str(row.get("title") or "Goal") for row in items[:3])
                return f"You have {len(items)} goal(s) on Zynd: {titles}."

    if _STATUS_QUESTION.search(normalized):
        status = _general_status_reply(pack, topics)
        if status:
            return status

    field_reply = _reply_from_top_fields(normalized, pack, topics)
    if field_reply:
        return field_reply

    return None
