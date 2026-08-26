"""Referral reward rules, accrual, and payout ledger."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.referral.referral_attribution_service import referral_stage_at_or_beyond
from app.application.referral.referral_code_service import get_referral_code_for_user
from app.application.referral.referral_leaderboard_service import REFERRAL_REWARD_RATE, display_name_for_user
from app.application.shared.datetime_utils import utcnow
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.referral_models import (
    ReferralAttribution,
    ReferralClick,
    ReferralCode,
    ReferralStage,
)
from app.infrastructure.persistence.referral_reward_models import (
    ReferralRewardLedger,
    ReferralRewardLedgerStatus,
    ReferralRewardRule,
    ReferralRewardTrigger,
    ReferralRewardType,
)


def _rule_applies(rule: ReferralRewardRule, *, at: datetime, investment_inr: int | None) -> bool:
    if not rule.is_active:
        return False
    if rule.valid_from is not None and at < rule.valid_from:
        return False
    if rule.valid_to is not None and at > rule.valid_to:
        return False
    if rule.min_investment_inr is not None:
        if investment_inr is None or investment_inr < rule.min_investment_inr:
            return False
    return True


def _compute_amount_inr(
    rule: ReferralRewardRule,
    *,
    investment_inr: int | None,
) -> int:
    if rule.reward_type == ReferralRewardType.flat_inr:
        return max(rule.reward_value, 0)
    if investment_inr is None:
        return 0
    return max(int(round(investment_inr * (rule.reward_value / 100))), 0)
    # reward_value for percent is whole percent e.g. 2 = 2%


def compute_reward_amount_inr(
    rules: list[ReferralRewardRule],
    *,
    trigger: ReferralRewardTrigger,
    at: datetime,
    investment_inr: int | None,
) -> tuple[int, ReferralRewardRule | None]:
    matching = [
        rule
        for rule in rules
        if rule.trigger == trigger and _rule_applies(rule, at=at, investment_inr=investment_inr)
    ]
    matching.sort(key=lambda item: (item.sort_order, item.created_at))
    if not matching:
        if trigger == ReferralRewardTrigger.first_investment and investment_inr is not None:
            return int(round(investment_inr * REFERRAL_REWARD_RATE)), None
        return 0, None

    best = matching[0]
    return _compute_amount_inr(best, investment_inr=investment_inr), best


async def list_referral_reward_rules(
    db: AsyncSession,
    *,
    include_inactive: bool = True,
) -> list[ReferralRewardRule]:
    stmt = select(ReferralRewardRule).order_by(
        ReferralRewardRule.sort_order.asc(),
        ReferralRewardRule.created_at.asc(),
    )
    if not include_inactive:
        stmt = stmt.where(ReferralRewardRule.is_active.is_(True))
    return list((await db.execute(stmt)).scalars())


async def get_referral_reward_rule(db: AsyncSession, *, rule_id: UUID) -> ReferralRewardRule | None:
    return await db.get(ReferralRewardRule, rule_id)


async def create_referral_reward_rule(
    db: AsyncSession,
    *,
    payload: dict[str, Any],
) -> ReferralRewardRule:
    rule = ReferralRewardRule(**payload)
    db.add(rule)
    await db.flush()
    return rule


async def update_referral_reward_rule(
    db: AsyncSession,
    *,
    rule: ReferralRewardRule,
    payload: dict[str, Any],
) -> ReferralRewardRule:
    for key, value in payload.items():
        setattr(rule, key, value)
    await db.flush()
    return rule


async def estimate_reward_inr_for_attribution(
    db: AsyncSession,
    attribution: ReferralAttribution,
) -> int:
    if not referral_stage_at_or_beyond(attribution.current_stage, ReferralStage.first_investment):
        return 0
    if attribution.first_investment_amount_inr is None:
        return 0
    at = attribution.first_investment_at or attribution.signed_up_at
    rules = await list_referral_reward_rules(db, include_inactive=False)
    amount, _ = compute_reward_amount_inr(
        rules,
        trigger=ReferralRewardTrigger.first_investment,
        at=at,
        investment_inr=attribution.first_investment_amount_inr,
    )
    return amount


async def accrue_referral_reward_for_attribution(
    db: AsyncSession,
    *,
    attribution: ReferralAttribution,
    trigger: ReferralRewardTrigger = ReferralRewardTrigger.first_investment,
    earned_at: datetime | None = None,
) -> ReferralRewardLedger | None:
    if not referral_stage_at_or_beyond(attribution.current_stage, ReferralStage.qualified):
        return None
    if attribution.first_investment_amount_inr is None:
        return None

    existing = await db.execute(
        select(ReferralRewardLedger).where(
            ReferralRewardLedger.attribution_id == attribution.id,
            ReferralRewardLedger.trigger == trigger,
        )
    )
    if existing.scalar_one_or_none() is not None:
        return None

    at = earned_at or attribution.qualified_at or utcnow()
    rules = await list_referral_reward_rules(db, include_inactive=False)
    amount, rule = compute_reward_amount_inr(
        rules,
        trigger=trigger,
        at=at,
        investment_inr=attribution.first_investment_amount_inr,
    )
    if amount <= 0:
        return None

    ledger = ReferralRewardLedger(
        attribution_id=attribution.id,
        referrer_user_id=attribution.referrer_user_id,
        referee_user_id=attribution.referee_user_id,
        rule_id=rule.id if rule else None,
        rule_name=rule.name if rule else "Legacy 2% reward",
        trigger=trigger,
        amount_inr=amount,
        status=ReferralRewardLedgerStatus.pending,
        earned_at=at,
    )
    db.add(ledger)
    await db.flush()
    return ledger


async def sync_referral_reward_ledger(db: AsyncSession, *, limit: int = 200) -> dict[str, int]:
    result = await db.execute(
        select(ReferralAttribution)
        .where(ReferralAttribution.current_stage.in_([ReferralStage.qualified, ReferralStage.engaged]))
        .order_by(ReferralAttribution.qualified_at.asc().nullslast())
        .limit(limit)
    )
    rows = list(result.scalars())
    created = 0
    for attribution in rows:
        ledger = await accrue_referral_reward_for_attribution(db, attribution=attribution)
        if ledger is not None:
            created += 1
    return {"processed": len(rows), "created": created}


async def list_referral_reward_ledger(
    db: AsyncSession,
    *,
    status: ReferralRewardLedgerStatus | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    from app.application.admin.referral_admin_service import _user_summary

    ReferrerUser = User.__table__.alias("referrer_user")
    RefereeUser = User.__table__.alias("referee_user")

    stmt = (
        select(ReferralRewardLedger, User)
        .join(User, User.id == ReferralRewardLedger.referrer_user_id)
        .order_by(ReferralRewardLedger.earned_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if status is not None:
        stmt = stmt.where(ReferralRewardLedger.status == status)
    if search:
        term = f"%{search.strip()}%"
        referee_subq = select(User.id).where(
            or_(
                User.email.ilike(term),
                User.client_id.ilike(term),
                User.first_name.ilike(term),
                User.last_name.ilike(term),
            )
        )
        stmt = stmt.where(
            or_(
                User.email.ilike(term),
                User.client_id.ilike(term),
                User.first_name.ilike(term),
                User.last_name.ilike(term),
                ReferralRewardLedger.rule_name.ilike(term),
                ReferralRewardLedger.referee_user_id.in_(referee_subq),
            )
        )

    rows = (await db.execute(stmt)).all()
    items: list[dict[str, Any]] = []
    for ledger, referrer in rows:
        referee = await db.get(User, ledger.referee_user_id)
        items.append(
            {
                "id": str(ledger.id),
                "attribution_id": str(ledger.attribution_id),
                "rule_id": str(ledger.rule_id) if ledger.rule_id else None,
                "rule_name": ledger.rule_name,
                "trigger": ledger.trigger.value,
                "amount_inr": ledger.amount_inr,
                "status": ledger.status.value,
                "earned_at": ledger.earned_at,
                "paid_at": ledger.paid_at,
                "notes": ledger.notes,
                "referrer": _user_summary(referrer),
                "referee": _user_summary(referee),
            }
        )
    return items


async def update_referral_reward_ledger_status(
    db: AsyncSession,
    *,
    ledger_id: UUID,
    status: ReferralRewardLedgerStatus,
    notes: str | None = None,
) -> ReferralRewardLedger | None:
    from app.application.referral.referral_attribution_service import count_qualified_for_referrer
    from app.application.referral.referral_program_service import get_referral_program_settings

    ledger = await db.get(ReferralRewardLedger, ledger_id)
    if ledger is None:
        return None

    if status == ReferralRewardLedgerStatus.paid:
        program_settings = await get_referral_program_settings(db)
        qualified_count = await count_qualified_for_referrer(
            db,
            referrer_user_id=ledger.referrer_user_id,
        )
        if qualified_count < program_settings.min_referrals_to_redeem:
            raise ValueError(
                f"Referrer needs at least {program_settings.min_referrals_to_redeem} qualified referrals "
                f"before rewards can be redeemed (currently {qualified_count})."
            )

    ledger.status = status
    if notes is not None:
        ledger.notes = notes
    if status == ReferralRewardLedgerStatus.paid:
        ledger.paid_at = utcnow()
    elif status in {ReferralRewardLedgerStatus.pending, ReferralRewardLedgerStatus.approved}:
        ledger.paid_at = None
    await db.flush()
    return ledger


async def get_referral_reward_ledger_entry(
    db: AsyncSession,
    *,
    ledger_id: UUID,
) -> dict[str, Any] | None:
    from app.application.admin.referral_admin_service import _user_summary

    ledger = await db.get(ReferralRewardLedger, ledger_id)
    if ledger is None:
        return None
    referrer = await db.get(User, ledger.referrer_user_id)
    referee = await db.get(User, ledger.referee_user_id)
    return {
        "id": str(ledger.id),
        "attribution_id": str(ledger.attribution_id),
        "rule_id": str(ledger.rule_id) if ledger.rule_id else None,
        "rule_name": ledger.rule_name,
        "trigger": ledger.trigger.value,
        "amount_inr": ledger.amount_inr,
        "status": ledger.status.value,
        "earned_at": ledger.earned_at,
        "paid_at": ledger.paid_at,
        "notes": ledger.notes,
        "referrer": _user_summary(referrer),
        "referee": _user_summary(referee),
    }


async def list_admin_referrers_directory(
    db: AsyncSession,
    *,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    from app.application.admin.referral_admin_service import _user_summary

    referral_count_expr = func.count(ReferralAttribution.id)
    stmt = (
        select(
            ReferralAttribution.referrer_user_id,
            referral_count_expr.label("referral_count"),
        )
        .join(User, User.id == ReferralAttribution.referrer_user_id)
        .group_by(ReferralAttribution.referrer_user_id)
        .order_by(referral_count_expr.desc())
        .limit(limit)
        .offset(offset)
    )
    if search:
        term = f"%{search.strip()}%"
        code_subq = select(ReferralCode.user_id).where(ReferralCode.code.ilike(term))
        stmt = stmt.where(
            or_(
                User.email.ilike(term),
                User.client_id.ilike(term),
                User.first_name.ilike(term),
                User.last_name.ilike(term),
                ReferralAttribution.referrer_user_id.in_(code_subq),
            )
        )

    aggregate_rows = list((await db.execute(stmt)).all())
    if not aggregate_rows:
        return []

    user_ids = [row.referrer_user_id for row in aggregate_rows]
    users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_by_id = {user.id: user for user in users_result.scalars()}

    items: list[dict[str, Any]] = []
    for row in aggregate_rows:
        user = users_by_id.get(row.referrer_user_id)
        if user is None:
            continue

        code_row = await get_referral_code_for_user(db, user_id=row.referrer_user_id)
        click_count = 0
        if code_row is not None:
            click_count = int(
                (
                    await db.execute(
                        select(func.count())
                        .select_from(ReferralClick)
                        .where(ReferralClick.referral_code_id == code_row.id)
                    )
                ).scalar_one()
            )

        attributions_result = await db.execute(
            select(ReferralAttribution).where(
                ReferralAttribution.referrer_user_id == row.referrer_user_id
            )
        )
        attributions = list(attributions_result.scalars())
        estimated_earnings = 0
        paid_earnings = 0
        for attribution in attributions:
            estimated_earnings += await estimate_reward_inr_for_attribution(db, attribution)

        ledger_result = await db.execute(
            select(func.coalesce(func.sum(ReferralRewardLedger.amount_inr), 0)).where(
                ReferralRewardLedger.referrer_user_id == row.referrer_user_id,
                ReferralRewardLedger.status == ReferralRewardLedgerStatus.paid,
            )
        )
        paid_earnings = int(ledger_result.scalar_one() or 0)

        items.append(
            {
                "referral_count": int(row.referral_count or 0),
                "click_count": click_count,
                "estimated_earnings_inr": estimated_earnings,
                "paid_earnings_inr": paid_earnings,
                "referral_code": code_row.code if code_row else None,
                "referral_code_active": code_row.is_active if code_row else False,
                "user": _user_summary(user),
                "display_name": display_name_for_user(user),
            }
        )
    return items
