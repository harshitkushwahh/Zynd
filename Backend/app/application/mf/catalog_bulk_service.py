from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_audit
from app.application.mf.catalog_admin_write_service import update_fund_catalog_admin
from app.application.mf.category_curation_service import add_fund_to_category, _get_category_by_slug
from app.application.mf.invest_catalog_invalidation import notify_invest_catalog_changed
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import (
    AdminVisibility,
    MfBulkCatalogJob,
    MfBulkCatalogJobStatus,
    MutualFund,
    Product,
    ProductCategory,
)
from app.infrastructure.persistence.models import AuditEventType


BULK_ACTIONS = {
    "disable",
    "enable",
    "force_hide",
    "force_show",
    "auto_visibility",
    "add_category",
    "set_order",
}


def parse_bulk_csv(source: str) -> list[dict[str, str]]:
    reader = csv.DictReader(io.StringIO(source.strip()))
    if not reader.fieldnames:
        raise ValueError("CSV must include a header row")
    normalized_fields = {name.strip().lower(): name for name in reader.fieldnames if name}
    if "isin" not in normalized_fields or "action" not in normalized_fields:
        raise ValueError("CSV must include isin and action columns")

    rows: list[dict[str, str]] = []
    for index, raw in enumerate(reader, start=2):
        isin = (raw.get(normalized_fields["isin"]) or "").strip().upper()
        action = (raw.get(normalized_fields["action"]) or "").strip().lower()
        if not isin and not action:
            continue
        if not isin:
            raise ValueError(f"Row {index}: missing ISIN")
        if action not in BULK_ACTIONS:
            raise ValueError(f"Row {index}: unsupported action '{action}'")
        category_key = normalized_fields.get("category")
        position_key = normalized_fields.get("position")
        reason_key = normalized_fields.get("reason")
        category = (raw.get(category_key, "") if category_key else "").strip()
        position = (raw.get(position_key, "") if position_key else "").strip()
        reason = (raw.get(reason_key, "") if reason_key else "").strip()
        rows.append(
            {
                "isin": isin,
                "action": action,
                "category": category,
                "position": position,
                "reason": reason,
                "row_number": str(index),
            }
        )
    if not rows:
        raise ValueError("CSV contains no data rows")
    return rows


async def _resolve_fund_by_isin(session: AsyncSession, isin: str) -> tuple[MutualFund, Product] | None:
    row = (
        await session.execute(
            select(MutualFund, Product)
            .outerjoin(Product, Product.id == MutualFund.product_id)
            .where(MutualFund.isin_growth == isin)
        )
    ).first()
    if not row:
        return None
    fund, product = row
    if not product:
        return None
    return fund, product


def _row_requires_maker_checker(row: dict[str, str], fund: MutualFund) -> bool:
    action = row["action"]
    if action in {"disable", "force_hide"}:
        return True
    if action == "force_show" and fund.fp_oms_purchase_allowed is not True:
        return True
    return False


def bulk_needs_maker_checker(rows: list[dict[str, str]], fund_map: dict[str, MutualFund]) -> bool:
    settings = get_settings()
    if len(rows) > settings.zynd_mf_bulk_maker_checker_threshold:
        return True
    disable_count = sum(1 for row in rows if row["action"] in {"disable", "force_hide"})
    if disable_count > settings.zynd_mf_bulk_maker_checker_threshold:
        return True
    return any(_row_requires_maker_checker(row, fund_map[row["isin"]]) for row in rows if row["isin"] in fund_map)


