from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.application.support import ollama_client
from app.application.support.ollama_client import (
    OllamaError,
    _assistant_text,
    check_llm_ready,
    complete_help_reply,
    parse_bot_draft,
)
from app.core.config import get_settings
from app.application.support.scope_gate import classify_message
from app.application.support.training_loader import similar_training_examples


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


def test_natural_kyc_completion_question_is_in_scope() -> None:
    decision = classify_message("when was my kyc completed")
    assert decision.in_scope is True
    assert "kyc" in decision.topics


def test_natural_sip_deduction_question_is_in_scope() -> None:
    decision = classify_message("when was my last sip payment deducted")
    assert decision.in_scope is True
    assert "payment" in decision.topics


def test_google_link_question_is_in_scope() -> None:
    decision = classify_message("is my google account linked")
    assert decision.in_scope is True
    assert "account" in decision.topics


def test_sip_failed_nl_question_is_in_scope() -> None:
    decision = classify_message("when did my sip fail")
    assert decision.in_scope is True
    assert "payment" in decision.topics


def test_training_corpus_matches_google_link_question() -> None:
    hits = similar_training_examples("is my google account linked", ("account",), limit=1)
    assert hits
    assert "google" in hits[0]["question"].lower()


def test_human_request_escalates_previous_topic() -> None:
    decision = classify_message("I want to talk to a human", previous_topics=("payment",))
    assert decision.in_scope is True
    assert decision.needs_human is True
    assert decision.topics == ("payment",)


def test_follow_up_keeps_previous_topic() -> None:
    decision = classify_message("yes what next", previous_topics=("goals",))
    assert decision.in_scope is True
    assert decision.topics == ("goals",)


def test_referral_hinglish_education_in_scope() -> None:
    for q in ("referal smajao", "referals kya hai", "referal"):
        decision = classify_message(q)
        assert decision.in_scope is True, q
        assert "referrals" in decision.topics, q


def test_portfolio_typo_explain_in_scope() -> None:
    decision = classify_message("porotlfio explain")
    assert decision.in_scope is True
    assert "portfolio" in decision.topics


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


def test_assistant_text_prefers_content_then_thinking() -> None:
    assert _assistant_text({"content": '{"can_answer": true}', "thinking": "ignored"}) == (
        '{"can_answer": true}'
    )
    assert _assistant_text({"content": "", "thinking": '{"can_answer": false}'}) == (
        '{"can_answer": false}'
    )


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


def _reset_llm_probe() -> None:
    ollama_client._llm_probe.clear()
    ollama_client._llm_probe.update({"checked_at": 0.0, "ok": False, "model": "", "provider": ""})


@pytest.fixture
def groq_env(monkeypatch: pytest.MonkeyPatch):
    from app.core import config

    config.get_settings.cache_clear()
    monkeypatch.setenv("SUPPORT_LLM_PROVIDER", "groq")
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test_key")
    monkeypatch.setenv("GROQ_MODEL", "openai/gpt-oss-120b")
    config.get_settings.cache_clear()
    _reset_llm_probe()
    yield
    config.get_settings.cache_clear()
    _reset_llm_probe()


@pytest.mark.asyncio
async def test_check_llm_ready_groq_without_key(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import config

    config.get_settings.cache_clear()
    monkeypatch.setenv("SUPPORT_LLM_PROVIDER", "groq")
    monkeypatch.setenv("GROQ_API_KEY", "")
    config.get_settings.cache_clear()
    _reset_llm_probe()

    ready, model = await check_llm_ready()
    assert ready is False
    assert model == get_settings().groq_model


@pytest.mark.asyncio
async def test_complete_help_reply_groq_success(groq_env: None) -> None:
    payload = {"choices": [{"message": {"content": '{"can_answer": true, "answer": "Hello from Groq."}'}}]}
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = payload
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.application.support.ollama_client.httpx.AsyncClient", return_value=mock_client):
        draft = await complete_help_reply(system_prompt="sys", user_prompt="user question")

    assert draft.can_answer is True
    assert "Groq" in draft.answer
    mock_client.post.assert_awaited_once()
    call_args = mock_client.post.await_args
    assert call_args is not None
    url = call_args.args[0] if call_args.args else call_args.kwargs.get("url", "")
    assert "chat/completions" in url


@pytest.mark.asyncio
async def test_complete_help_reply_groq_http_error(groq_env: None) -> None:
    import httpx

    mock_response = MagicMock()
    mock_response.status_code = 503
    mock_response.text = "unavailable"
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(
        side_effect=httpx.HTTPStatusError("fail", request=MagicMock(), response=mock_response),
    )
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.application.support.ollama_client.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(OllamaError, match="Groq chat failed"):
            await complete_help_reply(system_prompt="sys", user_prompt="user question")
