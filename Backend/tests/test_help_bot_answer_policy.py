from app.application.support.help_bot_answer_policy import pick_customer_reply, should_escalate_to_human
from app.application.support.help_bot_types import BotDraft


def test_pick_prefers_grounded_when_llm_refuses() -> None:
    pack = {
        "kyc": {"available": True, "overall_status": "completed", "completed_at": "2026-10-09T00:00:00+00:00"},
    }
    draft = BotDraft(can_answer=False, answer="Context does not include that.", needs_agent=False)
    reply = pick_customer_reply(
        question="when was my kyc completed",
        pack=pack,
        topics=("kyc", "account"),
        draft=draft,
    )
    assert reply is not None
    assert "2026-10-09" in reply or "completed" in reply.lower()


def test_no_escalate_when_customer_reply_exists() -> None:
    draft = BotDraft(can_answer=False, answer="internal", needs_agent=True)
    escalate, _ = should_escalate_to_human(
        needs_human=False,
        draft=draft,
        customer_reply="Your KYC completed on 2026-10-09.",
        llm_unavailable=False,
    )
    assert escalate is False


def test_escalate_when_human_requested_even_with_reply() -> None:
    draft = BotDraft(can_answer=True, answer="Here is your KYC status.", needs_agent=False)
    escalate, _ = should_escalate_to_human(
        needs_human=True,
        draft=draft,
        customer_reply="Your KYC completed on 2026-10-09.",
        llm_unavailable=False,
    )
    assert escalate is True


def test_escalate_when_no_reply_and_needs_agent() -> None:
    draft = BotDraft(can_answer=False, answer="", needs_agent=True)
    escalate, reason = should_escalate_to_human(
        needs_human=False,
        draft=draft,
        customer_reply=None,
        llm_unavailable=False,
    )
    assert escalate is True
    assert reason