async def preview_bulk_catalog(
    session: AsyncSession,
    *,
    source_csv: str,
) -> dict:
    rows = parse_bulk_csv(source_csv)
    items: list[dict] = []
    errors: list[dict] = []

    for row in rows:
        resolved = await _resolve_fund_by_isin(session, row["isin"])
        if not resolved:
            errors.append({"row": row, "error": "Fund not found for ISIN"})
            continue
        fund, product = resolved
        items.append(
            {
                "row": row,
                "fund_id": fund.id,
                "product_id": str(product.id),
                "scheme_name": fund.scheme_name,
                "requires_approval": _row_requires_maker_checker(row, fund),
            }
        )

    fund_map = {}
    for item in items:
        fund = await session.get(MutualFund, item["fund_id"])
        if fund:
            fund_map[item["row"]["isin"]] = fund

    return {
        "row_count": len(rows),
        "matched_count": len(items),
        "error_count": len(errors),
        "requires_maker_checker": bulk_needs_maker_checker(
            [item["row"] for item in items],
            fund_map,
        ),
        "items": items,
        "errors": errors,
    }


async def _apply_bulk_row(
    session: AsyncSession,
    *,
    row: dict[str, str],
    admin_user_id: UUID,
) -> dict:
    resolved = await _resolve_fund_by_isin(session, row["isin"])
    if not resolved:
        raise ValueError(f"Fund not found for ISIN {row['isin']}")
    fund, product = resolved
    action = row["action"]
    reason = row.get("reason") or f"Bulk catalog action: {action}"

    if action == "disable":
        await update_fund_catalog_admin(
            session,
            fund.id,
            admin_user_id=admin_user_id,
            is_active=False,
            reason=reason,
        )
    elif action == "enable":
        await update_fund_catalog_admin(
            session,
            fund.id,
            admin_user_id=admin_user_id,
            is_active=True,
        )
    elif action == "force_hide":
        await update_fund_catalog_admin(
            session,
            fund.id,
            admin_user_id=admin_user_id,
            admin_visibility=AdminVisibility.force_hide,
            reason=reason,
        )
    elif action == "force_show":
        await update_fund_catalog_admin(
            session,
            fund.id,
            admin_user_id=admin_user_id,
            admin_visibility=AdminVisibility.force_show,
            reason=reason,
        )
    elif action == "auto_visibility":
        await update_fund_catalog_admin(
            session,
            fund.id,
            admin_user_id=admin_user_id,
            admin_visibility=AdminVisibility.auto,
        )
    elif action in {"add_category", "set_order"}:
        if not row.get("category"):
            raise ValueError("category column required for category actions")
        display_order = int(row["position"]) if row.get("position") else None
        if action == "add_category":
            await add_fund_to_category(
                session,
                row["category"],
                admin_user_id=admin_user_id,
                product_id=product.id,
                display_order=display_order,
            )
        else:
            category = await _get_category_by_slug(session, row["category"])
            if not category:
                raise ValueError(f"Unknown category slug: {row['category']}")
            link = await session.scalar(
                select(ProductCategory).where(
                    ProductCategory.product_id == product.id,
                    ProductCategory.category_id == category.id,
                )
            )
            if not link:
                raise ValueError("Fund is not in the specified category")
            if display_order is not None:
                link.display_order = display_order
    else:
        raise ValueError(f"Unsupported action: {action}")

    return {
        "isin": row["isin"],
        "fund_id": fund.id,
        "action": action,
        "status": "applied",
    }


