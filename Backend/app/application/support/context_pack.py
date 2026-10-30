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
    if "account" in selected or "settings" in selected or "kyc" in selected:
        pack["settings"] = await _safe("settings", lambda: _settings_slice(db, user.id))
    if "account" in selected:
        pack["account"] = await _safe("account", lambda: _account_slice(db, user.id))
    if "risk_profile" in selected:
        pack["risk_profile"] = await _safe("risk_profile", lambda: _risk_profile_slice(db, user.id))
    if "reports" in selected:
        pack["reports"] = await _safe("reports", lambda: _reports_slice(db, user.id))
    if "payment" in selected or "cart" in selected:
        pack["cart"] = await _safe("cart", lambda: _cart_slice(db, user.id))
    if "referrals" in selected:
        pack["referrals"] = await _safe("referrals", lambda: _referral_slice(db, user.id))
    return pack


async def _primary_residential_address(db: AsyncSession, user_id: UUID) -> dict[str, Any] | None:
    from app.infrastructure.persistence.investor_models import InvestorAddress

    row = await db.scalar(
        select(InvestorAddress)
        .where(
            InvestorAddress.investor_profile_id == user_id,
            InvestorAddress.is_primary.is_(True),
        )
        .limit(1)
    )
    if row is None:
        return None
    return {
        "on_file": True,
        "city": row.city,
        "state": row.state,
        "postal_code": row.postal_code,
        "country": row.country,
    }


async def _kyc_slice(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    status = await db.get(UserKycStatus, user_id)
    journey = await db.get(KycJourneyState, user_id)
    residential_address = await _primary_residential_address(db, user_id)
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
        "residential_address": residential_address,
    }


def order_row_from_mf_order(order) -> dict[str, Any]:
    from app.application.mf.mf_order_service import order_payment_completed

    status = _enum_value(order.status)
    payment_completed = order_payment_completed(order)
    return {
        "order_id": str(order.id),
        "amount": _money(order.amount_inr),
        "status": status,
        "type": _enum_value(order.order_type),
        "payment_completed": payment_completed,
        "failure_code": order.failure_code,
        "failure_reason": (order.failure_reason or "")[:240] or None,
        "created_at": _iso(order.created_at),
        "submitted_at": _iso(order.submitted_at),
        "settled_at": _iso(order.settled_at),
        "found": True,
    }


def _order_is_payment_complete(row: dict[str, Any]) -> bool:
    return bool(row.get("payment_completed")) or row.get("status") == "SUCCEEDED"


def _order_activity_time(row: dict[str, Any]) -> str:
    return str(row.get("settled_at") or row.get("submitted_at") or row.get("created_at") or "")


