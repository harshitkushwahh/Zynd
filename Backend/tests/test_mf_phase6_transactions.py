from __future__ import annotations


def _map_fp_state(fp_state: str | None) -> str:
    normalized = (fp_state or "").lower()
    if normalized in {"successful", "succeeded", "completed", "confirmed"}:
        return "SUCCEEDED"
    if normalized in {"failed", "cancelled", "rejected", "expired"}:
        return "FAILED"
    if normalized in {"pending", "payment_pending", "awaiting_payment", "created", "submitted"}:
        return "PAYMENT_PENDING"
    return "PROCESSING"


def test_map_fp_state_success() -> None:
    assert _map_fp_state("successful") == "SUCCEEDED"
    assert _map_fp_state("SUCCEEDED") == "SUCCEEDED"


def test_map_fp_state_failure() -> None:
    assert _map_fp_state("failed") == "FAILED"
    assert _map_fp_state("cancelled") == "FAILED"
