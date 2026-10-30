from app.application.support.help_bot_grounded_reply import (
    should_answer_without_llm,
    try_grounded_account_reply,
)
from app.application.support.help_bot_answer_policy import pick_customer_reply, should_escalate_to_human
from app.application.support.help_bot_types import BotDraft
from app.application.support.scope_gate import classify_message


def _pack(**blocks):
    out = {}
    for key, payload in blocks.items():
        out[key] = {"available": True, **payload}
    return out


def test_mer_address_in_scope_kyc_not_portfolio() -> None:
    decision = classify_message("mer address kya hai")
    assert decision.in_scope is True
    assert "kyc" in decision.topics
    assert "portfolio" not in decision.topics


def test_address_grounded_reply_not_field_dump() -> None:
    pack = _pack(
        kyc={
            "overall_status": "completed",
            "steps": {"address": "completed"},
            "residential_address": {
                "on_file": True,
                "city": "Pune",
                "state": "Maharashtra",
                "postal_code": "411001",
                "country": "IN",
            },
        },
        account={"country_code": "IN"},
        referrals={"has_code": True},
        portfolio={"current_value": "INR 100000.00", "holdings_count": 2},
    )
    reply = try_grounded_account_reply("mer address kya hai", pack, ("kyc", "account"))
    assert reply is not None
    assert "Pune" in reply
    assert "country code" not in reply.lower()
    assert "125000" not in reply


def test_backup_typo_replies_consistently() -> None:
    pack = _pack(
        account={"mfa_enrolled": True},
        settings={"backup_codes_remaining": 6, "backup_codes_total": 10},
        referrals={"has_code": True},
    )
    for q in ("bakup code batao", "baakup code batao", "backup codes kitne bache"):
        decision = classify_message(q)
        assert decision.in_scope is True, q
        reply = try_grounded_account_reply(q, pack, decision.topics)
        assert reply is not None, q
        assert "6" in reply
        assert "referral" not in reply.lower()
        assert "country code" not in reply.lower()


def test_device_login_count_without_escalation() -> None:
    pack = _pack(account={"active_session_count": 2, "active_device_count": 2})
    q = "kitne device mai lgoin hu"
    decision = classify_message(q)
    assert decision.in_scope is True
    reply = try_grounded_account_reply(q, pack, decision.topics)
    assert reply is not None
    assert "2" in reply
    draft = BotDraft(can_answer=False, answer="", needs_agent=True)
    escalate, _ = should_escalate_to_human(
        needs_human=False,
        draft=draft,
        customer_reply=reply,
        llm_unavailable=False,
    )
    assert escalate is False


def test_referral_and_portfolio_typo_should_answer_without_llm() -> None:
    for q in ("referal smajao", "porotlfio explain"):
        assert should_answer_without_llm(q) is True
        decision = classify_message(q)
        assert decision.in_scope is True


def test_pick_customer_reply_backup_when_llm_refuses() -> None:
    pack = _pack(
        account={"mfa_enrolled": True},
        settings={"backup_codes_remaining": 4, "backup_codes_total": 10},
    )
    draft = BotDraft(can_answer=False, answer="Context does not include backup codes.", needs_agent=True)
    reply = pick_customer_reply(
        question="bakup code batao",
        pack=pack,
        topics=("account",),
        draft=draft,
    )
    assert reply is not None
    assert "4" in reply
