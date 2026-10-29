from app.application.support.help_bot_portfolio_replies import try_portfolio_deterministic_reply
from app.application.support.scope_gate import classify_message


def test_porotlfio_explain_in_scope() -> None:
    assert classify_message("porotlfio explain").in_scope is True
    assert "portfolio" in classify_message("porotlfio explain").topics


def test_portfolio_typo_explain_reply() -> None:
    pack = {
        "portfolio": {
            "available": True,
            "current_value": "INR 50000.00",
            "invested": "INR 40000.00",
            "holdings_count": 2,
        }
    }
    reply = try_portfolio_deterministic_reply("porotlfio explain", pack)
    assert reply is not None
    assert "50000" in reply
    assert "mutual fund" in reply.lower() or "holdings" in reply.lower()
