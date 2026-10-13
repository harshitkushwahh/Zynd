from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.application.mf.mf_ondc_order_service import advance_ondc_order
from app.application.mf.mf_purchase_consent_gates import (
    lumpsum_blocks_fp_pipeline,
    order_awaiting_transaction_consent,
)
from app.application.mf.mf_transaction_consent_service import merge_platform_consent_metadata
from app.infrastructure.persistence.mf_transaction_models import MfOrder, MfOrderStatus, MfOrderType


def test_pending_lumpsum_without_platform_consent_blocks_fp() -> None:
    order = MfOrder(
        status=MfOrderStatus.pending,
        order_type=MfOrderType.lumpsum,
        metadata_={"awaiting_transaction_consent": True},
    )
    assert lumpsum_blocks_fp_pipeline(order)
    assert order_awaiting_transaction_consent(order)


def test_lumpsum_with_platform_consent_allows_fp() -> None:
    order = MfOrder(
        status=MfOrderStatus.pending,
        order_type=MfOrderType.lumpsum,
        metadata_=merge_platform_consent_metadata(
            {"awaiting_transaction_consent": False},
            consent_record_id="rec-1",
        ),
    )
    assert not lumpsum_blocks_fp_pipeline(order)
    assert not order_awaiting_transaction_consent(order)


@pytest.mark.asyncio
async def test_advance_ondc_order_no_ops_without_platform_consent() -> None:
    order = MfOrder(
        status=MfOrderStatus.payment_pending,
        order_type=MfOrderType.lumpsum,
        fp_purchase_id="mfp_test",
        metadata_={"awaiting_transaction_consent": True},
    )
    assert await advance_ondc_order(AsyncMock(), order) is False
