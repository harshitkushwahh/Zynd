from __future__ import annotations

import logging
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.application.mf.mf_tax_templates import STAMP_DUTY_PCT, tax_notes_for_fund
from app.core.config import get_settings
from app.infrastructure.mf.fp_oms_client import get_fund_scheme_by_isin
from app.infrastructure.persistence.mf_models import IngestionRunStatus, MutualFund, SchemeComplianceFacts

logger = logging.getLogger(__name__)


def _extract_exit_load(raw: dict) -> tuple[str | None, list | None]:
    for key in ("exit_load", "exit_load_comment", "exit_load_remarks", "load_remarks"):
        value = raw.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip(), None
    load = raw.get("load") or raw.get("exit_load_structure")
    if isinstance(load, list) and load:
        return str(load), load
    if isinstance(load, dict) and load:
        return str(load), [load]
    return None, None


async def upsert_compliance_for_fund(
    session: AsyncSession,
    fund: MutualFund,
    *,
    cybrilla_raw: dict | None = None,
) -> None:
    existing = await session.scalar(
        select(SchemeComplianceFacts).where(SchemeComplianceFacts.fund_id == fund.id)
    )
    exit_load_text = existing.exit_load_text if existing else None
    exit_load_slabs = existing.exit_load_slabs if existing else None
    lock_in_days = existing.lock_in_days if existing else None
    source = existing.source if existing else "RULES"

    if cybrilla_raw:
        parsed_text, parsed_slabs = _extract_exit_load(cybrilla_raw)
        if parsed_text:
            exit_load_text = parsed_text
            exit_load_slabs = parsed_slabs
            source = "CYBRILLA"
        lock_in = cybrilla_raw.get("lock_in_period") or cybrilla_raw.get("lock_in_days")
        if lock_in is not None:
            try:
                lock_in_days = int(lock_in)
            except (TypeError, ValueError):
                pass

    tax_notes = tax_notes_for_fund(sebi_category=fund.sebi_category, option_type=fund.option_type)
    stmt = (
        insert(SchemeComplianceFacts)
        .values(
            fund_id=fund.id,
            exit_load_text=exit_load_text,
            exit_load_slabs=exit_load_slabs,
            stamp_duty_pct=Decimal(str(STAMP_DUTY_PCT)),
            tax_notes=tax_notes,
            lock_in_days=lock_in_days,
            source=source,
        )
        .on_conflict_do_update(
            index_elements=["fund_id"],
            set_={
                "exit_load_text": exit_load_text,
                "exit_load_slabs": exit_load_slabs,
                "stamp_duty_pct": Decimal(str(STAMP_DUTY_PCT)),
                "tax_notes": tax_notes,
                "lock_in_days": lock_in_days,
                "source": source,
            },
        )
    )
    await session.execute(stmt)


async def seed_all_tax_compliance(session: AsyncSession) -> int:
    """Apply tax/stamp-duty templates to every fund (no Cybrilla calls)."""
    funds = (await session.scalars(select(MutualFund))).all()
    count = 0
    for fund in funds:
        await upsert_compliance_for_fund(session, fund, cybrilla_raw=None)
        count += 1
    return count


async def run_scheme_compliance_sync(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
    limit: int | None = None,
) -> dict[str, int | str]:
    settings = get_settings()
    if not settings.zynd_mf_compliance_sync_enabled:
        return {"skipped": 1, "reason": "compliance_sync_disabled"}

    if await has_running_job(session, "scheme-compliance-sync"):
        return {"skipped": 1, "reason": "already_running"}

    batch_size = limit or settings.zynd_mf_compliance_sync_batch_size

    run = await begin_ingestion_run(session, job_name="scheme-compliance-sync", triggered_by=triggered_by)
    processed = upserted = skipped = 0

    try:
        funds = (
            await session.scalars(select(MutualFund).where(MutualFund.is_active.is_(True)).limit(batch_size))
        ).all()

        for fund in funds:
            processed += 1
            cybrilla_raw = None
            if settings.resolved_fp_enabled:
                try:
                    cybrilla_raw = await get_fund_scheme_by_isin(fund.isin_growth)
                except Exception as exc:
                    logger.debug("Cybrilla detail fetch failed isin=%s: %s", fund.isin_growth, exc)
            await upsert_compliance_for_fund(session, fund, cybrilla_raw=cybrilla_raw)
            upserted += 1

        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.succeeded,
            records_processed=processed,
            records_inserted=upserted,
            records_skipped=skipped,
        )
        return {"processed": processed, "upserted": upserted, "skipped": skipped, "run_uuid": str(run.run_uuid)}
    except Exception as exc:
        logger.exception("Scheme compliance sync failed")
        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.failed,
            records_processed=processed,
            error_message=str(exc),
        )
        raise


async def get_compliance_payload(session: AsyncSession, fund_id: int) -> dict | None:
    row = await session.scalar(select(SchemeComplianceFacts).where(SchemeComplianceFacts.fund_id == fund_id))
    if not row:
        return None
    return {
        "exit_load": {
            "text": row.exit_load_text,
            "slabs": row.exit_load_slabs or [],
        },
        "stamp_duty_pct": float(row.stamp_duty_pct),
        "tax_implication": row.tax_notes or {},
        "lock_in_days": row.lock_in_days,
        "source": row.source,
    }


async def get_amc_registry_payload(session: AsyncSession, amc_id: int) -> dict | None:
    from app.infrastructure.persistence.mf_models import AmcRegistry, FundAmc

    amc = await session.get(FundAmc, amc_id)
    registry = await session.scalar(select(AmcRegistry).where(AmcRegistry.amc_id == amc_id))
    if not amc and not registry:
        return None
    return {
        "name": (registry.legal_name if registry and registry.legal_name else amc.name if amc else None),
        "phone": registry.phone if registry else None,
        "email": registry.email if registry else None,
        "website": registry.website_url if registry else None,
        "address": registry.registered_address if registry else None,
        "custodian": registry.custodian if registry else None,
        "rta": {
            "name": registry.rta_name if registry else None,
            "email": registry.rta_email if registry else None,
            "website": registry.rta_website if registry else None,
            "address": registry.rta_address if registry else None,
        },
        "incorporation_date": registry.incorporation_date.isoformat()
        if registry and registry.incorporation_date
        else None,
    }
