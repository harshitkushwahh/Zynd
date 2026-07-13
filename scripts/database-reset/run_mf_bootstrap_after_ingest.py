#!/usr/bin/env python3
"""Run MF bootstrap after cybrilla-scheme-ingest (validate → promote → all scheduler jobs)."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import text

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
BACKEND_ROOT = REPO_ROOT / "Backend"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

load_dotenv(BACKEND_ROOT / ".env")

from app.application.mf.ingestion_run_service import cleanup_stale_runs  # noqa: E402
from app.application.mf.mf_scheduler_jobs import run_job_once  # noqa: E402
from app.application.mf.scheme_compliance_service import seed_all_tax_compliance  # noqa: E402
from app.application.mf.scheme_staging_promote_service import run_cybrilla_scheme_promote  # noqa: E402
from app.application.mf.scheme_staging_validate_service import run_cybrilla_scheme_validate  # noqa: E402
from app.core.database import AsyncSessionLocal  # noqa: E402

SEQUENTIAL_JOBS = (
    "catalog-lifecycle-sync",
    "amfi-scheme-master-sync",
    "amfi-fund-bridge",
    "amfi-nav-daily",
    "nav-cold-start-backfill",
    "nav-metrics-compute",
    "return-calculator-snapshot",
    "amfi-aaum-quarterly",
    "amfi-ter-monthly",
    "amc-aum-rank-compute",
)

MAX_MIN_AMOUNTS_BATCHES = 25


async def _run_job(session, name: str) -> dict:
    print(f"\n=== {name} ===", flush=True)
    if name == "nav-cold-start-backfill":
        print("NAV cold-start downloads ~83 historical AMFI windows; expect 30-90+ minutes.", flush=True)
    result = await run_job_once(session, name, triggered_by="BOOTSTRAP", skip_dependency_check=True)
    print(json.dumps(result, default=str, indent=2), flush=True)
    return result


async def _run_min_amounts_backfill_loop() -> int:
    total_updated = 0
    for batch_num in range(1, MAX_MIN_AMOUNTS_BATCHES + 1):
        async with AsyncSessionLocal() as session:
            result = await _run_job(session, "scheme-min-amounts-backfill")
            await session.commit()
        updated = int(result.get("updated", 0))
        total_updated += updated
        if updated == 0:
            print(f"\nscheme-min-amounts-backfill finished after {batch_num} batch(es).", flush=True)
            break
    else:
        print(
            f"\nscheme-min-amounts-backfill stopped after {MAX_MIN_AMOUNTS_BATCHES} batches; "
            "re-run if more funds need investment details.",
            flush=True,
        )
    return total_updated


async def _print_counts(session) -> None:
    rows = await session.execute(
        text(
            """
            SELECT
              (SELECT count(*) FROM products) AS products,
              (SELECT count(*) FROM mutual_funds) AS funds,
              (SELECT count(*) FROM products WHERE lifecycle_status='ACTIVE') AS active,
              (SELECT count(*) FROM fund_amcs WHERE is_active) AS amcs,
              (SELECT count(*) FROM scheme_navs) AS nav_rows,
              (SELECT count(*) FROM fund_nav_metrics) AS metrics,
              (SELECT count(*) FROM scheme_compliance_facts) AS compliance,
              (SELECT count(*) FROM scheme_aums) AS aum_rows,
              (SELECT count(*) FROM scheme_ter) AS ter_rows,
              (SELECT count(*) FROM mutual_funds WHERE min_sip_amount IS NOT NULL) AS funds_with_min_sip,
              (SELECT count(*) FROM mutual_funds WHERE investment_constraints IS NOT NULL) AS funds_with_investment_details
            """
        )
    )
    print("\n=== Final counts ===", flush=True)
    print(dict(rows.mappings().one()), flush=True)


async def main() -> None:
    async with AsyncSessionLocal() as session:
        cleaned = await cleanup_stale_runs(session, threshold_hours=0)
        await session.commit()
        if cleaned:
            print(f"Cleaned {cleaned} stale MF ingestion run(s).", flush=True)

    async with AsyncSessionLocal() as session:
        print("\n=== cybrilla-scheme-validate ===", flush=True)
        validate = await run_cybrilla_scheme_validate(session, triggered_by="BOOTSTRAP")
        print(json.dumps(validate, default=str, indent=2), flush=True)
        if validate.get("skipped"):
            raise RuntimeError(f"Staging validate skipped: {validate.get('reason')}")

        batch_uuid = validate.get("batch_uuid")
        print("\n=== cybrilla-scheme-promote ===", flush=True)
        promote = await run_cybrilla_scheme_promote(
            session, triggered_by="BOOTSTRAP", batch_uuid=batch_uuid, force=True
        )
        print(json.dumps(promote, default=str, indent=2), flush=True)
        if promote.get("skipped"):
            raise RuntimeError(f"Staging promote skipped: {promote.get('reason')}")

        print("\n=== Dev empanel AMCs ===", flush=True)
        await session.execute(text("UPDATE fund_amcs SET is_active = true WHERE admin_kill_switch = false"))
        await session.commit()

    for job_name in SEQUENTIAL_JOBS:
        async with AsyncSessionLocal() as session:
            await _run_job(session, job_name)
            await session.commit()

    await _run_min_amounts_backfill_loop()

    async with AsyncSessionLocal() as session:
        print("\n=== Seed tax/compliance templates ===", flush=True)
        count = await seed_all_tax_compliance(session)
        await session.commit()
        print(f"Seeded compliance for {count} funds.", flush=True)
        await _print_counts(session)


if __name__ == "__main__":
    asyncio.run(main())
