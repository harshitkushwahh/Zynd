"""Platform-consent gates for MF flows (no payment-flow imports — avoids circular imports)."""

from __future__ import annotations

from typing import Any

from app.infrastructure.persistence.mf_transaction_models import MfOrder, MfOrderStatus, MfOrderType


def order_is_lumpsum_purchase(order: MfOrder) -> bool:
    raw = order.order_type
    if isinstance(raw, MfOrderType):
        return raw == MfOrderType.lumpsum
    return str(raw or "").upper() == MfOrderType.lumpsum.value


def lumpsum_order_needs_platform_consent(order: MfOrder) -> bool:
    return order_is_lumpsum_purchase(order)


def platform_consent_accepted_from_meta(meta: dict[str, Any]) -> bool:
    """Zynd OTP recorded — external AMC submit may proceed."""
    return bool(meta.get("platform_consent_record_id"))


def lumpsum_has_platform_consent(order: MfOrder) -> bool:
    meta = order.metadata_ if isinstance(order.metadata_, dict) else {}
    return platform_consent_accepted_from_meta(meta)


def order_has_fp_redemption(order: MfOrder) -> bool:
    meta = order.metadata_ if isinstance(order.metadata_, dict) else {}
    return bool(meta.get("fp_redemption_id"))


def order_has_fp_switch(order: MfOrder) -> bool:
    meta = order.metadata_ if isinstance(order.metadata_, dict) else {}
    return bool(meta.get("fp_switch_id"))


def plan_has_fp_plan_id(meta: dict[str, Any]) -> bool:
    return bool(meta.get("fp_plan_id"))


def lumpsum_blocks_fp_pipeline(order: MfOrder) -> bool:
    """Block Cybrilla purchase submit/advance until Zynd platform OTP consent is recorded."""
    return lumpsum_order_needs_platform_consent(order) and not lumpsum_has_platform_consent(order)


def order_awaiting_transaction_consent(order: MfOrder) -> bool:
    meta = order.metadata_ if isinstance(order.metadata_, dict) else {}
    if meta.get("awaiting_transaction_consent") is True:
        return True
    if lumpsum_blocks_fp_pipeline(order):
        return order.status == MfOrderStatus.pending
    return False
