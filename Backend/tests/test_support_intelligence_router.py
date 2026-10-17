from __future__ import annotations

from app.application.support.ollama_client import parse_routing_decision
from app.application.support.support_intelligence_router import _fallback_decision


def test_parse_routing_decision_accepts_minimal_json() -> None:
    decision = parse_routing_decision(
        '{"priority":"high","urgency_score":88,"first_response_hours":1,'
        '"resolution_hours":8,"assignee_id":null,"pm_co_handling":null,'
        '"reason_summary":"Payment failure","priority_rationale":"x",'
        '"sla_rationale":"y","assignee_rationale":"z","signals":["a"]}'
    )
    assert decision.priority == "high"
    assert decision.urgency_score == 88


def test_fallback_decision_human_request_raises_urgency() -> None:
    features = {
        "ticket": {
            "topic": "account",
            "behavior_signals": ["requested_human_agent", "follow_up_pressure"],
            "minutes_since_last_customer_message": 45,
            "created_minutes_ago": 60,
        },
        "customer": {"in_distributor_book": False, "pm_context": None},
        "agent_candidates": [
            {"id": "00000000-0000-0000-0000-000000000001", "open_backlog": 2, "presence": "online", "resolved_last_7d": 3, "open_by_topic": {}},
        ],
    }
    decision = _fallback_decision(features)
    assert decision.urgency_score >= 60
    assert decision.assignee_id == "00000000-0000-0000-0000-000000000001"


def test_fallback_pm_co_handling_for_book_client() -> None:
    features = {
        "ticket": {
            "topic": "kyc",
            "behavior_signals": [],
            "minutes_since_last_customer_message": 10,
            "created_minutes_ago": 15,
        },
        "customer": {
            "in_distributor_book": True,
            "pm_context": {
                "mitra_user_id": "11111111-1111-1111-1111-111111111111",
                "mitra_display_name": "Mitra One",
                "mitra_client_id": "MC-1",
            },
        },
        "agent_candidates": [],
    }
    decision = _fallback_decision(features)
    assert decision.pm_co_handling is not None
    assert decision.pm_co_handling.get("mitra_display_name") == "Mitra One"
