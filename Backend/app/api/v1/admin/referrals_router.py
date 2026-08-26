from __future__ import annotations

from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.admin.referrals_schemas import (
    AdminReferralAttributionListResponse,
    AdminReferralAttributionResponse,
    AdminReferralLeaderboardConfigResponse,
    AdminReferralLeaderboardConfigUpdateRequest,
    AdminReferralLeaderboardEntryResponse,
    AdminReferralLeaderboardMonthsResponse,
    AdminReferralLeaderboardMonthResponse,
    AdminReferralLeaderboardResponse,
    AdminReferralMetricsResponse,
    AdminReferralProgramSettingsResponse,
    AdminReferralProgramSettingsUpdateRequest,
    AdminReferralReferrerDirectoryEntryResponse,
    AdminReferralReferrerDirectoryListResponse,
    AdminReferralRewardLedgerEntryResponse,
    AdminReferralRewardLedgerListResponse,
    AdminReferralRewardLedgerStatusUpdateRequest,
    AdminReferralRewardRuleCreateRequest,
    AdminReferralRewardRuleListResponse,
    AdminReferralRewardRuleResponse,
    AdminReferralRewardRuleUpdateRequest,
    AdminReferralSchemeResponse,
    AdminReferralUserSummaryResponse,
    AdminUserReferralsResponse,
)
from app.api.v1.auth.deps import require_permission
from app.application.admin.referral_admin_service import (
    get_admin_referral_metrics,
    get_admin_referral_scheme_with_rules,
    get_admin_user_referrals,
    list_admin_referral_attributions,
    list_admin_referral_leaderboard,
)
from app.application.admin.user_admin_service import get_user_by_reference
from app.application.referral.referral_leaderboard_service import (
    compute_and_store_leaderboard_snapshot,
    snapshot_exists,
)
from app.application.referral.referral_program_service import (
    get_referral_leaderboard_config,
    get_referral_program_settings,
    is_month_period_key,
    list_recent_month_period_keys,
    serialize_leaderboard_config,
    serialize_program_settings,
    update_referral_leaderboard_config,
    update_referral_program_settings,
)
from app.application.referral.referral_reward_service import (
    create_referral_reward_rule,
    get_referral_reward_rule,
    list_admin_referrers_directory,
    list_referral_reward_ledger,
    list_referral_reward_rules,
    sync_referral_reward_ledger,
    update_referral_reward_ledger_status,
    update_referral_reward_rule,
    get_referral_reward_ledger_entry,
)
from app.core.database import get_db
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.referral_models import ReferralStage
from app.infrastructure.persistence.referral_reward_models import (
    ReferralRewardLedgerStatus,
    ReferralRewardTrigger,
    ReferralRewardType,
)

router = APIRouter(prefix="/referrals", tags=["admin-referrals"])


def _parse_stage(value: str | None) -> ReferralStage | None:
    if not value:
        return None
    try:
        return ReferralStage(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_stage", "message": "Invalid referral stage filter."},
        ) from exc


def _parse_period(value: str) -> str:
    allowed = {"this_month", "last_3_months", "all_time"}
    if value in allowed or is_month_period_key(value):
        return value
    raise HTTPException(
        status_code=400,
        detail={"code": "invalid_period", "message": "Invalid leaderboard period."},
    )


def _parse_ledger_status(value: str | None) -> ReferralRewardLedgerStatus | None:
    if not value or value == "all":
        return None
    try:
        return ReferralRewardLedgerStatus(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_status", "message": "Invalid ledger status filter."},
        ) from exc


def _serialize_rule(rule) -> AdminReferralRewardRuleResponse:
    return AdminReferralRewardRuleResponse(
        id=str(rule.id),
        name=rule.name,
        description=rule.description,
        trigger=rule.trigger.value,
        reward_type=rule.reward_type.value,
        reward_value=rule.reward_value,
        min_investment_inr=rule.min_investment_inr,
        valid_from=rule.valid_from,
        valid_to=rule.valid_to,
        is_active=rule.is_active,
        sort_order=rule.sort_order,
    )


@router.get("/metrics", response_model=AdminReferralMetricsResponse)
async def get_referrals_metrics(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("referrals.read"))],
) -> AdminReferralMetricsResponse:
    return AdminReferralMetricsResponse(**await get_admin_referral_metrics(db))


@router.get("/scheme", response_model=AdminReferralSchemeResponse)
async def get_referrals_scheme(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("referrals.read"))],
) -> AdminReferralSchemeResponse:
    return AdminReferralSchemeResponse(**await get_admin_referral_scheme_with_rules(db))


@router.get("/referrers", response_model=AdminReferralReferrerDirectoryListResponse)
async def get_referral_referrers_directory(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("referrals.read"))],
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> AdminReferralReferrerDirectoryListResponse:
    items = await list_admin_referrers_directory(
        db,
        search=search,
        limit=limit,
        offset=offset,
    )
    return AdminReferralReferrerDirectoryListResponse(
        items=[AdminReferralReferrerDirectoryEntryResponse(**item) for item in items],
        limit=limit,
        offset=offset,
    )


