"""Deterministic Help Bot answers for payment/order questions (avoid bad LLM escalations)."""

from __future__ import annotations

import re
from typing import Any

_FAILURE_EXPLANATIONS: dict[str, str] = {
    "fp_terminal_failed": (
        "The payment partner could not finish the debit (terminal failure). "
        "This is usually a bank or UPI timeout, insufficient balance, or the customer cancelled on the payment screen."
    ),
    "fp_submit_failed": (
        "The order could not be submitted to the payment partner. "
        "If the reason mentions source_ref_id, a duplicate submit was blocked—retry once from Transactions after a minute."
    ),
}

_COMPLETED_QUESTION = re.compile(
    r"\b(completed|successful|success|succeeded|went through|cleared|processed)\b.*\b("
    r"transaction|transactions|order|orders|payment|payments|sip|debit|investment)\b|"
    r"\b(transaction|transactions|order|orders|payment|payments)\b.*\b("
    r"completed|successful|success|succeeded|went through|cleared)\b",
    re.I,
)
_FAILED_WHY = re.compile(
    r"\b(why|reason|what happened|how come|explain)\b.*\b(fail|failed|failure|declin)",
    re.I,
)
_LAST_SUCCESSFUL_DEBIT = re.compile(
    r"\b(last|latest|recent)\b.*\b(successful\s+)?(sip|debit|payment|deduct)",
    re.I,
)

_FAILED_LIST = re.compile(
    r"\b(fail|failed|failure|declin)\b.*\b(transaction|order|payment|sip)\b|"
    r"\b(recent|my)\b.*\b(fail|failed)\b",
    re.I,
)
_ORDER_ID = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b",
    re.I,
)
_ORDER_STATUS_QUESTION = re.compile(
    r"\b(order|payment|transaction|status|check|trace|this one)\b",
    re.I,
)


def _payments(pack: dict[str, Any]) -> dict[str, Any] | None:
    block = pack.get("payments")
    return block if isinstance(block, dict) and block.get("available") else None


def _explain_failure(code: str | None, reason: str | None) -> str:
    code_key = (code or "").strip().lower()
    base = _FAILURE_EXPLANATIONS.get(code_key)
    if base and reason:
        return f"{base} Platform reason: {reason.strip()}."
    if base:
        return base
    if reason:
        return f"The platform recorded: {reason.strip()}."
    if code:
        return f"Failure code: {code}."
    return "The payment did not complete; check Transactions in the app for the latest status."


def _format_order_line(order: dict[str, Any]) -> str:
    amount = order.get("amount") or "—"
    created = (order.get("settled_at") or order.get("submitted_at") or order.get("created_at") or "—")[:10]
    order_type = order.get("type") or "order"
    oid = order.get("order_id")
    prefix = f"{amount} {order_type} on {created}"
    if oid:
        return f"{prefix} (order {str(oid)[:8]}…)"
    return prefix


def _order_is_complete(row: dict[str, Any]) -> bool:
    return bool(row.get("payment_completed")) or row.get("status") == "SUCCEEDED"


def describe_order_for_customer(row: dict[str, Any]) -> str:
    if row.get("found") is False:
        return (
            f"I couldn't find order {row.get('order_id')} on your Zynd account. "
            "Copy the id again from the Transactions tab."
        )
    oid = str(row.get("order_id") or "")
    short = f"{oid[:8]}…" if oid else "this order"
    if _order_is_complete(row):
        when = (row.get("settled_at") or row.get("submitted_at") or row.get("created_at") or "")[:10]
        when_bit = f" Payment completed on {when}." if when else " Payment is completed."
        return (
            f"Order {short} ({row.get('amount')}, {row.get('type') or 'order'}) shows as completed in Zynd."
            f"{when_bit}"
        )
    status = row.get("status") or "unknown"
    paid = "yes" if row.get("payment_completed") else "no"
    reason = row.get("failure_reason") or row.get("failure_code")
    tail = f" Reason: {reason}." if reason else ""
    return (
        f"Order {short} ({row.get('amount')}) is {status} on Zynd; payment completed flag is {paid}.{tail}"
    )


def _find_order_in_pack(payments: dict[str, Any], order_id: str) -> dict[str, Any] | None:
    needle = order_id.lower()
    for key in ("requested_orders", "recent_orders", "recent_payment_completed_orders", "recent_successful_orders"):
        for row in payments.get(key) or []:
            if str(row.get("order_id", "")).lower() == needle:
                return row
    return None


def try_payment_deterministic_reply(question: str, pack: dict[str, Any]) -> str | None:
    """Return a customer-facing answer when account data clearly answers the question."""
    payments = _payments(pack)
    if payments is None:
        return None

    normalized = " ".join(question.strip().split())
    successful = list(
        payments.get("recent_payment_completed_orders")
        or payments.get("recent_successful_orders")
        or [],
    )
    failed = list(payments.get("recent_failed_orders") or [])

    pasted_ids = _ORDER_ID.findall(normalized)
    if pasted_ids:
        for match in pasted_ids:
            for row in payments.get("requested_orders") or []:
                if str(row.get("order_id", "")).lower() == match.lower():
                    return describe_order_for_customer(row)
            row = _find_order_in_pack(payments, match)
            if row is not None:
                return describe_order_for_customer(row)
        return describe_order_for_customer({"order_id": pasted_ids[0], "found": False})

    last_debit = payments.get("last_sip_debit")
    if _LAST_SUCCESSFUL_DEBIT.search(normalized):
        if isinstance(last_debit, dict):
            amount = last_debit.get("amount") or "—"
            when = str(last_debit.get("settled_at") or last_debit.get("created_at") or "")[:10]
            return f"Your last successful SIP debit on Zynd was {amount}" + (f" on {when}." if when else ".")
        last_any = payments.get("last_completed_payment")
        if isinstance(last_any, dict) and last_any.get("type") != "SIP":
            return (
                "I do not see a successful SIP installment debit in your recent order history. "
                f"Your latest completed payment was {_format_order_line(last_any)} — that may be a lumpsum or one-time order, not a SIP debit."
            )
        return (
            "I do not see a successful SIP debit in your recent Zynd orders yet. "
            "If you started a SIP recently, the first debit may still be scheduled — check Transactions and your SIP plan."
        )

    if _COMPLETED_QUESTION.search(normalized):
        if not successful:
            last_any = payments.get("last_completed_payment")
            if isinstance(last_any, dict):
                return f"Your most recent completed payment on Zynd was {_format_order_line(last_any)}."
            return (
                "I don't see any completed payments in your recent Zynd order history (last 50 orders). "
                "Open Transactions for the full list—some may still show as processing until units settle."
            )
        lines = [_format_order_line(row) for row in successful[:5]]
        prefix = "Your recent completed orders on Zynd:"
        if len(lines) == 1:
            return f"{prefix} {lines[0]}."
        return prefix + " " + "; ".join(lines) + "."

    if _FAILED_WHY.search(normalized) or (
        _FAILED_LIST.search(normalized) and "why" in normalized.lower()
    ):
        if not failed:
            return None
        parts: list[str] = []
        seen: set[tuple[str | None, str | None]] = set()
        for row in failed[:4]:
            key = (row.get("failure_code"), row.get("failure_reason"))
            if key in seen:
                continue
            seen.add(key)
            parts.append(_explain_failure(row.get("failure_code"), row.get("failure_reason")))
        if not parts:
            return None
        intro = "Here's what those failed payments usually mean on Zynd:"
        return intro + " " + " ".join(parts)

    return None
