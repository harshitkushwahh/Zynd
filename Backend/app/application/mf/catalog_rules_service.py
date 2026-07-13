from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_audit
from app.application.mf.catalog_lifecycle_service import is_lifecycle_sync_blocked
from app.application.mf.catalog_lifecycle_service import resolve_lifecycle_status
from app.application.mf.category_curation_service import add_fund_to_category
from app.application.mf.invest_catalog_invalidation import notify_invest_catalog_changed
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import (
    AdminInvestability,
    AdminVisibility,
    FundAmc,
    MfCatalogRule,
    MfCatalogRuleRun,
    MutualFund,
    Product,
    ProductCategory,
    ProductLifecycleStatus,
)
from app.infrastructure.persistence.models import AuditEventType


def _serialize_rule(rule: MfCatalogRule) -> dict:
    return {
        "id": rule.id,
        "name": rule.name,
        "description": rule.description,
        "priority": rule.priority,
        "enabled": rule.enabled,
        "conditions": rule.conditions,
        "actions": rule.actions,
        "created_by": str(rule.created_by) if rule.created_by else None,
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
        "updated_at": rule.updated_at.isoformat() if rule.updated_at else None,
    }


async def list_catalog_rules(session: AsyncSession) -> list[dict]:
    rows = (
        await session.execute(
            select(MfCatalogRule).order_by(MfCatalogRule.priority, MfCatalogRule.name)
        )
    ).scalars()
    return [_serialize_rule(rule) for rule in rows]


async def get_catalog_rule(session: AsyncSession, rule_id: int) -> dict | None:
    rule = await session.get(MfCatalogRule, rule_id)
    if not rule:
        return None
    return _serialize_rule(rule)


async def create_catalog_rule(
    session: AsyncSession,
    *,
    admin_user_id: UUID,
    name: str,
    conditions: dict,
    actions: dict,
    description: str | None = None,
    priority: int = 100,
    enabled: bool = False,
) -> dict:
    rule = MfCatalogRule(
        name=name.strip(),
        description=description.strip() if description else None,
        priority=priority,
        enabled=enabled,
        conditions=conditions,
        actions=actions,
        created_by=admin_user_id,
    )
    session.add(rule)
    await session.flush()
    await write_audit(
        session,
        event_type=AuditEventType.mf_catalog_rule_created,
        user_id=admin_user_id,
        metadata={"rule_id": rule.id, "name": rule.name},
    )
    return _serialize_rule(rule)


async def update_catalog_rule(
    session: AsyncSession,
    rule_id: int,
    *,
    admin_user_id: UUID,
    name: str | None = None,
    description: str | None = None,
    priority: int | None = None,
    enabled: bool | None = None,
    conditions: dict | None = None,
    actions: dict | None = None,
) -> dict | None:
    rule = await session.get(MfCatalogRule, rule_id)
    if not rule:
        return None
    before = _serialize_rule(rule)
    if name is not None:
        rule.name = name.strip()
    if description is not None:
        rule.description = description.strip() or None
    if priority is not None:
        rule.priority = priority
    if enabled is not None:
        rule.enabled = enabled
    if conditions is not None:
        rule.conditions = conditions
    if actions is not None:
        rule.actions = actions
    rule.updated_at = datetime.now(timezone.utc)
    await session.flush()
    await write_audit(
        session,
        event_type=AuditEventType.mf_catalog_rule_updated,
        user_id=admin_user_id,
        metadata={"rule_id": rule.id, "before": before, "after": _serialize_rule(rule)},
    )
    return _serialize_rule(rule)


async def _load_fund_contexts(session: AsyncSession) -> list[dict[str, Any]]:
    rows = (
        await session.execute(
            select(Product, MutualFund, FundAmc, ProductCategory.category_id)
            .join(MutualFund, MutualFund.product_id == Product.id)
            .join(FundAmc, FundAmc.id == MutualFund.amc_id)
            .outerjoin(ProductCategory, ProductCategory.product_id == Product.id)
        )
    ).all()
    contexts: dict[int, dict[str, Any]] = {}
    for product, fund, amc, category_id in rows:
        entry = contexts.get(fund.id)
        if not entry:
            entry = {
                "product": product,
                "fund": fund,
                "amc": amc,
                "category_ids": set(),
            }
            contexts[fund.id] = entry
        if category_id is not None:
            entry["category_ids"].add(category_id)
    return list(contexts.values())


def _matches_conditions(ctx: dict[str, Any], conditions: dict) -> bool:
    product: Product = ctx["product"]
    fund: MutualFund = ctx["fund"]
    amc: FundAmc = ctx["amc"]

    for key, expected in conditions.items():
        if key == "amc_empanelled":
            if amc.is_active != expected:
                return False
        elif key == "fp_purchasable":
            if (fund.fp_oms_purchase_allowed is True) != expected:
                return False
        elif key == "fund_active":
            if fund.is_active != expected:
                return False
        elif key == "lifecycle_status":
            if product.lifecycle_status.value != expected:
                return False
        elif key == "admin_visibility":
            if product.admin_visibility.value != expected:
                return False
        elif key == "amc_id":
            if amc.id != expected:
                return False
        elif key == "category_id":
            if expected not in ctx["category_ids"]:
                return False
        else:
            return False
    return True