@router.get("/attributions", response_model=AdminReferralAttributionListResponse)
async def get_referral_attributions(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("referrals.read"))],
    stage: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    pending_only: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> AdminReferralAttributionListResponse:
    items = await list_admin_referral_attributions(
        db,
        stage=_parse_stage(stage),
        search=search,
        pending_only=pending_only,
        limit=limit,
        offset=offset,
    )
    return AdminReferralAttributionListResponse(
        items=[AdminReferralAttributionResponse(**item) for item in items],
        limit=limit,
        offset=offset,
    )


@router.get("/leaderboard", response_model=AdminReferralLeaderboardResponse)
async def get_referral_leaderboard_admin(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("referrals.read"))],
    period: str = Query(default="all_time"),
    limit: int = Query(default=25, ge=1, le=100),
) -> AdminReferralLeaderboardResponse:
    parsed_period = _parse_period(period)
    items = await list_admin_referral_leaderboard(
        db,
        period=parsed_period,
        limit=limit,
    )
    is_snapshot = False
    is_final = False
    if is_month_period_key(parsed_period):
        is_snapshot = await snapshot_exists(db, period_key=parsed_period)
        if is_snapshot:
            from sqlalchemy import select

            from app.infrastructure.persistence.referral_program_models import ReferralLeaderboardSnapshot

            row = (
                await db.execute(
                    select(ReferralLeaderboardSnapshot.is_final)
                    .where(ReferralLeaderboardSnapshot.period_key == parsed_period)
                    .limit(1)
                )
            ).scalar_one_or_none()
            is_final = bool(row)
    return AdminReferralLeaderboardResponse(
        period=parsed_period,
        is_snapshot=is_snapshot,
        is_final=is_final,
        items=[AdminReferralLeaderboardEntryResponse(**item) for item in items],
    )


@router.get("/leaderboard/months", response_model=AdminReferralLeaderboardMonthsResponse)
async def get_referral_leaderboard_months(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("referrals.read"))],
    count: int = Query(default=12, ge=1, le=24),
) -> AdminReferralLeaderboardMonthsResponse:
    program_settings = await get_referral_program_settings(db)
    keys = list_recent_month_period_keys(count=count, timezone_name=program_settings.timezone)
    current_key = keys[0]
    items: list[AdminReferralLeaderboardMonthResponse] = []
    for key in keys:
        year, month = map(int, key.split("-"))
        label = datetime(year, month, 1).strftime("%B %Y")
        items.append(
            AdminReferralLeaderboardMonthResponse(
                period_key=key,
                label=label,
                has_snapshot=await snapshot_exists(db, period_key=key),
                is_current=key == current_key,
            )
        )
    return AdminReferralLeaderboardMonthsResponse(items=items)


@router.get("/leaderboard/config", response_model=AdminReferralLeaderboardConfigResponse)
async def get_referral_leaderboard_config_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("referrals.read"))],
) -> AdminReferralLeaderboardConfigResponse:
    config = await get_referral_leaderboard_config(db)
    return AdminReferralLeaderboardConfigResponse(**serialize_leaderboard_config(config))


@router.patch("/leaderboard/config", response_model=AdminReferralLeaderboardConfigResponse)
async def update_referral_leaderboard_config_route(
    body: AdminReferralLeaderboardConfigUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("referrals.manage"))],
) -> AdminReferralLeaderboardConfigResponse:
    updated = await update_referral_leaderboard_config(
        db,
        payload=body.model_dump(exclude_unset=True),
    )
    await db.commit()
    return AdminReferralLeaderboardConfigResponse(**serialize_leaderboard_config(updated))


@router.post("/leaderboard/snapshot")
async def snapshot_referral_leaderboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("referrals.manage"))],
    period: str = Query(...),
    finalize: bool = Query(default=False),
    limit: int = Query(default=200, ge=1, le=500),
) -> dict[str, int | str]:
    parsed_period = _parse_period(period)
    if not is_month_period_key(parsed_period):
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_period", "message": "Snapshots require a YYYY-MM period."},
        )
    result = await compute_and_store_leaderboard_snapshot(
        db,
        period_key=parsed_period,
        finalize=finalize,
        limit=limit,
    )
    await db.commit()
    return result


@router.get("/program-settings", response_model=AdminReferralProgramSettingsResponse)
async def get_referral_program_settings_route(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("referrals.read"))],
) -> AdminReferralProgramSettingsResponse:
    settings = await get_referral_program_settings(db)
    return AdminReferralProgramSettingsResponse(**serialize_program_settings(settings))


@router.patch("/program-settings", response_model=AdminReferralProgramSettingsResponse)
async def update_referral_program_settings_route(
    body: AdminReferralProgramSettingsUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("referrals.manage"))],
) -> AdminReferralProgramSettingsResponse:
    updated = await update_referral_program_settings(
        db,
        payload=body.model_dump(exclude_unset=True),
    )
    await db.commit()
    return AdminReferralProgramSettingsResponse(**serialize_program_settings(updated))


