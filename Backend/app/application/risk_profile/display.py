"""Shared risk profile display helpers."""

from __future__ import annotations

from typing import Any

from app.infrastructure.persistence.risk_profile_models import RiskQuestion, RiskQuestionOption


def display_score(score: int) -> int:
    return max(0, min(100, round(score / 10)))


def split_tier_message(message_body: str) -> tuple[str, str]:
    separator_index = message_body.find(". ")
    if separator_index == -1:
        return message_body, ""
    return message_body[: separator_index + 1], message_body[separator_index + 2 :]


def _option_is_active(option: RiskQuestionOption) -> bool:
    value = getattr(option, "is_active", True)
    return True if value is None else bool(value)


def active_question_options(question: RiskQuestion) -> list[RiskQuestionOption]:
    return [option for option in question.options if _option_is_active(option)]


def build_answer_snapshot(question: RiskQuestion, option: RiskQuestionOption) -> dict[str, Any]:
    options = sorted(active_question_options(question), key=lambda row: row.sort_order)
    return {
        "question_prompt": question.prompt,
        "help_text": question.help_text,
        "category_name": question.category.name if question.category else None,
        "sort_order": question.sort_order,
        "selected_option_id": str(option.id),
        "selected_option_label": option.label,
        "options": [
            {
                "id": str(question_option.id),
                "label": question_option.label,
                "score_value": question_option.score_value,
                "sort_order": question_option.sort_order,
                "selected": question_option.id == option.id,
            }
            for question_option in options
        ],
    }


def answer_item_from_snapshot(*, question_id: str, snapshot: dict[str, Any]) -> dict[str, Any]:
    return {
        "question_id": question_id,
        "category_name": snapshot.get("category_name"),
        "prompt": snapshot.get("question_prompt") or "",
        "help_text": snapshot.get("help_text"),
        "sort_order": int(snapshot.get("sort_order") or 0),
        "selected_option_id": snapshot.get("selected_option_id") or "",
        "selected_option_label": snapshot.get("selected_option_label") or "",
        "options": snapshot.get("options") or [],
    }
