"""Read-only, masked slices of the signed-in customer's Zynd account."""

from __future__ import annotations

import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import (
    KycJourneyState,
    OAuthAccount,
    OAuthProvider,
    User,
    UserKycStatus,
)

logger = logging.getLogger(__name__)


def _enum_value(value: Any) -> str | None:
    if value is None:
        return None
    raw = getattr(value, "value", value)
    return str(raw)


def _iso(value: datetime | date | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def _money(value: Decimal | float | int | None) -> str | None:
    if value is None:
        return None
    return f"INR {Decimal(str(value)).quantize(Decimal('0.01'))}"


async def _safe(label: str, loader) -> dict[str, Any]:
    try:
        payload = await loader()
    except Exception:
        logger.exception("Support context slice failed: %s", label)
        return {"available": False}
    if not isinstance(payload, dict):
        return {"available": False}
    payload["available"] = True
    return payload


async def build_context_pack(
    db: AsyncSession,
    user: User,
    topics: tuple[str, ...] | list[str],
) -> dict[str, Any]:
    selected = set(topics)
    pack: dict[str, Any] = {}
    if "kyc" in selected:
        pack["kyc"] = await _safe("kyc", lambda: _kyc_slice(db, user.id))
    if "payment" in selected:
        pack["payments"] = await _safe("payments", lambda: _payment_slice(db, user.id))
    if "portfolio" in selected:
        pack["portfolio"] = await _safe("portfolio", lambda: _portfolio_slice(db, user.id))
    if "family" in selected:
        pack["family_groups"] = await _safe("family", lambda: _family_slice(db, user.id))
    if "goals" in selected:
        pack["goals"] = await _safe("goals", lambda: _goals_slice(db, user.id))
    if "account" in selected:
        pack["account"] = await _safe("account", lambda: _account_slice(db, user.id))
    if "referrals" in selected:
        pack["referrals"] = await _safe("referrals", lambda: _referral_slice(db, user.id))
    return pack


async def _kyc_slice(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    status = await db.get(UserKycStatus, user_id)
    journey = await db.get(KycJourneyState, user_id)
    overall = _enum_value(status.overall_status) if status else "none"
    steps = None
    if status is not None:
        steps = {
            "pan": _enum_value(status.pan_step_status),
            "digilocker": _enum_value(status.digilocker_step_status),
            "address": _enum_value(status.address_step_status),
            "personal": _enum_value(status.personal_step_status),
            "nominee": _enum_value(status.nominee_step_status),
            "bank": _enum_value(status.bank_step_status),
            "signature": _enum_value(status.signature_step_status),
            "review": _enum_value(status.review_step_status),
        }
    completed_at = None
    if status is not None and _enum_value(status.overall_status) == "completed":
        completed_at = _iso(status.updated_at)
    return {
        "overall_status": overall,
        "status_last_updated_at": _iso(status.updated_at) if status else None,
        "completed_at": completed_at,
        "steps": steps,
        "last_completed_step": journey.last_completed_step if journey else None,
        "readiness_code": journey.readiness_code if journey else None,
        "readiness_reason": journey.readiness_reason if journey else None,
        "pan_verification_status": journey.pan_verification_status if journey else None,
        "bank_verification_status": journey.bank_verification_status if journey else None,
        "external_kyc_status": journey.external_kyc_status if journey else None,
        "kyc_already_registered": journey.kyc_already_registered if journey else None,
    }


async def _payment_slice(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    from app.application.mf.mf_order_service import list_user_orders
    from app.application.mf.mf_sip_plan_service import list_user_sip_plans

    orders = await list_user_orders(db, user_id=user_id, limit=12)
    plans = await list_user_sip_plans(db, user_id=user_id, limit=8)

    last_sip_debit = None
    last_sip_failure = None
    for order in orders:
        if _enum_value(order.order_type) != "SIP":
            continue
        status = _enum_value(order.status)
        row = {
            "amount": _money(order.amount_inr),
            "status": status,
            "created_at": _iso(order.created_at),
            "settled_at": _iso(order.settled_at),
            "failure_code": order.failure_code,
            "failure_reason": (order.failure_reason or "")[:240] or None,
        }
        if status == "SUCCEEDED" and order.settled_at is not None and last_sip_debit is None:
            last_sip_debit = row
        if status == "FAILED" and last_sip_failure is None:
            last_sip_failure = row

    failed_plans = [
        {
            "amount": _money(plan.amount_inr),
            "frequency": plan.frequency,
            "status": _enum_value(plan.status),
            "failure_reason": (plan.failure_reason or "")[:240] or None,
            "next_installment_date": _iso(plan.next_installment_date),
        }
        for plan in plans
        if _enum_value(plan.status) == "FAILED"
    ]

    return {
        "last_sip_debit": last_sip_debit,
        "last_sip_failure": last_sip_failure,
        "failed_sip_plans": failed_plans[:3],
        "recent_orders": [
            {
                "amount": _money(order.amount_inr),
                "status": _enum_value(order.status),
                "type": _enum_value(order.order_type),
                "failure_code": order.failure_code,
                "failure_reason": (order.failure_reason or "")[:240] or None,
                "created_at": _iso(order.created_at),
                "settled_at": _iso(order.settled_at),
            }
            for order in orders[:8]
        ],
        "sip_plans": [
            {
                "amount": _money(plan.amount_inr),
                "frequency": plan.frequency,
                "status": _enum_value(plan.status),
                "next_installment_date": _iso(plan.next_installment_date),
                "failure_reason": (plan.failure_reason or "")[:240] or None,
            }
            for plan in plans
        ],
    }


async def _portfolio_slice(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    from app.application.mf.portfolio_holdings_service import get_user_portfolio_summary

    summary = await get_user_portfolio_summary(db, user_id=user_id)
    return {
        "status": summary.get("status"),
        "has_pending_orders": summary.get("has_pending_orders"),
        "current_value": _money(summary.get("current_value_inr")),
        "invested": _money(summary.get("invested_inr")),
        "total_return": _money(summary.get("total_return_inr")),
        "holdings_count": summary.get("holdings_count"),
        "active_sips_count": summary.get("active_sips_count"),
        "monthly_sip": _money(summary.get("monthly_sip_inr")),
        "as_on": summary.get("as_on"),
    }


async def _family_slice(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    from app.application.family_groups.group_service import list_family_groups_for_user

    groups = await list_family_groups_for_user(db, user_id=user_id)
    return {
        "groups": [
            {
                "title": group.get("title"),
                "status": group.get("status"),
                "my_role": group.get("my_role"),
                "member_count": group.get("member_count"),
            }
            for group in groups
        ]
    }


async def _goals_slice(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    from app.application.goals.goal_service import list_personal_goals

    goals = await list_personal_goals(db, user_id=user_id)
    return {
        "goals": [
            {
                "title": goal.get("title"),
                "status": goal.get("status"),
                "target_amount": _money(goal.get("target_amount_inr")),
                "current_amount": _money(goal.get("current_amount_inr")),
                "target_date": goal.get("target_date"),
                "progress_pct": goal.get("progress_pct"),
            }
            for goal in goals
        ]
    }


async def _account_slice(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    user = await db.get(User, user_id)
    if user is None:
        return {"available": False}

    oauth_rows = await db.scalars(select(OAuthAccount).where(OAuthAccount.user_id == user_id))
    providers = {row.provider for row in oauth_rows}

    return {
        "account_status": _enum_value(user.status),
        "email_verified": user.email_verified_at is not None,
        "email_verified_at": _iso(user.email_verified_at),
        "phone_verified": user.phone_verified_at is not None,
        "phone_verified_at": _iso(user.phone_verified_at),
        "mfa_enrolled": user.mfa_enrolled_at is not None,
        "has_password_login": bool(user.password_hash),
        "google_account_linked": OAuthProvider.google in providers,
        "apple_account_linked": OAuthProvider.apple in providers,
        "linked_sign_in_providers": sorted(_enum_value(provider) or "" for provider in providers),
        "country_code": user.country_code,
    }


async def _referral_slice(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    from app.application.referral.referral_attribution_service import (
        count_first_investment_for_referrer,
        count_kyc_verified_for_referrer,
        count_signups_for_referrer,
    )
    from app.application.referral.referral_code_service import count_referral_clicks_for_user
    from app.infrastructure.persistence.referral_models import ReferralCode

    code_row = await db.scalar(select(ReferralCode).where(ReferralCode.user_id == user_id))
    return {
        "has_code": code_row is not None and bool(code_row.is_active),
        "click_count": await count_referral_clicks_for_user(db, user_id=user_id),
        "signup_count": await count_signups_for_referrer(db, referrer_user_id=user_id),
        "kyc_verified_count": await count_kyc_verified_for_referrer(db, referrer_user_id=user_id),
        "first_investment_count": await count_first_investment_for_referrer(db, referrer_user_id=user_id),
    }
