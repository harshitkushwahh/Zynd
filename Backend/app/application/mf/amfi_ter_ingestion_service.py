from __future__ import annotations

import logging
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.amfi_parsers import normalize_scheme_name, parse_ter_rows, parse_ter_tracker_csv
from app.application.mf.amfi_scheme_master_service import build_isin_to_fund_id_map
from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.core.config import get_settings
from app.infrastructure.mf.amfi_client import amfi_get_bytes, fetch_all_ter_rows, fetch_latest_ter_month
from app.infrastructure.mf.mongo_raw_store import store_raw_ingestion
from app.infrastructure.mf.pipeline_progress import emit_pipeline_progress
from app.infrastructure.persistence.mf_models import AmfiSchemeMaster, IngestionRunStatus, MutualFund, SchemeTer

logger = logging.getLogger(__name__)

TER_TRACKER_FALLBACK = "https://raw.githubusercontent.com/captn3m0/india-mutual-fund-ter-tracker/main/data.csv"
TER_WRITE_BATCH = 1000


def ter_ingestion_refreshes_existing(triggered_by: str) -> bool:
    """Full bootstrap / admin / CLI rewrite existing TER. Monthly cron only backfills."""
    return not triggered_by.startswith("SCHEDULER")


def _normalize_plan(plan_type: str | None) -> str:
    plan = (plan_type or "REGULAR").upper()
    return "DIRECT" if plan == "DIRECT" else "REGULAR"


async def build_ter_match_indexes(session: AsyncSession) -> dict[str, Any]:
    by_isin = await build_isin_to_fund_id_map(session)
    by_code: dict[str, int] = {}
    by_name_plan: dict[tuple[str, str], int] = {}
    fund_plan: dict[int, str] = {}
    rows = await session.execute(
        select(MutualFund.id, MutualFund.scheme_code, MutualFund.scheme_name, MutualFund.plan_type)
    )
    for fund_id, scheme_code, scheme_name, plan_type in rows.all():
        plan = _normalize_plan(plan_type)
        fund_plan[int(fund_id)] = plan
        if scheme_code:
            by_code[str(scheme_code).strip()] = int(fund_id)
        if scheme_name:
            by_name_plan[(normalize_scheme_name(scheme_name), plan)] = int(fund_id)

    master_name_isins: dict[str, list[str]] = {}
    masters = await session.execute(
        select(AmfiSchemeMaster.scheme_name, AmfiSchemeMaster.isin_growth, AmfiSchemeMaster.isin_div_reinvestment)
    )
    for scheme_name, isin_growth, isin_div in masters.all():
        key = normalize_scheme_name(scheme_name)
        bucket = master_name_isins.setdefault(key, [])
        for isin in (isin_growth, isin_div):
            if isin:
                value = str(isin).strip().upper()
                if value not in bucket:
                    bucket.append(value)

    return {
        "by_isin": by_isin,
        "by_code": by_code,
        "by_name_plan": by_name_plan,
        "master_name_isins": master_name_isins,
        "fund_plan": fund_plan,
    }


def resolve_ter_fund_id(
    indexes: dict[str, Any],
    *,
    plan_type: str,
    isin: str | None = None,
    scheme_code: str | None = None,
    scheme_name: str | None = None,
) -> int | None:
    plan = _normalize_plan(plan_type)
    by_isin: dict[str, int] = indexes["by_isin"]
    fund_plan: dict[int, str] = indexes["fund_plan"]

    if isin:
        fund_id = by_isin.get(str(isin).strip().upper())
        if fund_id:
            return fund_id

    if scheme_code:
        fund_id = indexes["by_code"].get(str(scheme_code).strip())
        if fund_id and fund_plan.get(fund_id) == plan:
            return fund_id

    if scheme_name:
        name_key = normalize_scheme_name(scheme_name)
        fund_id = indexes["by_name_plan"].get((name_key, plan))
        if fund_id:
            return fund_id
        for master_isin in indexes["master_name_isins"].get(name_key, []):
            fund_id = by_isin.get(master_isin)
            if fund_id and fund_plan.get(fund_id) == plan:
                return fund_id
    return None


def filter_new_ter_rows(
    candidates: list[dict[str, Any]],
    existing: set[tuple[int, date]],
) -> tuple[list[dict[str, Any]], int]:
    fresh: list[dict[str, Any]] = []
    already = 0
    for row in candidates:
        key = (int(row["fund_id"]), row["as_of_date"])
        if key in existing:
            already += 1
            continue
        existing.add(key)
        fresh.append(row)
    return fresh, already


