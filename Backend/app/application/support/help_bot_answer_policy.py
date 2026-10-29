"""Help Bot prompting and when to escalate vs keep helping."""

from __future__ import annotations

import json
import re
from typing import Any

from app.application.support.help_bot_facts_brief import build_customer_facts_brief
from app.application.support.help_bot_grounded_reply import try_grounded_account_reply
from app.application.support.help_bot_types import BotDraft
from app.application.support.playbooks_loader import playbooks_for

HELP_BOT_SYSTEM_PROMPT = """You are Zynd Help Bot — a calm, human support agent inside the Zynd investing app.
You speak to one customer at a time. Use ONLY the playbook, account facts, and conversation provided.
Never invent amounts, dates, order ids, or statuses.

Respond with JSON only:
{"can_answer": true or false, "needs_agent": true or false, "answer": "your reply to the customer"}

Rules for a natural, helpful reply:
- Write 1–4 short sentences in plain English (no bullet dumps unless listing 2–3 items).
- Answer the latest question first; use earlier messages for context (follow-ups like "why?" refer to the last topic).
- Explain payment failures in everyday language (bank/UPI timeout, insufficient balance, duplicate submit), not raw codes alone.
- If data is missing, say what you DO see and what the customer can do next in the app — still set can_answer true.
- Set needs_agent true ONLY for: explicit request for a human, legal/dispute/complaint needing staff, or data truly absent AND you cannot guide them.
- Set can_answer false ONLY when answer would be empty noise; prefer a useful partial answer with can_answer true.

The customer always sees "answer" when it is helpful — do not refuse account questions that are covered in the facts."""


_INTERNAL_REASON = re.compile(
    r"\b(context does not|not in the context|cannot confirm|no data|insufficient context|"
    r"account records do not|i don't have access)\b",
    re.I,
)


def build_help_bot_user_prompt(
    *,
    topics: tuple[str, ...],
    pack: dict[str, Any],
    examples: list[dict[str, str]],
    transcript: list[dict[str, str]],
    latest_question: str,
) -> str:
    brief = build_customer_facts_brief(pack)
    return (
        f"Playbook:\n{playbooks_for(topics)}\n\n"
        f"Account facts (summary):\n{brief}\n\n"
        f"Account facts (structured):\n{json.dumps(pack, default=str)[:4500]}\n\n"
        f"Approved example Q&A:\n{json.dumps(examples, default=str)[:1500]}\n\n"
        f"Conversation (oldest to newest):\n{json.dumps(transcript, default=str)[:2200]}\n\n"
        f"Latest customer message:\n{latest_question}"
    )


_WHY_QUESTION = re.compile(r"\b(why|how come|what happened|reason)\b", re.I)
_FOLLOW_UP_WHY_ONLY = re.compile(r"^why[\s?.!]*$", re.I)


def _looks_like_bullet_dump(text: str) -> bool:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if sum(1 for line in lines if line.startswith("-")) >= 2:
        return True
    return text.count(" - ") >= 2 or text.count("fp_") >= 2


def pick_customer_reply(
    *,
    question: str,
    pack: dict[str, Any],
    topics: tuple[str, ...],
    draft: BotDraft,
) -> str | None:
    """Choose the best customer-facing text from LLM + grounded context."""
    effective_question = question
    if _FOLLOW_UP_WHY_ONLY.match(question.strip()):
        if "payment" in topics:
            effective_question = "why did my payment fail"
        elif "kyc" in topics:
            effective_question = "why is my kyc blocked"

    grounded = try_grounded_account_reply(effective_question, pack, topics)
    answer = (draft.answer or "").strip()

    if grounded and _WHY_QUESTION.search(question) and answer and _looks_like_bullet_dump(answer):
        return grounded

    if draft.can_answer and answer and not _looks_internal_only(answer):
        if grounded and _WHY_QUESTION.search(question) and _looks_like_bullet_dump(answer):
            return grounded
        return answer

    if grounded:
        if answer and not _looks_internal_only(answer) and len(answer) > len(grounded):
            if _WHY_QUESTION.search(question) and _looks_like_bullet_dump(answer):
                return grounded
            return answer
        return grounded

    if answer and not _looks_internal_only(answer):
        return answer

    if grounded:
        return grounded

    if re.search(
        r"\b(risk profile|risk porfile|report|reports|nominee|zynd pin|pin reset|mfa|authenticator|"
        r"b[aou]*k[aou]*p|backup code|google|cart|risk tier|referral|referal|kitne referral|portfolio|porotlfio|"
        r"address|adress|pata|device|devices|session|sessions|smajao|kya hai)\b",
        question,
        re.I,
    ):
        grounded_only = try_grounded_account_reply(question, pack, topics)
        if grounded_only:
            return grounded_only
        return None

    brief = build_customer_facts_brief(pack)
    if brief and "No live account" not in brief:
        if re.search(r"\b(overview|summary|status|what do you know|account snapshot)\b", question, re.I):
            return (
                f"I pulled your latest Zynd account snapshot: {brief} "
                "Tell me which part you want to dig into (KYC, a payment, portfolio, settings, risk profile, or reports)."
            )
    return None


def should_escalate_to_human(
    *,
    needs_human: bool,
    draft: BotDraft,
    customer_reply: str | None,
    llm_unavailable: bool,
) -> tuple[bool, str]:
    if needs_human:
        return True, "Customer asked to speak with a person."
    if customer_reply:
        return False, ""
    if llm_unavailable:
        return True, "Zynd Help Bot could not reach the model."
    if draft.needs_agent and (draft.answer or "").strip():
        return True, (draft.answer or "Agent follow-up required.")[:500]
    return True, (draft.answer or "The account records do not answer this question.")[:500]


def _looks_internal_only(text: str) -> bool:
    stripped = text.strip()
    if len(stripped) < 8:
        return True
    if _INTERNAL_REASON.search(stripped) and len(stripped) < 120:
        return True
    return False
