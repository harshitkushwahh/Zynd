from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Awaitable, Callable

from croniter import croniter
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.amfi_aaum_ingestion_service import run_amfi_aaum_ingestion
from app.application.mf.amfi_fund_bridge_service import run_amfi_fund_bridge
from app.application.mf.amfi_scheme_master_service import run_amfi_scheme_master_sync
from app.application.mf.amc_aum_rank_service import run_amc_aum_rank_compute
from app.application.mf.amc_logo_ingestion_service import run_amc_logo_ingestion
from app.application.mf.catalog_lifecycle_sync_service import run_catalog_lifecycle_sync
from app.application.mf.amfi_aum_ingestion_service import run_amfi_aum_ingestion
from app.application.mf.amfi_ter_ingestion_service import run_amfi_ter_ingestion
from app.application.mf.amfi_nav_ingestion_service import run_amfi_nav_ingestion
from app.application.mf.composite_rank_service import run_composite_rank_compute
from app.application.mf.cybrilla_scheme_sync_service import run_cybrilla_scheme_sync
from app.application.mf.scheme_staging_ingest_service import run_cybrilla_scheme_ingest
from app.application.mf.scheme_staging_promote_service import run_cybrilla_scheme_promote
from app.application.mf.scheme_staging_validate_service import run_cybrilla_scheme_validate
from app.application.mf.ingestion_run_service import cleanup_stale_runs
from app.application.mf.nav_cold_start_backfill_service import run_nav_cold_start_backfill
from app.application.mf.nav_metrics_service import run_nav_metrics_compute
from app.application.mf.return_calculator_snapshot_service import run_return_calculator_snapshot
from app.application.mf.scheme_compliance_service import run_scheme_compliance_sync
from app.application.mf.scheme_min_amount_backfill_service import run_scheme_min_amounts_backfill
from app.core.config import get_settings

logger = logging.getLogger(__name__)

JobRunner = Callable[[AsyncSession], Awaitable[dict]]


@dataclass(frozen=True)
class ScheduledMfJob:
    name: str
    cron: str
    enabled: bool
    runner: JobRunner
    phase: int
    description: str
    depends_on: tuple[str, ...] = ()


async def _run_stale_cleanup(session: AsyncSession) -> dict:
    settings = get_settings()
    count = await cleanup_stale_runs(session, threshold_hours=settings.zynd_mf_stale_run_cleanup_threshold_hours)
    return {"cleaned": count}


def _scheme_master_dependency(settings) -> str:
    return "cybrilla-scheme-promote" if settings.zynd_mf_scheme_staging_enabled else "cybrilla-scheme-sync"