@router.get("/reward-rules", response_model=AdminReferralRewardRuleListResponse)
async def get_referral_reward_rules(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("referrals.read"))],
) -> AdminReferralRewardRuleListResponse:
    rules = await list_referral_reward_rules(db, include_inactive=True)
    return AdminReferralRewardRuleListResponse(items=[_serialize_rule(rule) for rule in rules])


@router.post("/reward-rules", response_model=AdminReferralRewardRuleResponse)
async def create_referral_reward_rule_route(
    body: AdminReferralRewardRuleCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("referrals.manage"))],
) -> AdminReferralRewardRuleResponse:
    rule = await create_referral_reward_rule(
        db,
        payload={
            "name": body.name.strip(),
            "description": body.description,
            "trigger": ReferralRewardTrigger(body.trigger),
            "reward_type": ReferralRewardType(body.reward_type),
            "reward_value": body.reward_value,
            "min_investment_inr": body.min_investment_inr,
            "valid_from": body.valid_from,
            "valid_to": body.valid_to,
            "is_active": body.is_active,
            "sort_order": body.sort_order,
        },
    )
    await db.commit()
    return _serialize_rule(rule)


@router.patch("/reward-rules/{rule_id}", response_model=AdminReferralRewardRuleResponse)
async def update_referral_reward_rule_route(
    rule_id: str,
    body: AdminReferralRewardRuleUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("referrals.manage"))],
) -> AdminReferralRewardRuleResponse:
    from uuid import UUID

    rule = await get_referral_reward_rule(db, rule_id=UUID(rule_id))
    if rule is None:
        raise HTTPException(status_code=404, detail={"code": "rule_not_found", "message": "Rule not found."})

    payload = body.model_dump(exclude_unset=True)
    if "trigger" in payload and payload["trigger"] is not None:
        payload["trigger"] = ReferralRewardTrigger(payload["trigger"])
    if "reward_type" in payload and payload["reward_type"] is not None:
        payload["reward_type"] = ReferralRewardType(payload["reward_type"])
    if "name" in payload and payload["name"] is not None:
        payload["name"] = payload["name"].strip()

    updated = await update_referral_reward_rule(db, rule=rule, payload=payload)
    await db.commit()
    return _serialize_rule(updated)


@router.get("/redemptions", response_model=AdminReferralRewardLedgerListResponse)
async def get_referral_redemptions(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("referrals.read"))],
    status: Optional[str] = Query(default="all"),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> AdminReferralRewardLedgerListResponse:
    items = await list_referral_reward_ledger(
        db,
        status=_parse_ledger_status(status),
        search=search,
        limit=limit,
        offset=offset,
    )
    return AdminReferralRewardLedgerListResponse(
        items=[AdminReferralRewardLedgerEntryResponse(**item) for item in items],
        limit=limit,
        offset=offset,
    )


@router.patch("/redemptions/{entry_id}", response_model=AdminReferralRewardLedgerEntryResponse)
async def update_referral_redemption_status(
    entry_id: str,
    body: AdminReferralRewardLedgerStatusUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("referrals.manage"))],
) -> AdminReferralRewardLedgerEntryResponse:
    from uuid import UUID

    try:
        updated = await update_referral_reward_ledger_status(
            db,
            ledger_id=UUID(entry_id),
            status=ReferralRewardLedgerStatus(body.status),
            notes=body.notes,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": "redemption_not_eligible", "message": str(exc)},
        ) from exc
    if updated is None:
        raise HTTPException(status_code=404, detail={"code": "entry_not_found", "message": "Entry not found."})
    await db.commit()
    match = await get_referral_reward_ledger_entry(db, ledger_id=UUID(entry_id))
    if match is None:
        raise HTTPException(status_code=404, detail={"code": "entry_not_found", "message": "Entry not found."})
    return AdminReferralRewardLedgerEntryResponse(**match)


@router.post("/redemptions/sync")
async def sync_referral_redemptions(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("referrals.manage"))],
    limit: int = Query(default=200, ge=1, le=500),
) -> dict[str, int]:
    result = await sync_referral_reward_ledger(db, limit=limit)
    await db.commit()
    return result


@router.get("/users/{user_ref}", response_model=AdminUserReferralsResponse)
async def get_user_referrals_admin(
    user_ref: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("referrals.read"))],
) -> AdminUserReferralsResponse:
    user = await get_user_by_reference(db, user_ref)
    if user is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "user_not_found", "message": "User not found."},
        )

    payload = await get_admin_user_referrals(db, user_id=user.id)
    return AdminUserReferralsResponse(
        user=AdminReferralUserSummaryResponse(**payload["user"]),
        referral_code=payload.get("referral_code"),
        referral_code_active=payload.get("referral_code_active", False),
        share_url=payload.get("share_url"),
        click_count=payload.get("click_count", 0),
        counts=payload["counts"],
        total_estimated_earnings_inr=payload.get("total_estimated_earnings_inr", 0),
        referrals=[AdminReferralAttributionResponse(**item) for item in payload.get("referrals", [])],
        referred_by=(
            AdminReferralAttributionResponse(**payload["referred_by"])
            if payload.get("referred_by")
            else None
        ),
    )
