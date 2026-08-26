from __future__ import annotations

from app.application.mf.mf_lumpsum_reconciliation_service import (
    _REPAIRABLE_CANCEL_FAILURE_CODES,
    payment_covers_order,
)


def test_repairable_cancel_failure_codes_include_payment_expired() -> None:
    assert "payment_abandoned" in _REPAIRABLE_CANCEL_FAILURE_CODES
    assert "payment_expired" in _REPAIRABLE_CANCEL_FAILURE_CODES
    assert None in _REPAIRABLE_CANCEL_FAILURE_CODES


def test_repairable_cancel_failure_codes_exclude_terminal_failures() -> None:
    assert "fp_submit_failed" not in _REPAIRABLE_CANCEL_FAILURE_CODES


def test_payment_covers_order_requires_matching_old_id() -> None:
    class _Order:
        fp_purchase_old_id = 2989

    assert payment_covers_order({"amc_order_ids": [2989]}, _Order()) is True
    assert payment_covers_order({"amc_order_ids": [3204]}, _Order()) is False
    assert payment_covers_order({"amc_order_ids": [2989, 3001]}, _Order()) is True


def test_payment_covers_order_without_old_id() -> None:
    class _Order:
        fp_purchase_old_id = None

    assert payment_covers_order({"amc_order_ids": [2989]}, _Order()) is False
