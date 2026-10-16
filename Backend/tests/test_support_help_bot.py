from app.application.support.ollama_client import OllamaError, parse_bot_draft
from app.application.support.scope_gate import classify_message


def test_world_question_is_out_of_scope() -> None:
    decision = classify_message("hey how is the world today")
    assert decision.in_scope is False
    assert decision.needs_human is False


def test_debited_payment_is_in_scope() -> None:
    decision = classify_message("my amount was debited but nothing is showing on my portfolio")
    assert decision.in_scope is True
    assert "payment" in decision.topics
    assert "portfolio" in decision.topics


def test_kyc_question_is_in_scope() -> None:
    decision = classify_message("what is the status of my kyc")
    assert decision.in_scope is True
    assert decision.primary_topic == "kyc"


def test_human_request_escalates_previous_topic() -> None:
    decision = classify_message("I want to talk to a human", previous_topics=("payment",))
    assert decision.in_scope is True
    assert decision.needs_human is True
    assert decision.topics == ("payment",)


def test_follow_up_keeps_previous_topic() -> None:
    decision = classify_message("yes what next", previous_topics=("goals",))
    assert decision.in_scope is True
    assert decision.topics == ("goals",)


def test_resolution_window_waits_24_hours() -> None:
    from datetime import datetime, timedelta, timezone

    from app.application.support.ticket_attachments import sniff_image_mime
    from app.application.support.ticket_service import resolution_window_elapsed

    now = datetime(2026, 10, 16, tzinfo=timezone.utc)
    prompted = now - timedelta(hours=23, minutes=59)
    assert resolution_window_elapsed(prompted, None, "pending", now=now) is False
    assert resolution_window_elapsed(now - timedelta(hours=24), None, "pending", now=now) is True
    assert resolution_window_elapsed(now - timedelta(days=2), "no", "pending", now=now) is False
    assert resolution_window_elapsed(now - timedelta(days=2), None, "resolved", now=now) is False
    assert sniff_image_mime(b"\x89PNG\r\n\x1a\nrest") == "image/png"
    assert sniff_image_mime(b"not-an-image") is None


def test_parse_bot_draft_requires_an_answer() -> None:
    draft = parse_bot_draft('{"can_answer": true, "answer": "Your KYC is submitted."}')
    assert draft.can_answer is True
    assert "KYC" in draft.answer


def test_parse_bot_draft_rejects_empty_answer() -> None:
    draft = parse_bot_draft('{"can_answer": true, "answer": "  "}')
    assert draft.can_answer is False


def test_parse_bot_draft_rejects_prose() -> None:
    try:
        parse_bot_draft("Sure, the weather is fine.")
    except OllamaError:
        return
    raise AssertionError("expected OllamaError")
