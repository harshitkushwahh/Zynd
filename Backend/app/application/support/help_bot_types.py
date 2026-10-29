from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BotDraft:
    can_answer: bool
    answer: str
    needs_agent: bool = False
