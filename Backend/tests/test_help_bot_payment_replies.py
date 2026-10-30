from app.application.support.help_bot_payment_replies import try_payment_deterministic_reply


def _pack(*, successful=None, failed=None):
    return {
        "payments": {
            "available": True,
            "recent_successful_orders": successful or [],
            "recent_failed_orders": failed or [],
        }
    }


def test_completed_transactions_lists_successful_orders() -> None:
    pack = _pack(
        successful=[
            {
                "amount": "INR 2000.00",
                "type": "LUMPSUM",
                "created_at": "2026-10-11T10:00:00+00:00",
                "settled_at": "2026-10-11T10:05:00+00:00",
                "status": "SUCCEEDED",
            }
        ]
    )
    reply = try_payment_deterministic_reply(
        "can you tell me about completed transaction of mine",
        pack,
    )
    assert reply is not None
    assert "INR 2000.00" in reply
    assert "completed" in reply.lower() or "recent" in reply.lower()


def test_completed_transactions_empty_does_not_escalate_phrase() -> None:
    reply = try_payment_deterministic_reply("my completed payments", _pack())
    assert reply is not None
    assert "don't see" in reply.lower()


def test_order_id_lookup_completed() -> None:
    oid = "ba7fb4a0-8ac7-4b49-b6fe-598d573ed905"
    pack = _pack(
        successful=[],
        failed=[],
    )
    pack["payments"]["requested_orders"] = [
        {
            "order_id": oid,
            "found": True,
            "amount": "INR 1000.00",
            "type": "LUMPSUM",
            "status": "PROCESSING",
            "payment_completed": True,
            "settled_at": "2026-10-07T10:00:00+00:00",
        }
    ]
    reply = try_payment_deterministic_reply(f"check my order id {oid}", pack)
    assert reply is not None
    assert "completed" in reply.lower()
    assert "2026-10-07" in reply


def test_why_failed_explains_codes() -> None:
    pack = _pack(
        failed=[
            {
                "amount": "INR 1000.00",
                "failure_code": "fp_terminal_failed",
                "failure_reason": "failed",
            }
        ]
    )
    reply = try_payment_deterministic_reply("why these transaction failed", pack)
    assert reply is not None
    assert "bank" in reply.lower() or "upi" in reply.lower()
