from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
import uuid

import pytest

from app.application.mf.mf_ondc_order_service import _create_purchase_with_scheme_fallback
from app.infrastructure.core.errors import FpClientError
from app.infrastructure.persistence.mf_transaction_models import MfOrderType


@pytest.mark.asyncio
async def test_scheme_fallback_failure_records_ondc_lumpsum_block() -> None:
    fund = SimpleNamespace(
        id=uuid.uuid4(),
        product_id=uuid.uuid4(),
        investment_constraints=None,
    )
    order = SimpleNamespace(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        amount_inr=1000,
        fp_scheme_id="INF179K01LC5",
        order_type=MfOrderType.lumpsum,
        metadata_={"platform_consent_record_id": "consent-test"},
    )
    mfia = SimpleNamespace(id=uuid.uuid4())
    session = AsyncMock()

    unavailable = FpClientError("scheme: is not available for purchase", "fp_client_error", 400)

    with patch(
        "app.application.mf.mf_ondc_order_service.create_mf_purchase",
        new_callable=AsyncMock,
        side_effect=unavailable,
    ):
        with patch(
            "app.application.mf.mf_ondc_order_service.resolve_mf_purchase_scheme",
            return_value=("INF179K01LC5", "2178"),
        ):
            with pytest.raises(FpClientError):
                await _create_purchase_with_scheme_fallback(
                    session,
                    order=order,
                    fund=fund,  # type: ignore[arg-type]
                    fp_mfia_id="mfia_test",
                    folio_number=None,
                    user_ip="127.0.0.1",
                    mfia=mfia,  # type: ignore[arg-type]
                )

    constraints = fund.investment_constraints
    assert constraints is not None
    assert constraints["gateway_purchase"]["ondc"]["allowed"] is False
    session.flush.assert_awaited()