async def execute_bulk_catalog_job(
    session: AsyncSession,
    job_id: uuid.UUID,
    *,
    admin_user_id: UUID,
) -> dict:
    job = await session.get(MfBulkCatalogJob, job_id)
    if not job:
        raise ValueError("Bulk job not found")
    if job.status not in {
        MfBulkCatalogJobStatus.pending,
        MfBulkCatalogJobStatus.pending_approval,
    }:
        raise ValueError(f"Bulk job is not executable (status={job.status.value})")

    job.status = MfBulkCatalogJobStatus.running
    await session.flush()

    applied: list[dict] = []
    errors: list[dict] = []
    try:
        rows = parse_bulk_csv(job.source_csv)
        for row in rows:
            try:
                if job.dry_run:
                    resolved = await _resolve_fund_by_isin(session, row["isin"])
                    if not resolved:
                        raise ValueError("Fund not found for ISIN")
                    fund, _ = resolved
                    applied.append(
                        {
                            "isin": row["isin"],
                            "fund_id": fund.id,
                            "action": row["action"],
                            "status": "would_apply",
                        }
                    )
                else:
                    applied.append(
                        await _apply_bulk_row(session, row=row, admin_user_id=admin_user_id)
                    )
            except Exception as exc:  # noqa: BLE001 — collect per-row bulk errors
                errors.append({"row": row, "error": str(exc)})

        job.affected_count = len(applied)
        job.result = {"applied": applied, "errors": errors}
        job.status = MfBulkCatalogJobStatus.succeeded if not errors else MfBulkCatalogJobStatus.failed
        if errors and not applied:
            job.failure_reason = errors[0]["error"]
        job.completed_at = datetime.now(timezone.utc)
        await write_audit(
            session,
            event_type=AuditEventType.mf_catalog_bulk_executed,
            user_id=admin_user_id,
            metadata={"job_id": str(job.id), "affected_count": len(applied), "errors": len(errors)},
        )
        if applied and not job.dry_run:
            await notify_invest_catalog_changed(session)
    except Exception as exc:  # noqa: BLE001 — mark bulk job failed
        job.status = MfBulkCatalogJobStatus.failed
        job.failure_reason = str(exc)
        job.completed_at = datetime.now(timezone.utc)
        raise

    return {
        "job_id": str(job.id),
        "status": job.status.value,
        "affected_count": job.affected_count,
        "result": job.result,
    }


async def create_bulk_catalog_job(
    session: AsyncSession,
    *,
    admin_user_id: UUID,
    source_csv: str,
    dry_run: bool = True,
) -> dict:
    rows = parse_bulk_csv(source_csv)
    preview = await preview_bulk_catalog(session, source_csv=source_csv)

    job = MfBulkCatalogJob(
        source_csv=source_csv,
        dry_run=dry_run,
        row_count=len(rows),
        created_by=admin_user_id,
        status=MfBulkCatalogJobStatus.pending,
    )
    session.add(job)
    await session.flush()

    await write_audit(
        session,
        event_type=AuditEventType.mf_catalog_bulk_submitted,
        user_id=admin_user_id,
        metadata={"job_id": str(job.id), "row_count": len(rows), "dry_run": dry_run},
    )

    needs_approval = preview["requires_maker_checker"] and not dry_run
    if needs_approval:
        job.status = MfBulkCatalogJobStatus.pending_approval
        await session.flush()
        return {
            "job_id": str(job.id),
            "status": job.status.value,
            "requires_maker_checker": True,
            "preview": preview,
        }

    result = await execute_bulk_catalog_job(session, job.id, admin_user_id=admin_user_id)
    return {
        **result,
        "requires_maker_checker": False,
        "preview": preview,
    }


async def get_bulk_catalog_job(session: AsyncSession, job_id: uuid.UUID) -> dict | None:
    job = await session.get(MfBulkCatalogJob, job_id)
    if not job:
        return None
    return {
        "job_id": str(job.id),
        "status": job.status.value,
        "dry_run": job.dry_run,
        "row_count": job.row_count,
        "affected_count": job.affected_count,
        "result": job.result,
        "failure_reason": job.failure_reason,
        "admin_action_id": str(job.admin_action_id) if job.admin_action_id else None,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
    }


async def list_bulk_catalog_jobs(session: AsyncSession, *, limit: int = 20) -> list[dict]:
    rows = (
        await session.execute(
            select(MfBulkCatalogJob).order_by(MfBulkCatalogJob.created_at.desc()).limit(limit)
        )
    ).scalars()
    results = []
    for job in rows:
        payload = await get_bulk_catalog_job(session, job.id)
        if payload:
            results.append(payload)
    return results
