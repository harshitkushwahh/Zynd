from __future__ import annotations

from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from app.application.goals.constants import (
    DEFAULT_EXPECTED_RETURN_PCT,
    MAX_DURATION_MONTHS,
    MAX_TARGET_AMOUNT_INR,
)
from app.application.goals.errors import GoalError
from app.application.mf.mf_projection_calculator import add_months


def _quantize_inr(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _decimal(value: Decimal | float | int | str) -> Decimal:
    return Decimal(str(value))


def _monthly_rate(annual_return_pct: Decimal) -> Decimal:
    annual = annual_return_pct / Decimal("100")
    return annual / Decimal("12")


def _future_value_lump_sum(principal: Decimal, monthly_rate: Decimal, months: int) -> Decimal:
    if months <= 0:
        return principal
    if monthly_rate == 0:
        return principal
    growth = (Decimal("1") + monthly_rate) ** months
    return _quantize_inr(principal * growth)


def _sip_future_value(monthly_amount: Decimal, monthly_rate: Decimal, months: int) -> Decimal:
    if months <= 0:
        return Decimal("0")
    if monthly_rate == 0:
        return _quantize_inr(monthly_amount * Decimal(months))
    growth = (Decimal("1") + monthly_rate) ** months
    factor = (growth - Decimal("1")) / monthly_rate
    return _quantize_inr(monthly_amount * factor)


def _required_monthly_sip(
    *,
    remaining_target_inr: Decimal,
    monthly_rate: Decimal,
    months: int,
) -> Decimal:
    if remaining_target_inr <= 0:
        return Decimal("0")
    if months <= 0:
        raise GoalError(
            code="invalid_duration",
            message="Duration must be at least 1 month to calculate required SIP.",
        )
    if monthly_rate == 0:
        return _quantize_inr(remaining_target_inr / Decimal(months))
    growth = (Decimal("1") + monthly_rate) ** months
    factor = (growth - Decimal("1")) / monthly_rate
    if factor <= 0:
        raise GoalError(code="calculation_error", message="Unable to calculate required SIP.")
    return _quantize_inr(remaining_target_inr / factor)


def months_until(target_date: date, *, from_date: date | None = None) -> int:
    base = from_date or date.today()
    if target_date <= base:
        return 0
    months = (target_date.year - base.year) * 12 + (target_date.month - base.month)
    if target_date.day < base.day:
        months -= 1
    return max(months, 0)


def calculate_goal_plan(
    *,
    target_amount_inr: Decimal | float,
    target_date: date,
    existing_savings_inr: Decimal | float = Decimal("0"),
    expected_return_pct: Decimal | float | None = None,
    from_date: date | None = None,
) -> dict[str, Any]:
    target_amount_inr = _decimal(target_amount_inr)
    existing_savings_inr = _decimal(existing_savings_inr)
    if target_amount_inr <= 0 or target_amount_inr > MAX_TARGET_AMOUNT_INR:
        raise GoalError(
            code="invalid_target",
            message=f"Target amount must be between 0 and {MAX_TARGET_AMOUNT_INR}.",
        )
    if existing_savings_inr < 0:
        raise GoalError(code="invalid_savings", message="Existing savings cannot be negative.")

    annual_return = _decimal(expected_return_pct or DEFAULT_EXPECTED_RETURN_PCT)
    if annual_return < 0 or annual_return > 100:
        raise GoalError(code="invalid_return", message="Expected return must be between 0 and 100.")

    duration_months = months_until(target_date, from_date=from_date)
    if duration_months < 1:
        raise GoalError(
            code="invalid_target_date",
            message="Target date must be at least one month in the future.",
        )
    if duration_months > MAX_DURATION_MONTHS:
        raise GoalError(
            code="invalid_duration",
            message=f"Target date exceeds maximum duration of {MAX_DURATION_MONTHS} months.",
        )

    monthly_rate = _monthly_rate(annual_return)
    savings_future = _future_value_lump_sum(existing_savings_inr, monthly_rate, duration_months)
    remaining = target_amount_inr - savings_future
    goal_covered = remaining <= 0

    if goal_covered:
        required_sip = Decimal("0")
        required_lumpsum = Decimal("0")
        projected_from_sip = target_amount_inr
    else:
        required_sip = _required_monthly_sip(
            remaining_target_inr=remaining,
            monthly_rate=monthly_rate,
            months=duration_months,
        )
        growth = (Decimal("1") + monthly_rate) ** duration_months
        required_lumpsum = _quantize_inr(max(remaining / growth, Decimal("0")))
        projected_from_sip = savings_future + _sip_future_value(
            required_sip,
            monthly_rate,
            duration_months,
        )
    progress_pct = float(
        (existing_savings_inr / target_amount_inr * Decimal("100")).quantize(Decimal("0.01"))
        if target_amount_inr > 0
        else Decimal("0")
    )

    milestones: list[dict[str, Any]] = []
    checkpoint_months = sorted(
        {
            duration_months // 4,
            duration_months // 2,
            (duration_months * 3) // 4,
            duration_months,
        }
    )
    base = from_date or date.today()
    for month_offset in checkpoint_months:
        if month_offset < 1:
            continue
        projected = (
            target_amount_inr
            if goal_covered
            else (
                savings_future
                if month_offset == duration_months
                else (
                    _future_value_lump_sum(existing_savings_inr, monthly_rate, month_offset)
                    + _sip_future_value(required_sip, monthly_rate, month_offset)
                )
            )
        )
        milestones.append(
            {
                "date": add_months(base, month_offset).isoformat(),
                "month_offset": month_offset,
                "projected_value_inr": float(projected),
            }
        )

    return {
        "target_amount_inr": float(target_amount_inr),
        "target_date": target_date.isoformat(),
        "duration_months": duration_months,
        "existing_savings_inr": float(existing_savings_inr),
        "expected_return_pct": float(annual_return),
        "required_monthly_sip_inr": float(required_sip),
        "required_lumpsum_inr": float(required_lumpsum),
        "projected_value_inr": float(projected_from_sip),
        "progress_pct": min(progress_pct, 100.0),
        "milestones": milestones,
    }
