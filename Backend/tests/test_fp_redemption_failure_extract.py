from __future__ import annotations

from app.infrastructure.mf.fp_oms_client import extract_fp_redemption_failure


def test_extract_fp_redemption_failure_from_top_level_fields() -> None:
    code, reason = extract_fp_redemption_failure(
        {
            "id": "red-1",
            "state": "failed",
            "failure_code": "folio_balance_under_lock_in",
            "failure_reason": "Holdings are locked in and redemption is not permitted",
        }
    )
    assert code == "folio_balance_under_lock_in"
    assert "locked in" in (reason or "")


def test_extract_fp_redemption_failure_from_nested_error() -> None:
    code, reason = extract_fp_redemption_failure(
        {
            "object": "mf_redemption",
            "id": "red-2",
            "state": "failed",
            "error": {"code": "gateway_rejected", "message": "Redemption rejected by RTA"},
        }
    )
    assert code == "gateway_rejected"
    assert reason == "Redemption rejected by RTA"