async def _payment_slice(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    from app.application.mf.mf_order_service import list_user_orders
    from app.application.mf.mf_sip_plan_service import list_user_sip_plans

    orders = await list_user_orders(db, user_id=user_id, limit=50)
    plans = await list_user_sip_plans(db, user_id=user_id, limit=8)

    order_rows = [order_row_from_mf_order(order) for order in orders]

    last_sip_debit = None
    last_sip_failure = None
    sip_debit_candidates: list[dict[str, Any]] = []
    for row in order_rows:
        if row.get("type") != "SIP":
            continue
        if _order_is_payment_complete(row):
            sip_debit_candidates.append(row)
        if row.get("status") == "FAILED" and last_sip_failure is None:
            last_sip_failure = row
    if sip_debit_candidates:
        sip_debit_candidates.sort(key=_order_activity_time, reverse=True)
        last_sip_debit = sip_debit_candidates[0]

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

    completed_orders = [row for row in order_rows if _order_is_payment_complete(row)]
    completed_orders.sort(key=_order_activity_time, reverse=True)
    failed_orders = [row for row in order_rows if row.get("status") == "FAILED"][:8]
    last_completed_payment = completed_orders[0] if completed_orders else None

    return {
        "last_completed_payment": last_completed_payment,
        "last_sip_debit": last_sip_debit,
        "last_sip_failure": last_sip_failure,
        "failed_sip_plans": failed_plans[:3],
        "recent_payment_completed_orders": completed_orders[:8],
        "recent_successful_orders": completed_orders[:8],
        "recent_failed_orders": failed_orders,
        "recent_orders": order_rows[:12],
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
    from app.application.auth.session_service import list_user_sessions

    user = await db.get(User, user_id)
    if user is None:
        return {"available": False}

    oauth_rows = await db.scalars(select(OAuthAccount).where(OAuthAccount.user_id == user_id))
    providers = {row.provider for row in oauth_rows}
    sessions = await list_user_sessions(db, user_id=user_id)
    device_keys = {
        (row.get("os") or "unknown", row.get("browser") or "unknown") for row in sessions
    }

    return {
        "account_status": _enum_value(user.status),
        "email_verified": user.email_verified_at is not None,
        "email_verified_at": _iso(user.email_verified_at),
        "email_changed_at": _iso(user.email_changed_at),
        "phone_verified": user.phone_verified_at is not None,
        "phone_verified_at": _iso(user.phone_verified_at),
        "mfa_enrolled": user.mfa_enrolled_at is not None,
        "mfa_enrolled_at": _iso(user.mfa_enrolled_at),
        "pin_enrolled": bool(user.pin_hash and str(user.pin_hash).strip()),
        "pin_set_at": _iso(user.pin_set_at),
        "password_changed_at": _iso(user.password_changed_at),
        "has_password_login": bool(user.password_hash),
        "google_account_linked": OAuthProvider.google in providers,
        "apple_account_linked": OAuthProvider.apple in providers,
        "linked_sign_in_providers": sorted(_enum_value(provider) or "" for provider in providers),
        "country_code": user.country_code,
        "active_session_count": len(sessions),
        "active_device_count": len(device_keys),
    }


async def _settings_slice(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    from app.application.auth.mfa_service import get_backup_codes_status
    from app.infrastructure.persistence.investor_models import InvestorProfile, InvestorRelatedParty

    user = await db.get(User, user_id)
    backup = await get_backup_codes_status(db, user_id)
    nominee_count = 0
    nominee_last_updated_at = None
    nominee_last_update_source = None
    profile = await db.get(InvestorProfile, user_id)
    if profile is not None:
        rows = await db.scalars(
            select(InvestorRelatedParty).where(InvestorRelatedParty.investor_profile_id == user_id)
        )
        parties = list(rows)
        nominee_count = len(parties)
        if parties:
            latest = max(parties, key=lambda row: row.updated_at)
            nominee_last_updated_at = _iso(latest.updated_at)
            nominee_last_update_source = _enum_value(latest.source)

    return {
        "nominee_count": nominee_count,
        "nominee_last_updated_at": nominee_last_updated_at,
        "nominee_last_update_source": nominee_last_update_source,
        "backup_codes_total": backup.get("total", 0),
        "backup_codes_remaining": backup.get("remaining", 0),
        "pin_enrolled": bool(user and user.pin_hash and str(user.pin_hash).strip()),
        "pin_set_at": _iso(user.pin_set_at) if user else None,
    }


async def _risk_profile_slice(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    from app.application.risk_profile.scoring_service import get_user_risk_profile

    profile = await get_user_risk_profile(db, user_id)
    if not profile:
        return {"has_profile": False}
    tier_cfg = profile.get("tier_config") if isinstance(profile.get("tier_config"), dict) else {}
    return {
        "has_profile": True,
        "tier": profile.get("tier"),
        "tier_label": tier_cfg.get("label") or profile.get("tier"),
        "score": profile.get("score"),
        "display_score": profile.get("display_score"),
        "computed_at": profile.get("computed_at"),
        "updated_at": profile.get("updated_at"),
        "questions_answered": profile.get("questions_answered"),
    }


async def _reports_slice(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    from app.application.mf.investor_report_service import REPORT_TITLES, list_investor_reports

    rows = await list_investor_reports(db, user_id=user_id)
    last = rows[0] if rows else None
    last_payload = None
    if last:
        from app.infrastructure.persistence.mf_transaction_models import MfGeneratedReportKind

        kind = last.get("kind")
        kind_label = str(kind or "report")
        try:
            kind_label = REPORT_TITLES.get(MfGeneratedReportKind(kind), kind_label)
        except ValueError:
            kind_label = str(kind).replace("_", " ").title()
        last_payload = {
            "kind": kind,
            "kind_label": kind_label,
            "status": last.get("status"),
            "generated_at": last.get("generated_at"),
            "period_to": last.get("period_to"),
        }
    return {
        "report_count": len(rows),
        "last_generated": last_payload,
        "recent": [
            {
                "kind": row.get("kind"),
                "status": row.get("status"),
                "generated_at": row.get("generated_at"),
            }
            for row in rows[:3]
        ],
    }


async def _cart_slice(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    from app.application.mf.mf_cart_service import list_cart_items

    items = await list_cart_items(db, user_id=user_id)
    return {"item_count": len(items)}


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
