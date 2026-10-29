"""Regression eval for Help Bot answer policy (no LLM calls)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.application.support.help_bot_answer_policy import pick_customer_reply, should_escalate_to_human
from app.application.support.help_bot_conversation_context import resolve_help_topics
from app.application.support.help_bot_types import BotDraft

_DEFAULT_PATH = (
    Path(__file__).resolve().parents[3] / "data" / "help-bot-training" / "eval" / "policy-regression.jsonl"
)


@dataclass(frozen=True)
class PolicyEvalResult:
    case_id: str
    ok: bool
    detail: str


def load_policy_regression_cases(path: Path | None = None) -> list[dict[str, Any]]:
    target = path or _DEFAULT_PATH
    rows: list[dict[str, Any]] = []
    with target.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def _contains_all(text: str, needles: list[str]) -> list[str]:
    lowered = text.lower()
    return [needle for needle in needles if needle.lower() not in lowered]


def _contains_any(text: str, needles: list[str]) -> bool:
    lowered = text.lower()
    return any(needle.lower() in lowered for needle in needles)


def evaluate_policy_case(case: dict[str, Any]) -> PolicyEvalResult:
    case_id = str(case.get("id") or "?")
    question = str(case.get("question") or "").strip()
    if not question:
        return PolicyEvalResult(case_id, False, "missing question")

    transcript = case.get("transcript") or []
    if not isinstance(transcript, list):
        transcript = []

    declared_topics = tuple(str(t) for t in (case.get("topics") or ["account"]))
    topics = resolve_help_topics(
        message_topics=declared_topics,
        transcript=transcript,
        latest_text=question,
    )

    must_topics = case.get("topics_must_include") or []
    for topic in must_topics:
        if topic not in topics:
            return PolicyEvalResult(
                case_id,
                False,
                f"expected topic {topic} in resolved {topics}",
            )

    pack = case.get("pack") or {}
    draft = BotDraft(
        can_answer=bool(case.get("llm_can_answer")),
        answer=str(case.get("llm_answer") or ""),
        needs_agent=bool(case.get("llm_needs_agent")),
    )
    reply = pick_customer_reply(
        question=question,
        pack=pack,
        topics=topics,
        draft=draft,
    )
    escalate, _reason = should_escalate_to_human(
        needs_human=bool(case.get("needs_human")),
        draft=draft,
        customer_reply=reply,
        llm_unavailable=bool(case.get("llm_unavailable")),
    )

    if case.get("expect_customer_reply") and not reply:
        return PolicyEvalResult(case_id, False, "expected customer reply, got none")
    if case.get("expect_escalate") is True and not escalate:
        return PolicyEvalResult(case_id, False, "expected escalation")
    if case.get("expect_escalate") is False and escalate:
        return PolicyEvalResult(case_id, False, f"unexpected escalation with reply={reply!r}")

    if reply:
        missing = _contains_all(reply, list(case.get("answer_must_contain") or []))
        if missing:
            return PolicyEvalResult(
                case_id,
                False,
                f"reply missing required phrases: {missing}; got: {reply[:200]}",
            )
        banned = list(case.get("answer_must_not_contain") or [])
        if banned and _contains_any(reply, banned):
            return PolicyEvalResult(case_id, False, f"reply contained banned phrase; got: {reply[:200]}")

    return PolicyEvalResult(case_id, True, "ok")


def run_policy_regression(path: Path | None = None) -> tuple[int, int, list[PolicyEvalResult]]:
    cases = load_policy_regression_cases(path)
    results = [evaluate_policy_case(case) for case in cases]
    passed = sum(1 for row in results if row.ok)
    return passed, len(results), results
