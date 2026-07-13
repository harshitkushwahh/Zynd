#!/usr/bin/env python3
"""Resume MF scheduler jobs after an interrupted bootstrap run."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import text

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_ROOT = SCRIPT_DIR.parent.parent / "Backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

load_dotenv(BACKEND_ROOT / ".env")

from app.application.mf.ingestion_run_service import cleanup_stale_runs  # noqa: E402
from app.application.mf.mf_scheduler_jobs import run_job_once  # noqa: E402
from app.application.mf.scheme_compliance_service import seed_all_tax_compliance  # noqa: E402
from app.core.database import AsyncSessionLocal  # noqa: E402

RESUME_JOBS = (
    "nav-cold-start-backfill",
    "nav-metrics-compute",
    "return-calculator-snapshot",
    "amfi-aum-monthly",
    "amfi-aaum-quarterly",
    "amfi-ter-monthly",
    "amc-aum-rank-compute",
    "scheme-min-amounts-backfill",
)


async def _run_job(session, name: str) -> dict:
    print(f"\n=== {name} ===", flush=True)
    result = await run_job_once(session, name, triggered_by="BOOTSTRAP_RESUME", skip_dependency_check=True)
    print(json.dumps(result, default=str, indent=2), flush=True)
    return result


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
        print(f"Cleaned stale MF ingestion runs: {cleaned}", flush=True)

    for job_name in RESUME_JOBS:
        async with AsyncSessionLocal() as session:
            await _run_job(session, job_name)
            await session.commit()

    async with AsyncSessionLocal() as session:
        print("\n=== Seed tax/compliance templates ===", flush=True)
        count = await seed_all_tax_compliance(session)
        await session.commit()
        print(f"Seeded compliance for {count} funds.", flush=True)
        await _print_counts(session)


if __name__ == "__main__":
    asyncio.run(main())
