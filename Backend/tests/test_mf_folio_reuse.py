from __future__ import annotations

from unittest.mock import AsyncMock, patch

from app.application.mf.mf_folio_reuse_service import pick_folio_number_for_scheme
from app.infrastructure.mf.fp_oms_client import create_mf_purchase, create_mf_purchases_batch


def test_pick_folio_prefers_isin_holding() -> None:
    folio = pick_folio_number_for_scheme(
        isin="INF109K01RT3",
        holding_rows=[
            {"folio_number": "111", "isin": "INF173K01FE6"},
            {"folio_number": "222", "isin": "INF109K01RT3"},
        ],
        folio_records=[],
        amc_codes={"103"},
        same_amc_isins={"INF173K01FE6", "INF109K01RT3"},
    )
    assert folio == "222"


def test_pick_folio_falls_back_to_same_amc_holding() -> None:
    folio = pick_folio_number_for_scheme(
        isin="INF109K01TP7",
        holding_rows=[{"folio_number": "61576584", "isin": "INF109K01RT3"}],
        folio_records=[],
        amc_codes={"103"},
        same_amc_isins={"INF109K01RT3", "INF109K01TP7"},
    )
    assert folio == "61576584"


def test_pick_folio_uses_mf_folio_amc_when_holdings_empty() -> None:
    folio = pick_folio_number_for_scheme(
        isin="INF109K01TP7",
        holding_rows=[],
        folio_records=[
            {
                "amc": "103",
                "number": "61576584",
                "payout_details": [{"scheme": "INF109K01RT3"}],
            }
        ],
        amc_codes={"103"},
        same_amc_isins={"INF109K01RT3", "INF109K01TP7"},
    )
    assert folio == "61576584"


def test_pick_folio_prefers_folio_that_already_lists_isin() -> None:
    folio = pick_folio_number_for_scheme(
        isin="INF109K01TP7",
        holding_rows=[],
        folio_records=[
            {"amc": "103", "number": "111", "payout_details": [{"scheme": "INF109K01RT3"}]},
            {"amc": "103", "number": "222", "payout_details": [{"scheme": "INF109K01TP7"}]},
        ],
        amc_codes={"103"},
        same_amc_isins=set(),
    )
    assert folio == "222"


def test_pick_folio_omits_when_no_match() -> None:
    folio = pick_folio_number_for_scheme(
        isin="INF109K01TP7",
        holding_rows=[{"folio_number": "999", "isin": "INF173K01FE6"}],
        folio_records=[{"amc": "200", "number": "111"}],
        amc_codes={"103"},
        same_amc_isins={"INF109K01TP7"},
    )
    assert folio is None


async def test_create_mf_purchase_includes_folio_only_when_set() -> None:
    captured: dict = {}

    async def _capture(path: str, *, body: dict):
        del path
        captured.update(body)
        return {"id": "mfp_1", "state": "pending"}

    with patch("app.infrastructure.mf.fp_oms_client.fp_mf_post", new=_capture):
        await create_mf_purchase(
            fp_mfia_id="mfia",
            scheme="INF109K01RT3",
            amount_inr=1000,
            source_ref_id="order-1",
            folio_number="61576584",
        )
        assert captured["folio_number"] == "61576584"
        captured.clear()
        await create_mf_purchase(
            fp_mfia_id="mfia",
            scheme="INF109K01RT3",
            amount_inr=1000,
            source_ref_id="order-2",
        )
        assert "folio_number" not in captured


async def test_create_mf_purchases_batch_includes_folio_only_when_set() -> None:
    captured: list[dict] = []

    async def _capture(path: str, *, body: dict):
        del path
        captured.extend(body.get("mf_purchases") or [])
        return {"data": []}

    with (
        patch("app.infrastructure.mf.fp_oms_client.is_finprim_enabled", return_value=True),
        patch("app.infrastructure.mf.fp_oms_client.fp_mf_post", new=_capture),
        patch("app.infrastructure.mf.fp_oms_client.resolve_fp_user_ip", new=AsyncMock(return_value=None)),
    ):
        await create_mf_purchases_batch(
            purchases=[
                {
                    "fp_mfia_id": "mfia",
                    "scheme": "INF109K01RT3",
                    "amount_inr": 1000,
                    "source_ref_id": "a",
                    "folio_number": "111",
                },
                {
                    "fp_mfia_id": "mfia",
                    "scheme": "INF173K01FE6",
                    "amount_inr": 2000,
                    "source_ref_id": "b",
                },
            ]
        )
    assert captured[0]["folio_number"] == "111"
    assert "folio_number" not in captured[1]
