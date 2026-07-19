from __future__ import annotations

import uuid

import pytest

from app.application.mf.mf_calculator_errors import MfCalculatorError
from app.application.mf.mf_calculator_service import _validate_amount, _validate_horizons
from app.application.mf.mf_compare_service import compare_invest_funds


def test_validate_amount_rejects_out_of_range() -> None:
    with pytest.raises(MfCalculatorError) as exc:
        _validate_amount(0)
    assert exc.value.code == "invalid_amount"


def test_validate_horizons_rejects_unknown() -> None:
    with pytest.raises(MfCalculatorError) as exc:
        _validate_horizons(["1y", "10y"])
    assert exc.value.code == "invalid_horizon"


@pytest.mark.asyncio
async def test_compare_rejects_more_than_three_funds(db_session) -> None:
    ids = [uuid.uuid4() for _ in range(4)]
    with pytest.raises(MfCalculatorError) as exc:
        await compare_invest_funds(db_session, product_ids=ids)
    assert exc.value.code == "invalid_compare_count"
