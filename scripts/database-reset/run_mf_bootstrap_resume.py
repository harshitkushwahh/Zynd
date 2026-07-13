#!/usr/bin/env python3
"""Resume MF bootstrap from nav-cold-start-backfill onward."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import date
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
from app.core.database import AsyncSessionLocal  # noqa: E402

POST_COLD_START_JOBS = (
    "nav-metrics-compute",
    "return-calculator-snapshot",
    "amfi-aaum-quarterly",
    "amfi-ter-monthly",
    "amc-aum-rank-compute",
)

MAX_MIN_AMOUNTS_BATCHES = 25


async def _run_job(session, name: str, *, job_kwargs: dict | None = None) -> dict:
    print(f"\n=== {name} ===", flush=True)
    result = await run_job_once(
        session,
        name,
        triggered_by="BOOTSTRAP_RESUME",
        skip_dependency_check=True,
        job_kwargs=job_kwargs,
    )
    print(json.dumps(result, default=str, indent=2), flush=True)
    return result


async def _run_min_amounts_backfill_loop() -> None:
    for batch_num in range(1, MAX_MIN_AMOUNTS_BATCHES + 1):
        async with AsyncSessionLocal() as session:
            result = await _run_job(session, "scheme-min-amounts-backfill")
            await session.commit()
        if int(result.get("updated", 0)) == 0:
            print(f"\nscheme-min-amounts-backfill finished after {batch_num} batch(es).", flush=True)
            break


async def _print_counts(session) -> None:
    rows = await session.execute(
        text(
            """
            SELECT
              (SELECT count(*) FROM scheme_navs) AS nav_rows,
              (SELECT count(*) FROM fund_nav_metrics) AS metrics,
              (SELECT count(*) FROM scheme_aums) AS aum_rows,
              (SELECT count(*) FROM scheme_ter) AS ter_rows,
              (SELECT count(*) FROM mutual_funds WHERE investment_constraints IS NOT NULL) AS funds_with_investment_details
            """
        )
    )
    print("\n=== Final counts ===", flush=True)
    print(dict(rows.mappings().one()), flush=True)


async def main() -> None:
    parser = argparse.ArgumentParser(description="Resume MF bootstrap from cold-start onward.")
    parser.add_argument(
        "--from-date",
        type=str,
        default="2010-03-11",
        help="Resume cold-start from this date (window 17 after window 16 failure).",
    )
    parser.add_argument(
        "--skip-cold-start",
        action="store_true",
        help="Skip cold-start and run enrichment jobs only.",
    )
    args = parser.parse_args()

    async with AsyncSessionLocal() as session:
        cleaned = await cleanup_stale_runs(session, threshold_hours=0)
        await session.commit()
        if cleaned:
            print(f"Cleaned {cleaned} stale MF ingestion run(s).", flush=True)

    if not args.skip_cold_start:
        print(
            f"\n=== nav-cold-start-backfill (resume from {args.from_date}) ===",
            flush=True,
        )
        print("Expect 20-80+ minutes for remaining windows.", flush=True)
        async with AsyncSessionLocal() as session:
            await _run_job(
                session,
                "nav-cold-start-backfill",
                job_kwargs={
                    "force": True,
                    "from_date": date.fromisoformat(args.from_date),
                },
            )
            await session.commit()

    for job_name in POST_COLD_START_JOBS:
        if job_name == "amfi-ter-monthly":
            print("amfi-ter-monthly: fetches ~125 AMFI pages then matches ~62k rows (~3-5 min).", flush=True)
        async with AsyncSessionLocal() as session:
            await _run_job(session, job_name)
            await session.commit()

    await _run_min_amounts_backfill_loop()

    async with AsyncSessionLocal() as session:
        count = await seed_all_tax_compliance(session)
        await session.commit()
        print(f"\nSeeded compliance for {count} funds.", flush=True)
        await _print_counts(session)


if __name__ == "__main__":
    asyncio.run(main())
