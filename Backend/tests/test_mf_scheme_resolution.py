from types import SimpleNamespace

from app.application.mf.mf_scheme_resolution import (
    is_scheme_unavailable_for_transaction,
    matching_fund_isins,
    resolve_mf_purchase_scheme,
)


def _fund(**overrides):
    defaults = {
        "isin_growth": "INF209K01PF4",
        "isin_div_reinvestment": None,
        "fp_scheme_id": "2188",
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def test_resolve_mf_purchase_scheme_prefers_isin_over_numeric_id() -> None:
    primary, fallback = resolve_mf_purchase_scheme(_fund(), stored_scheme="2188")
    assert primary == "INF209K01PF4"
    assert fallback == "2188"


def test_resolve_mf_purchase_scheme_uses_div_reinvestment_fallback() -> None:
    primary, fallback = resolve_mf_purchase_scheme(
        _fund(isin_div_reinvestment="INF209K01PF5"),
    )
    assert primary == "INF209K01PF4"
    assert fallback == "INF209K01PF5"


def test_is_scheme_unavailable_for_transaction() -> None:
    assert is_scheme_unavailable_for_transaction(Exception('scheme: is not available for transaction')) is True
    assert is_scheme_unavailable_for_transaction(Exception("network timeout")) is False


def test_matching_fund_isins_returns_requested_variants() -> None:
    requested = {"INF209K01PF4", "INF000K01ABC"}
    assert matching_fund_isins(
        isin_growth="inf209k01pf4",
        isin_div_reinvestment="INF209K01PF5",
        requested=requested,
    ) == ["INF209K01PF4"]

    assert matching_fund_isins(
        isin_growth="INF000K01ABC",
        isin_div_reinvestment="INF000K01ABD",
        requested={"INF000K01ABD"},
    ) == ["INF000K01ABD"]
