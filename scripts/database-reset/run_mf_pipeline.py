#!/usr/bin/env python3
"""Run the full MF ingestion pipeline after a fresh DB reset + seed."""

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

from app.application.mf.catalog_lifecycle_sync_service import run_catalog_lifecycle_sync  # noqa: E402
from app.application.mf.mf_scheduler_jobs import run_job_once  # noqa: E402
from app.application.mf.scheme_compliance_service import seed_all_tax_compliance  # noqa: E402
from app.application.mf.scheme_staging_ingest_service import run_cybrilla_scheme_ingest  # noqa: E402
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
    "fund-classification-compute",
    "collection-assign-sync",
    "composite-rank-compute",
    "return-calculator-snapshot",
    "amfi-aum-monthly",
    "amfi-aaum-quarterly",
    "amfi-ter-monthly",
    "amc-aum-rank-compute",
    "scheme-min-amounts-backfill",
)


async def _run_staging_pipeline(session) -> None:
    print("\n=== Cybrilla staging: ingest ===", flush=True)
    print("This pulls ~11k Cybrilla schemes across ~117 API pages.", flush=True)
    r1 = await run_cybrilla_scheme_ingest(session, triggered_by="BOOTSTRAP")
    print(json.dumps(r1, default=str, indent=2))
    if r1.get("skipped"):
        raise RuntimeError(f"Staging ingest skipped: {r1.get('reason')}")

    batch_uuid = r1["batch_uuid"]
    print("\n=== Cybrilla staging: validate ===")
    r2 = await run_cybrilla_scheme_validate(session, triggered_by="BOOTSTRAP", batch_uuid=batch_uuid)
    print(json.dumps(r2, default=str, indent=2))

    print("\n=== Cybrilla staging: promote (force) ===")
    r3 = await run_cybrilla_scheme_promote(
        session, triggered_by="BOOTSTRAP", batch_uuid=batch_uuid, force=True
    )
    print(json.dumps(r3, default=str, indent=2))

    print("\n=== Dev empanel AMCs ===")
    await session.execute(text("UPDATE fund_amcs SET is_active = true WHERE admin_kill_switch = false"))


async def _run_job(session, name: str) -> dict:
    print(f"\n=== {name} ===", flush=True)
    if name == "nav-cold-start-backfill":
        print("NAV cold-start downloads ~83 historical AMFI windows; expect 30-90+ minutes.", flush=True)
    result = await run_job_once(session, name, triggered_by="BOOTSTRAP", skip_dependency_check=True)
    print(json.dumps(result, default=str, indent=2))
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
              (SELECT count(*) FROM fund_derived_attributes) AS derived_attrs,
              (SELECT count(*) FROM product_categories pc JOIN categories c ON c.id = pc.category_id WHERE c.category_kind = 'COLLECTION') AS collection_links,
              (SELECT count(*) FROM scheme_compliance_facts) AS compliance,
              (SELECT count(*) FROM scheme_aums) AS aum_rows,
              (SELECT count(*) FROM scheme_ter) AS ter_rows,
              (SELECT count(*) FROM mutual_funds WHERE min_sip_amount IS NOT NULL) AS funds_with_min_sip,
              (SELECT count(*) FROM mutual_funds WHERE investment_constraints IS NOT NULL) AS funds_with_investment_details
            """
        )
    )
    print("\n=== Final counts ===")
    print(dict(rows.mappings().one()))


async def main() -> None:
    async with AsyncSessionLocal() as session:
        await _run_staging_pipeline(session)
        await session.commit()

    for job_name in SEQUENTIAL_JOBS:
        async with AsyncSessionLocal() as session:
            await _run_job(session, job_name)
            await session.commit()

    async with AsyncSessionLocal() as session:
        print("\n=== Seed tax/compliance templates ===")
        count = await seed_all_tax_compliance(session)
        await session.commit()
        print(f"Seeded compliance for {count} funds.")
        await _print_counts(session)


if __name__ == "__main__":
    asyncio.run(main())
