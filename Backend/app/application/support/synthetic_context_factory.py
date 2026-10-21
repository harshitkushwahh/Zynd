"""Synthetic customer context packs for help-bot fine-tune export (Phase 2)."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import date, datetime, timedelta, timezone
from typing import Any

_STEP_NAMES = (
    "pan",
    "digilocker",
    "address",
    "personal",
    "nominee",
    "bank",
    "signature",
    "review",
)


def seed_from_row_id(row_id: str, *, salt: int = 0) -> int:
    digest = hashlib.sha256(f"{salt}:{row_id}".encode()).hexdigest()
    return int(digest[:12], 16)


def _rng(row_id: str, *, salt: int = 0):
    import random

    return random.Random(seed_from_row_id(row_id, salt=salt))


def _iso_dt(rng, *, days_ago_max: int = 400) -> str:
    days = rng.randint(0, days_ago_max)
    hour = rng.randint(8, 20)
    minute = rng.randint(0, 59)
    dt = datetime.now(timezone.utc) - timedelta(days=days, hours=rng.randint(0, 5))
    dt = dt.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return dt.isoformat()


def _iso_date(rng, *, days_ahead_max: int = 120) -> str:
    d = date.today() + timedelta(days=rng.randint(1, days_ahead_max))
    return d.isoformat()


def _money(rng, lo: int = 500, hi: int = 250_000) -> str:
    amount = rng.randint(lo, hi)
    if amount >= 1000:
        amount = (amount // 100) * 100
    return f"INR {amount:.2f}"


def _pick(rng, options: list[str]) -> str:
    return options[rng.randint(0, len(options) - 1)]


def _build_kyc(rng) -> dict[str, Any]:
    overall = _pick(rng, ["completed", "submitted", "in_progress", "none"])
    steps = {name: _pick(rng, ["completed", "pending", "failed"]) for name in _STEP_NAMES}
    if overall == "completed":
        steps = {name: "completed" for name in _STEP_NAMES}
    completed_at = _iso_dt(rng) if overall == "completed" else None
    return {
        "available": True,
        "overall_status": overall,
        "status_last_updated_at": _iso_dt(rng, days_ago_max=30),
        "completed_at": completed_at,
        "steps": steps,
        "last_completed_step": _pick(rng, list(_STEP_NAMES)),
        "readiness_code": _pick(rng, ["ready", "kyc_incomplete", "bank_pending", "external_pending"]),
        "readiness_reason": _pick(
            rng,
            [
                "Complete remaining KYC steps.",
                "Bank verification pending.",
                "Awaiting registrar confirmation.",
                None,
            ],
        ),
        "pan_verification_status": _pick(rng, ["verified", "pending", "failed"]),
        "bank_verification_status": _pick(rng, ["verified", "pending", "failed"]),
        "external_kyc_status": _pick(rng, ["synced", "pending", "none"]),
        "kyc_already_registered": rng.choice([True, False]),
    }


def _build_payments(rng) -> dict[str, Any]:
    order_status = _pick(rng, ["SUCCEEDED", "FAILED", "PAYMENT_PENDING", "CANCELLED"])
    sip_status = _pick(rng, ["ACTIVE", "PAUSED", "FAILED", "CANCELLED"])
    return {
        "available": True,
        "last_sip_debit": {
            "amount": _money(rng),
            "status": "SUCCEEDED",
            "created_at": _iso_dt(rng, days_ago_max=60),
            "settled_at": _iso_dt(rng, days_ago_max=45),
            "failure_code": None,
            "failure_reason": None,
        },
        "last_sip_failure": {
            "amount": _money(rng),
            "status": "FAILED",
            "created_at": _iso_dt(rng, days_ago_max=30),
            "settled_at": None,
            "failure_code": "INSUFFICIENT_FUNDS",
            "failure_reason": "Bank declined debit due to insufficient balance.",
        },
        "failed_sip_plans": [
            {
                "amount": _money(rng),
                "frequency": "MONTHLY",
                "status": "FAILED",
                "failure_reason": "Mandate expired at bank.",
                "next_installment_date": None,
            }
        ],
        "recent_orders": [
            {
                "amount": _money(rng),
                "status": order_status,
                "type": _pick(rng, ["LUMPSUM", "SIP", "REDEMPTION", "SWITCH"]),
                "failure_code": None if order_status == "SUCCEEDED" else "PAYMENT_TIMEOUT",
                "failure_reason": None
                if order_status == "SUCCEEDED"
                else "Payment gateway timed out; retry from Transactions.",
                "created_at": _iso_dt(rng, days_ago_max=14),
                "settled_at": _iso_dt(rng, days_ago_max=10) if order_status == "SUCCEEDED" else None,
            }
        ],
        "sip_plans": [
            {
                "amount": _money(rng, 1000, 50000),
                "frequency": _pick(rng, ["MONTHLY", "WEEKLY", "DAILY"]),
                "status": sip_status,
                "next_installment_date": _iso_date(rng),
                "failure_reason": None if sip_status == "ACTIVE" else "Mandate not active at bank.",
            }
        ],
    }


def _build_portfolio(rng) -> dict[str, Any]:
    return {
        "available": True,
        "status": _pick(rng, ["ready", "loading", "error"]),
        "has_pending_orders": rng.choice([True, False]),
        "current_value": _money(rng, 10_000, 2_000_000),
        "invested": _money(rng, 10_000, 1_800_000),
        "total_return": _money(rng, -200_000, 400_000),
        "holdings_count": rng.randint(0, 12),
        "active_sips_count": rng.randint(0, 5),
        "monthly_sip": _money(rng, 1000, 80_000),
        "as_on": _iso_dt(rng, days_ago_max=3),
    }


def _build_account(rng) -> dict[str, Any]:
    google = rng.choice([True, False])
    apple = rng.choice([True, False])
    providers = []
    if google:
        providers.append("google")
    if apple:
        providers.append("apple")
    if not providers:
        providers.append("password")
    return {
        "available": True,
        "account_status": _pick(rng, ["active", "restricted", "pending"]),
        "email_verified": rng.choice([True, False]),
        "email_verified_at": _iso_dt(rng, days_ago_max=200),
        "phone_verified": rng.choice([True, False]),
        "phone_verified_at": _iso_dt(rng, days_ago_max=200),
        "mfa_enrolled": rng.choice([True, False]),
        "has_password_login": "password" in providers,
        "google_account_linked": google,
        "apple_account_linked": apple,
        "linked_sign_in_providers": sorted(providers),
        "country_code": "IN",
    }


def _build_goals(rng) -> dict[str, Any]:
    goals = []
    for idx in range(rng.randint(1, 4)):
        target = rng.randint(50_000, 2_000_000)
        current = rng.randint(0, target)
        goals.append(
            {
                "title": _pick(rng, ["Retirement", "Emergency fund", "Vacation", "Child education"]),
                "status": _pick(rng, ["active", "completed", "archived"]),
                "target_amount": f"INR {target:.2f}",
                "current_amount": f"INR {current:.2f}",
                "target_date": _iso_date(rng, days_ahead_max=800),
                "progress_pct": round(100.0 * current / target, 1) if target else 0.0,
            }
        )
    return {"available": True, "goals": goals}


def _build_family(rng) -> dict[str, Any]:
    return {
        "available": True,
        "groups": [
            {
                "title": _pick(rng, ["Sharma Family", "Home Goals", "Parents"]),
                "status": _pick(rng, ["active", "pending"]),
                "my_role": _pick(rng, ["head", "member"]),
                "member_count": rng.randint(1, 6),
            }
        ],
    }


def _build_referrals(rng) -> dict[str, Any]:
    return {
        "available": True,
        "has_code": True,
        "click_count": rng.randint(0, 120),
        "signup_count": rng.randint(0, 40),
        "kyc_verified_count": rng.randint(0, 25),
        "first_investment_count": rng.randint(0, 15),
    }


_BUILDERS = {
    "kyc": _build_kyc,
    "payment": _build_payments,
    "portfolio": _build_portfolio,
    "account": _build_account,
    "goals": _build_goals,
    "family": _build_family,
    "referrals": _build_referrals,
}

_SLICE_KEYS = {
    "kyc": "kyc",
    "payment": "payments",
    "portfolio": "portfolio",
    "account": "account",
    "goals": "goals",
    "family": "family_groups",
    "referrals": "referrals",
}


def build_synthetic_context_pack(
    topics: list[str],
    *,
    row_id: str,
    salt: int = 0,
    context_fields: list[str] | None = None,
    can_answer: bool = True,
) -> dict[str, Any]:
    """Build a masked context pack shaped like ``build_context_pack`` output."""
    rng = _rng(row_id, salt=salt)
    pack: dict[str, Any] = {}
    for topic in topics:
        builder = _BUILDERS.get(topic)
        key = _SLICE_KEYS.get(topic)
        if builder is None or key is None:
            continue
        pack[key] = builder(rng)

    if not can_answer and context_fields:
        for path in context_fields:
            _clear_path(pack, path)

    return pack


def _clear_path(pack: dict[str, Any], dot_path: str) -> None:
    parts = dot_path.split(".")
    if not parts:
        return
    root_key = parts[0]
    if root_key == "kyc":
        node: Any = pack.get("kyc")
    elif root_key == "payments":
        node = pack.get("payments")
    elif root_key == "portfolio":
        node = pack.get("portfolio")
    elif root_key == "account":
        node = pack.get("account")
    elif root_key == "goals":
        node = pack.get("goals")
    elif root_key == "family_groups":
        node = pack.get("family_groups")
    elif root_key == "referrals":
        node = pack.get("referrals")
    else:
        return
    if node is None:
        return
    *parents, leaf = parts[1:]
    for part in parents:
        if not isinstance(node, dict):
            return
        node = node.get(part)
        if node is None:
            return
    if isinstance(node, dict) and leaf in node:
        node[leaf] = None


def resolve_context_path(pack: dict[str, Any], dot_path: str) -> Any:
    """Resolve ``kyc.completed_at`` style paths against a synthetic pack."""
    parts = dot_path.split(".")
    if not parts:
        return None
    root = parts[0]
    mapping = {
        "kyc": "kyc",
        "payments": "payments",
        "portfolio": "portfolio",
        "account": "account",
        "goals": "goals",
        "family_groups": "family_groups",
        "referrals": "referrals",
    }
    key = mapping.get(root)
    if key is None:
        return None
    node: Any = pack.get(key)
    for part in parts[1:]:
        if node is None:
            return None
        if isinstance(node, dict):
            node = node.get(part)
        elif isinstance(node, list) and part.isdigit():
            idx = int(part)
            node = node[idx] if idx < len(node) else None
        else:
            return None
    return node


def _humanize_path(dot_path: str) -> str:
    tail = dot_path.split(".")[-1]
    return tail.replace("_", " ")


def _format_value(value: Any) -> str:
    if value is None:
        return "not available"
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, (dict, list)):
        text = json.dumps(value, ensure_ascii=False)
        return text[:240] + ("…" if len(text) > 240 else "")
    return str(value)


def materialize_grounded_answer(
    *,
    question: str,
    solution: str,
    context_fields: list[str],
    pack: dict[str, Any],
    can_answer: bool,
) -> tuple[bool, str]:
    """
    Produce fine-tune assistant text grounded in ``pack``.
    Returns (can_answer, answer).
    """
    if not can_answer:
        return False, (solution or "Cannot answer from available account context.")[:800]

    resolved: list[tuple[str, Any]] = []
    for path in context_fields:
        value = resolve_context_path(pack, path)
        if value is None:
            continue
        resolved.append((path, value))

    if not resolved and context_fields:
        missing = ", ".join(context_fields[:4])
        return False, f"Context lacks required fields: {missing}."

    if not context_fields:
        return True, (solution or "See playbook for steps.")[:800]

    q = question.lower()
    lines: list[str] = []
    for path, value in resolved[:6]:
        label = _humanize_path(path)
        formatted = _format_value(value)
        lines.append(f"{label}: {formatted}")

    if re.search(r"\bwhen\b|\bdate\b|\bkb\b", q):
        lead = "Here are the latest dates and statuses from your account: "
    elif re.search(r"\bwhy\b|\breason\b|\bfail", q):
        lead = "Based on your account records: "
    elif re.search(r"\bhow many\b|\bcount\b", q):
        lead = "Here's what I see in your account: "
    else:
        lead = "From your Zynd account context: "

    body = "; ".join(lines)
    answer = f"{lead}{body}."
    if solution and len(answer) < 400:
        answer = f"{answer} {solution}".strip()
    return True, answer[:900]