async def run_amfi_ter_ingestion(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
) -> dict[str, int | str]:
    settings = get_settings()
    if not settings.zynd_mf_ter_ingestion_enabled:
        return {"skipped": 1, "reason": "ter_ingestion_disabled", "phase": 3}

    if await has_running_job(session, "amfi-ter-monthly"):
        return {"skipped": 1, "reason": "already_running"}

    run = await begin_ingestion_run(session, job_name="amfi-ter-monthly", triggered_by=triggered_by)
    processed = upserted = skipped = already_present = 0
    refresh_existing = ter_ingestion_refreshes_existing(triggered_by)

    try:
        parsed: list[dict] = []
        source = "AMFI_API"
        month = settings.zynd_mf_ter_month or await fetch_latest_ter_month(
            financial_year=settings.zynd_mf_ter_financial_year
        )

        try:
            rows = await fetch_all_ter_rows(
                month=month,
                page_size=settings.zynd_mf_ter_page_size,
                max_pages=settings.zynd_mf_ter_max_pages or None,
            )
            parsed = parse_ter_rows(rows)
            await store_raw_ingestion(
                job_name="amfi-ter-monthly",
                run_uuid=str(run.run_uuid),
                payload=str({"month": month, "rows": len(rows)})[:500_000],
                content_type="application/json",
            )
        except Exception as exc:
            logger.warning("AMFI TER API failed, trying tracker CSV fallback: %s", exc)
            tracker_url = settings.zynd_mf_ter_tracker_url.strip() or TER_TRACKER_FALLBACK
            body = await amfi_get_bytes(tracker_url)
            parsed = parse_ter_tracker_csv(body)
            source = "GITHUB_TRACKER"
            await store_raw_ingestion(
                job_name="amfi-ter-monthly",
                run_uuid=str(run.run_uuid),
                payload=body[:500_000],
                content_type="text/csv",
            )

        if not parsed:
            raise ValueError("No TER rows parsed from AMFI API or tracker fallback")

        mode = "full-refresh" if refresh_existing else "backfill-missing"
        await emit_pipeline_progress(f"AMFI TER match: {len(parsed)} rows to process ({mode})")
        indexes = await build_ter_match_indexes(session)
        candidates: list[dict[str, Any]] = []
        for row in parsed:
            processed += 1
            fund_id = resolve_ter_fund_id(
                indexes,
                plan_type=str(row.get("plan_type") or "REGULAR"),
                isin=row.get("isin"),
                scheme_code=row.get("scheme_code"),
                scheme_name=row.get("scheme_name"),
            )
            if not fund_id or row.get("as_of_date") is None:
                skipped += 1
                continue
            candidates.append(
                {
                    "fund_id": fund_id,
                    "as_of_date": row["as_of_date"],
                    "ter_percent": row["ter_percent"],
                    "source": source,
                }
            )

        if not refresh_existing:
            dates = {item["as_of_date"] for item in candidates}
            existing: set[tuple[int, date]] = set()
            if dates:
                present = await session.execute(
                    select(SchemeTer.fund_id, SchemeTer.as_of_date).where(SchemeTer.as_of_date.in_(dates))
                )
                existing = {(int(fund_id), as_of) for fund_id, as_of in present.all()}
            candidates, already_present = filter_new_ter_rows(candidates, existing)
            skipped += already_present
            await emit_pipeline_progress(
                f"AMFI TER backfill: already_present={already_present} new={len(candidates)}",
            )

        for start in range(0, len(candidates), TER_WRITE_BATCH):
            batch = candidates[start : start + TER_WRITE_BATCH]
            stmt = insert(SchemeTer).values(batch)
            if refresh_existing:
                stmt = stmt.on_conflict_do_update(
                    index_elements=["fund_id", "as_of_date"],
                    set_={"ter_percent": stmt.excluded.ter_percent, "source": stmt.excluded.source},
                )
            else:
                stmt = stmt.on_conflict_do_nothing(index_elements=["fund_id", "as_of_date"])
            await session.execute(stmt)
            upserted += len(batch)
            if start and start % 5000 == 0:
                await emit_pipeline_progress(
                    f"AMFI TER write: processed={processed} written={upserted} skipped={skipped}",
                )

        status = IngestionRunStatus.succeeded if upserted or already_present else IngestionRunStatus.partial
        if upserted == 0 and already_present == 0 and processed:
            status = IngestionRunStatus.partial
        await finish_ingestion_run(
            session,
            run,
            status=status,
            records_processed=processed,
            records_inserted=upserted if refresh_existing else upserted,
            records_skipped=skipped,
            metadata={
                "source": source,
                "month": month,
                "mode": mode,
                "already_present": already_present,
            },
        )
        return {
            "processed": processed,
            "upserted": upserted,
            "skipped": skipped,
            "already_present": already_present,
            "mode": mode,
            "source": source,
            "run_uuid": str(run.run_uuid),
        }
    except Exception as exc:
        logger.exception("AMFI TER ingestion failed")
        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.failed,
            records_processed=processed,
            records_inserted=upserted,
            records_skipped=skipped,
            error_message=str(exc),
        )
        raise