def build_scheduled_jobs() -> list[ScheduledMfJob]:
    settings = get_settings()
    master = settings.zynd_mf_ingestion_enabled
    scheme_dep = _scheme_master_dependency(settings)

    jobs: list[ScheduledMfJob] = []

    if settings.zynd_mf_scheme_staging_enabled:
        jobs.extend(
            [
                ScheduledMfJob(
                    name="cybrilla-scheme-ingest",
                    cron=settings.zynd_mf_scheme_staging_ingest_cron,
                    enabled=master and settings.zynd_mf_scheme_sync_enabled,
                    runner=run_cybrilla_scheme_ingest,
                    phase=15,
                    description="FinPrim fund_schemes → Mongo staging (no SQL writes)",
                ),
                ScheduledMfJob(
                    name="cybrilla-scheme-validate",
                    cron=settings.zynd_mf_scheme_staging_validate_cron,
                    enabled=master and settings.zynd_mf_scheme_sync_enabled,
                    runner=run_cybrilla_scheme_validate,
                    phase=15,
                    description="Validate staged Cybrilla schemes in Mongo",
                    depends_on=("cybrilla-scheme-ingest",),
                ),
                ScheduledMfJob(
                    name="cybrilla-scheme-promote",
                    cron=settings.zynd_mf_scheme_staging_promote_cron,
                    enabled=master and settings.zynd_mf_scheme_sync_enabled,
                    runner=run_cybrilla_scheme_promote,
                    phase=15,
                    description="Promote validated schemes from Mongo → SQL products (draft)",
                    depends_on=("cybrilla-scheme-validate",),
                ),
            ]
        )
    else:
        jobs.append(
            ScheduledMfJob(
                name="cybrilla-scheme-sync",
                cron=settings.zynd_mf_scheme_sync_cron,
                enabled=master and settings.zynd_mf_scheme_sync_enabled,
                runner=run_cybrilla_scheme_sync,
                phase=1,
                description="FinPrim fund_schemes → mutual_funds + products (ARN-scoped)",
            )
        )

    jobs.extend(
        [
        ScheduledMfJob(
            name="amfi-nav-daily",
            cron=settings.zynd_mf_nav_cron,
            enabled=master and settings.zynd_mf_nav_ingestion_enabled,
            runner=run_amfi_nav_ingestion,
            phase=1,
            description="AMFI NAVAll.txt → scheme_navs (ISIN match only)",
            depends_on=(scheme_dep,),
        ),
        ScheduledMfJob(
            name="amfi-scheme-master-sync",
            cron=settings.zynd_mf_amfi_scheme_master_cron,
            enabled=master and settings.zynd_mf_amfi_scheme_master_enabled,
            runner=run_amfi_scheme_master_sync,
            phase=16,
            description="AMFI NAVAll.txt → amfi_scheme_master reference table",
            depends_on=("amfi-nav-daily",),
        ),
        ScheduledMfJob(
            name="amfi-fund-bridge",
            cron="10 21 * * *",
            enabled=master and settings.zynd_mf_amfi_scheme_master_enabled,
            runner=run_amfi_fund_bridge,
            phase=16,
            description="Bridge mutual_funds to AMFI scheme_code + fix AMC names",
            depends_on=("amfi-scheme-master-sync",),
        ),
        ScheduledMfJob(
            name="nav-metrics-compute",
            cron=settings.zynd_mf_metrics_cron,
            enabled=master and settings.zynd_mf_metrics_enabled,
            runner=run_nav_metrics_compute,
            phase=2,
            description="Compute 1D–5Y returns from NAV history",
            depends_on=("amfi-nav-daily",),
        ),
        ScheduledMfJob(
            name="composite-rank-compute",
            cron=settings.zynd_mf_rank_cron,
            enabled=master and settings.zynd_mf_metrics_enabled,
            runner=run_composite_rank_compute,
            phase=2,
            description="Rank funds by 3Y return within PM categories",
            depends_on=("nav-metrics-compute",),
        ),
        ScheduledMfJob(
            name="return-calculator-snapshot",
            cron=settings.zynd_mf_return_calculator_cron,
            enabled=master and settings.zynd_mf_return_calculator_enabled,
            runner=run_return_calculator_snapshot,
            phase=16,
            description="Precompute return calculator multipliers per fund",
            depends_on=("nav-metrics-compute",),
        ),
        ScheduledMfJob(
            name="amfi-aum-monthly",
            cron=settings.zynd_mf_aum_cron,
            enabled=master and settings.zynd_mf_aum_ingestion_enabled,
            runner=run_amfi_aum_ingestion,
            phase=3,
            description="AMFI monthly AUM → scheme_aums",
            depends_on=(scheme_dep,),
        ),
        ScheduledMfJob(
            name="amc-aum-rank-compute",
            cron=settings.zynd_mf_amc_aum_rank_cron,
            enabled=master and settings.zynd_mf_amc_aum_rank_enabled,
            runner=run_amc_aum_rank_compute,
            phase=16,
            description="Rank AMCs by aggregated scheme AUM",
            depends_on=("amfi-aum-monthly",),
        ),
        ScheduledMfJob(
            name="scheme-compliance-sync",
            cron=settings.zynd_mf_compliance_sync_cron,
            enabled=master and settings.zynd_mf_compliance_sync_enabled,
            runner=run_scheme_compliance_sync,
            phase=16,
            description="Sync exit load (Cybrilla) + tax/stamp duty templates",
            depends_on=(scheme_dep,),
        ),
        ScheduledMfJob(
            name="scheme-min-amounts-backfill",
            cron=settings.zynd_mf_scheme_min_amounts_backfill_cron,
            enabled=master and settings.zynd_mf_scheme_min_amounts_backfill_enabled,
            runner=run_scheme_min_amounts_backfill,
            phase=16,
            description="Cybrilla per-ISIN detail → min SIP/lumpsum on mutual_funds",
            depends_on=(scheme_dep,),
        ),
        ScheduledMfJob(
            name="amfi-ter-monthly",
            cron=settings.zynd_mf_ter_cron,
            enabled=master and settings.zynd_mf_ter_ingestion_enabled,
            runner=run_amfi_ter_ingestion,
            phase=3,
            description="AMFI monthly TER → scheme_ter",
            depends_on=(scheme_dep,),
        ),
        ScheduledMfJob(
            name="amfi-aaum-quarterly",
            cron=settings.zynd_mf_aaum_cron,
            enabled=master and settings.zynd_mf_aaum_enabled,
            runner=run_amfi_aaum_ingestion,
            phase=3,
            description="AMFI quarterly average AUM",
            depends_on=(scheme_dep,),
        ),
        ScheduledMfJob(
            name="catalog-lifecycle-sync",
            cron=settings.zynd_mf_catalog_lifecycle_cron,
            enabled=master and settings.zynd_mf_catalog_lifecycle_enabled,
            runner=run_catalog_lifecycle_sync,
            phase=5,
            description="Promote products DRAFT→ACTIVE when AMC empanelled + purchase allowed",
            depends_on=(scheme_dep,),
        ),
        ScheduledMfJob(
            name="amc-logo-ingest",
            cron=settings.zynd_mf_amc_logo_ingest_cron,
            enabled=master and settings.zynd_mf_amc_logo_ingest_enabled,
            runner=run_amc_logo_ingestion,
            phase=5,
            description="Fetch AMC logos into public assets bucket",
        ),
        ScheduledMfJob(
            name="nav-cold-start-backfill",
            cron=settings.zynd_mf_cold_start_backfill_cron,
            enabled=master and settings.zynd_mf_cold_start_backfill_enabled,
            runner=run_nav_cold_start_backfill,
            phase=4,
            description="Historical AMFI NAV backfill when scheme_navs is below threshold",
            depends_on=(scheme_dep,),
        ),
        ScheduledMfJob(
            name="stale-run-cleanup",
            cron=settings.zynd_mf_stale_run_cleanup_cron,
            enabled=master and settings.zynd_mf_stale_run_cleanup_enabled,
            runner=_run_stale_cleanup,
            phase=1,
            description="Mark stuck ingestion runs as failed",
        ),
    ]
    )
    return jobs


def job_due(cron_expr: str, *, now: datetime | None = None) -> bool:
    current = now or datetime.now(timezone.utc)
    itr = croniter(cron_expr, current)
    prev_run = itr.get_prev(datetime)
    delta = (current - prev_run).total_seconds()
    return delta < 60


def list_jobs_for_cli() -> list[dict]:
    return [
        {
            "name": job.name,
            "phase": job.phase,
            "cron": job.cron,
            "enabled": job.enabled,
            "description": job.description,
            "depends_on": list(job.depends_on),
        }
        for job in build_scheduled_jobs()
    ]


async def run_job_once(
    session: AsyncSession,
    job_name: str,
    *,
    triggered_by: str = "CLI",
    skip_dependency_check: bool = False,
    job_kwargs: dict[str, Any] | None = None,
) -> dict:
    from app.application.mf.mf_job_runner_service import execute_mf_job

    return await execute_mf_job(
        session,
        job_name,
        triggered_by=triggered_by,
        skip_dependency_check=skip_dependency_check,
        job_kwargs=job_kwargs,
    )
