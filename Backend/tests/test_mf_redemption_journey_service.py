from __future__ import annotations

from app.application.mf.mf_redemption_journey_service import (
    build_redemption_journey_events,
    index_active_redemptions,
    map_fp_redemption_status,
    serialize_active_redemption,
)


def test_map_fp_redemption_status() -> None:
    assert map_fp_redemption_status("successful") == "SUCCEEDED"
    assert map_fp_redemption_status("submitted") == "SUBMITTED"
    assert map_fp_redemption_status("confirmed") == "PROCESSING"
    assert map_fp_redemption_status("pending") == "PENDING"


def test_build_redemption_journey_events_from_timestamps() -> None:
    redemption = {
        "state": "successful",
        "created_at": "2026-08-04T09:42:00+05:30",
        "confirmed_at": "2026-08-04T09:42:08+05:30",
        "submitted_at": "2026-08-04T10:15:00+05:30",
        "redeemed_units": 650.12,
        "redeemed_price": 142.18,
        "redeemed_at": "2026-08-05T18:30:00+05:30",
        "succeeded_at": "2026-08-06T14:22:00+05:30",
    }

    events = build_redemption_journey_events(
        redemption,
        payout_details=[{"payout_processed_at": "2026-08-06T08:00:00+05:30"}],
    )

    assert events[0]["to_status"] == "PENDING"
    assert any(event["payload"] and event["payload"].get("stage") == "amc_submitted" for event in events)
    assert events[-1]["to_status"] == "SUCCEEDED"


def test_index_active_redemptions_by_folio_and_isin() -> None:
    rows = [
        {
            "id": "red-1",
            "state": "submitted",
            "folio_number": "12345/67",
            "scheme": "INF109K01Y46",
            "amount": 92400,
            "units": 650.12,
            "created_at": "2026-08-05T11:08:00+05:30",
        },
        {
            "id": "red-2",
            "state": "successful",
            "folio_number": "12345/67",
            "scheme": "INF109K01Y46",
            "amount": 1000,
            "units": 10,
            "created_at": "2026-07-01T00:00:00+05:30",
        },
    ]

    indexed = index_active_redemptions(rows)
    assert "12345/67::INF109K01Y46" in indexed
    assert indexed["12345/67::INF109K01Y46"]["fp_redemption_id"] == "red-1"


def test_list_fp_redemption_query_states_match_fp_api() -> None:
    from app.application.mf.mf_redemption_journey_service import (
        _ACTIVE_FP_REDEMPTION_STATES,
        _FP_REDEMPTION_QUERY_STATES,
    )

    query_states = set(_FP_REDEMPTION_QUERY_STATES.split(","))
    allowed = {"pending", "confirmed", "submitted", "successful", "failed", "cancelled", "reversed"}
    assert query_states <= allowed
    assert _ACTIVE_FP_REDEMPTION_STATES <= query_states


def test_serialize_active_redemption() -> None:
    payload = serialize_active_redemption(
        {
            "id": "red-99",
            "state": "confirmed",
            "folio_number": "999",
            "scheme": {"isin": "INF000K01Y46"},
            "amount": 5000,
            "units": 42.5,
            "created_at": "2026-08-06T08:00:00+05:30",
        }
    )
    assert payload["fp_redemption_id"] == "red-99"
    assert payload["isin"] == "INF000K01Y46"
    assert payload["status"] == "PROCESSING"
