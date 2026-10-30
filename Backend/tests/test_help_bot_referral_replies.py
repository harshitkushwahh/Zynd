from app.application.support.help_bot_answer_policy import pick_customer_reply
from app.application.support.help_bot_referral_replies import try_referral_deterministic_reply
from app.application.support.help_bot_types import BotDraft


def _ref_pack(*, signups=3, kyc=2, invested=1, clicks=10, has_code=True):
    return {
        "referrals": {
            "available": True,
            "signup_count": signups,
            "kyc_verified_count": kyc,
            "first_investment_count": invested,
            "click_count": clicks,
            "has_code": has_code,
        }
    }


def test_referal_smajao_education() -> None:
    reply = try_referral_deterministic_reply("referal smajao", _ref_pack(signups=0))
    assert reply is not None
    assert "Refer & Earn" in reply


def test_referals_kya_hai() -> None:
    reply = try_referral_deterministic_reply("referals kya hai", {})
    assert reply is not None
    assert "Dashboard" in reply


def test_hinglish_mere_kitne_referral() -> None:
    reply = try_referral_deterministic_reply("acha mere kitne referral hai", _ref_pack())
    assert reply is not None
    assert "3" in reply
    assert "signup" in reply.lower()


def test_referal_typo() -> None:
    reply = try_referral_deterministic_reply("mere referal kitne hai", _ref_pack(signups=0))
    assert reply is not None
    assert "0" in reply


def test_policy_no_escalate_when_llm_refuses_referrals() -> None:
    pack = _ref_pack(signups=5, kyc=4, invested=2)
    draft = BotDraft(
        can_answer=False,
        needs_agent=True,
        answer="I can't confirm that from your Zynd account.",
    )
    reply = pick_customer_reply(
        question="acha mere kitne referral hai",
        pack=pack,
        topics=("referrals",),
        draft=draft,
    )
    assert reply is not None
    assert "5" in reply
    assert "can't confirm" not in reply.lower()