async def _apply_rule_actions(
    session: AsyncSession,
    ctx: dict[str, Any],
    actions: dict,
    *,
    admin_user_id: UUID,
    dry_run: bool,
) -> dict | None:
    product: Product = ctx["product"]
    fund: MutualFund = ctx["fund"]
    amc: FundAmc = ctx["amc"]
    changes: dict[str, Any] = {"fund_id": fund.id, "product_id": str(product.id)}

    if "set_lifecycle_status" in actions:
        target = ProductLifecycleStatus(actions["set_lifecycle_status"])
        if is_lifecycle_sync_blocked(product=product, amc=amc) and target == ProductLifecycleStatus.active:
            return None
        eligible = target == ProductLifecycleStatus.active
        next_status = resolve_lifecycle_status(product.lifecycle_status, eligible) if target == ProductLifecycleStatus.active else target
        if next_status != product.lifecycle_status:
            changes["lifecycle_status"] = {"from": product.lifecycle_status.value, "to": next_status.value}
            if not dry_run:
                product.lifecycle_status = next_status

    if "set_fund_active" in actions:
        target_active = bool(actions["set_fund_active"])
        if fund.is_active != target_active:
            changes["fund_active"] = {"from": fund.is_active, "to": target_active}
            if not dry_run:
                fund.is_active = target_active

    if "set_admin_visibility" in actions:
        target = AdminVisibility(actions["set_admin_visibility"])
        if product.admin_visibility != target:
            changes["admin_visibility"] = {
                "from": product.admin_visibility.value,
                "to": target.value,
            }
            if not dry_run:
                product.admin_visibility = target

    if "set_admin_investability" in actions:
        target = AdminInvestability(actions["set_admin_investability"])
        if product.admin_investability != target:
            changes["admin_investability"] = {
                "from": product.admin_investability.value,
                "to": target.value,
            }
            if not dry_run:
                product.admin_investability = target

    if "add_to_category" in actions:
        payload = actions["add_to_category"]
        if isinstance(payload, dict) and payload.get("slug"):
            changes["add_to_category"] = payload
            if not dry_run:
                await add_fund_to_category(
                    session,
                    payload["slug"],
                    admin_user_id=admin_user_id,
                    product_id=product.id,
                    display_order=payload.get("display_order"),
                    is_featured=bool(payload.get("is_featured", False)),
                    featured_rank=payload.get("featured_rank"),
                )

    if len(changes) <= 2:
        return None
    return changes


async def preview_catalog_rules(
    session: AsyncSession,
    *,
    rule_ids: list[int] | None = None,
) -> dict:
    settings = get_settings()
    if not settings.zynd_mf_rules_enabled:
        return {"affected_count": 0, "items": [], "rules": []}

    query = select(MfCatalogRule).where(MfCatalogRule.enabled.is_(True)).order_by(MfCatalogRule.priority)
    if rule_ids:
        query = query.where(MfCatalogRule.id.in_(rule_ids))
    rules = (await session.execute(query)).scalars().all()
    contexts = await _load_fund_contexts(session)

    items: list[dict] = []
    for rule in rules:
        for ctx in contexts:
            if _matches_conditions(ctx, rule.conditions):
                change = await _apply_rule_actions(
                    session,
                    ctx,
                    rule.actions,
                    admin_user_id=UUID(int=0),
                    dry_run=True,
                )
                if change:
                    items.append({"rule_id": rule.id, "rule_name": rule.name, **change})

    return {
        "affected_count": len(items),
        "items": items,
        "rules": [_serialize_rule(rule) for rule in rules],
    }


async def apply_catalog_rules(
    session: AsyncSession,
    *,
    admin_user_id: UUID,
    rule_ids: list[int] | None = None,
    dry_run: bool = False,
) -> dict:
    preview = await preview_catalog_rules(session, rule_ids=rule_ids)
    if dry_run:
        run = MfCatalogRuleRun(
            rule_id=rule_ids[0] if rule_ids and len(rule_ids) == 1 else None,
            dry_run=True,
            affected_count=preview["affected_count"],
            result={"items": preview["items"], "rule_ids": rule_ids},
            triggered_by=admin_user_id,
        )
        session.add(run)
        await session.flush()
        preview["run_id"] = run.id
        return preview

    applied: list[dict] = []
    settings = get_settings()
    if not settings.zynd_mf_rules_enabled:
        raise ValueError("Catalog rules are disabled")

    query = select(MfCatalogRule).where(MfCatalogRule.enabled.is_(True)).order_by(MfCatalogRule.priority)
    if rule_ids:
        query = query.where(MfCatalogRule.id.in_(rule_ids))
    rules = (await session.execute(query)).scalars().all()
    contexts = await _load_fund_contexts(session)

    for rule in rules:
        for ctx in contexts:
            if _matches_conditions(ctx, rule.conditions):
                change = await _apply_rule_actions(
                    session,
                    ctx,
                    rule.actions,
                    admin_user_id=admin_user_id,
                    dry_run=False,
                )
                if change:
                    applied.append({"rule_id": rule.id, "rule_name": rule.name, **change})

    run = MfCatalogRuleRun(
        rule_id=rule_ids[0] if rule_ids and len(rule_ids) == 1 else None,
        dry_run=False,
        affected_count=len(applied),
        result={"items": applied, "rule_ids": rule_ids},
        triggered_by=admin_user_id,
    )
    session.add(run)
    await session.flush()
    await write_audit(
        session,
        event_type=AuditEventType.mf_catalog_rules_applied,
        user_id=admin_user_id,
        metadata={"affected_count": len(applied), "run_id": run.id},
    )
    if applied:
        await notify_invest_catalog_changed(session)
    return {"affected_count": len(applied), "items": applied, "run_id": run.id}
