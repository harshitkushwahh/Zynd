from __future__ import annotations

import logging
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.amfi_nav_fetcher import fetch_amfi_nav_history_window, parse_amfi_nav_date
from app.application.mf.amfi_nav_parser import parse_amfi_nav_file
from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.core.config import get_settings
from app.infrastructure.mf.mongo_raw_store import store_raw_ingestion
from app.infrastructure.persistence.mf_models import IngestionRunStatus, MutualFund, SchemeNav

logger = logging.getLogger(__name__)

MIN_AVG_NAV_ROWS_PER_FUND = 50


def _build_date_windows(from_date: date, to_date: date, *, days_per_window: int) -> list[tuple[date, date]]:
    windows: list[tuple[date, date]] = []
    cursor = from_date
    while cursor <= to_date:
        window_end = min(cursor + timedelta(days=days_per_window - 1), to_date)
        windows.append((cursor, window_end))
        cursor = window_end + timedelta(days=1)
    return windows


async def needs_cold_start_backfill(session: AsyncSession) -> tuple[bool, dict[str, int]]:
    settings = get_settings()
    nav_count = int(await session.scalar(select(func.count()).select_from(SchemeNav)) or 0)
    mf_count = int(await session.scalar(select(func.count()).select_from(MutualFund)) or 0)

    if nav_count == 0:
        return True, {"nav_count": nav_count, "mf_count": mf_count, "reason": "empty_nav_table"}

    if mf_count > 0:
        avg_nav_per_fund = nav_count // mf_count
        if avg_nav_per_fund < MIN_AVG_NAV_ROWS_PER_FUND:
            return True, {
                "nav_count": nav_count,
                "mf_count": mf_count,
                "avg_nav_per_fund": avg_nav_per_fund,
                "reason": "shallow_nav_history",
            }

    threshold = max(settings.zynd_mf_cold_start_backfill_threshold, 1)
    if nav_count < threshold:
        return True, {
            "nav_count": nav_count,
            "mf_count": mf_count,
            "threshold": threshold,
            "reason": "below_threshold",
        }

    return False, {"nav_count": nav_count, "mf_count": mf_count}


async def run_nav_cold_start_backfill(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
    from_date: date | None = None,
    to_date: date | None = None,
    force: bool = False,
) -> dict[str, int | str | bool]:
    settings = get_settings()
    if not settings.zynd_mf_cold_start_backfill_enabled:
        return {"skipped": 1, "reason": "cold_start_disabled"}

    if await has_running_job(session, "nav-cold-start-backfill"):
        return {"skipped": 1, "reason": "already_running"}

    if not force:
        needed, stats = await needs_cold_start_backfill(session)
        if not needed:
            return {"skipped": 1, "reason": "not_needed", **stats}

    run = await begin_ingestion_run(session, job_name="nav-cold-start-backfill", triggered_by=triggered_by)
    processed = inserted = skipped = window_errors = 0
    backfill_from = from_date or date.fromisoformat(settings.zynd_mf_cold_start_backfill_from_date)
    backfill_to = to_date or date.today()
    if backfill_to > date.today():
        backfill_to = date.today()

    try:
        isin_to_fund_id: dict[str, int] = {}
        scheme_code_to_fund_id: dict[str, int] = {}
        if settings.zynd_mf_nav_isin_match_only:
            from app.application.mf.amfi_scheme_master_service import build_isin_to_fund_id_map

            isin_to_fund_id = await build_isin_to_fund_id_map(session)
            code_rows = await session.execute(
                select(MutualFund.scheme_code, MutualFund.id).where(MutualFund.scheme_code.isnot(None))
            )
            scheme_code_to_fund_id = {
                str(code).strip(): fund_id for code, fund_id in code_rows.all() if code
            }
            if not isin_to_fund_id and not scheme_code_to_fund_id:
                raise RuntimeError("mutual_funds has no ISIN rows; run cybrilla-scheme-sync first")

        windows = _build_date_windows(
            backfill_from,
            backfill_to,
            days_per_window=max(settings.zynd_mf_cold_start_backfill_days_per_window, 1),
        )
        print(
            f"NAV cold-start backfill: {len(windows)} windows "
            f"from {backfill_from} to {backfill_to}",
            flush=True,
        )

        for window_index, (window_from, window_to) in enumerate(windows, start=1):
            print(
                f"NAV cold-start backfill: window {window_index}/{len(windows)} "
                f"({window_from} .. {window_to})",
                flush=True,
            )
            try:
                body, file_size = await fetch_amfi_nav_history_window(window_from, window_to)
                try:
                    await store_raw_ingestion(
                        job_name="nav-cold-start-backfill",
                        run_uuid=str(run.run_uuid),
                        payload=body,
                    )
                except Exception as archive_exc:
                    logger.warning(
                        "Cold-start NAV raw archive skipped window=%s..%s error=%s",
                        window_from,
                        window_to,
                        archive_exc,
                    )
                records = parse_amfi_nav_file(body)
                print(
                    f"NAV cold-start backfill: window {window_index}/{len(windows)} "
                    f"parsed={len(records)} inserted_so_far={inserted} bytes={file_size}",
                    flush=True,
                )
                logger.info(
                    "Cold-start NAV window=%s..%s parsed=%s bytes=%s",
                    window_from,
                    window_to,
                    len(records),
                    file_size,
                )

                chunk: list[dict] = []
                chunk_size = max(settings.zynd_mf_nav_write_chunk_size, 1)

                for record in records:
                    processed += 1
                    nav_date = parse_amfi_nav_date(record["nav_date_raw"])
                    if not nav_date:
                        skipped += 1
                        continue

                    fund_id = isin_to_fund_id.get(record["isin_growth"]) if record.get("isin_growth") else None
                    if not fund_id:
                        fund_id = scheme_code_to_fund_id.get(str(record["scheme_code"]).strip())
                    if not fund_id:
                        skipped += 1
                        continue

                    chunk.append(
                        {
                            "fund_id": fund_id,
                            "nav_date": nav_date,
                            "nav_value": record["nav_value"],
                            "source": "AMFI",
                        }
                    )
                    if len(chunk) >= chunk_size:
                        ins, sk = await _upsert_nav_chunk(session, chunk)
                        inserted += ins
                        skipped += sk
                        chunk.clear()

                if chunk:
                    ins, sk = await _upsert_nav_chunk(session, chunk)
                    inserted += ins
                    skipped += sk

                await session.commit()
                logger.info(
                    "Cold-start NAV window committed window=%s..%s cumulative_inserted=%s",
                    window_from,
                    window_to,
                    inserted,
                )

            except Exception as exc:
                window_errors += 1
                logger.warning(
                    "Cold-start NAV window failed window=%s..%s error=%s",
                    window_from,
                    window_to,
                    exc,
                )

        status = IngestionRunStatus.succeeded if window_errors == 0 else IngestionRunStatus.failed
        await finish_ingestion_run(
            session,
            run,
            status=status,
            records_processed=processed,
            records_inserted=inserted,
            records_skipped=skipped,
            error_message="One or more history windows failed" if window_errors else None,
            metadata={
                "from_date": str(backfill_from),
                "to_date": str(backfill_to),
                "windows": len(windows),
                "window_errors": window_errors,
            },
        )
        return {
            "processed": processed,
            "inserted": inserted,
            "skipped": skipped,
            "window_errors": window_errors,
            "windows": len(windows),
            "run_uuid": str(run.run_uuid),
        }
    except Exception as exc:
        logger.exception("NAV cold-start backfill failed")
        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.failed,
            records_processed=processed,
            records_inserted=inserted,
            records_skipped=skipped,
            error_message=str(exc),
        )
        raise


async def _upsert_nav_chunk(session: AsyncSession, rows: list[dict]) -> tuple[int, int]:
    if not rows:
        return 0, 0
    inserted = skipped = 0
    for row in rows:
        stmt = (
            insert(SchemeNav)
            .values(**row)
            .on_conflict_do_nothing(index_elements=["fund_id", "nav_date"])
        )
        result = await session.execute(stmt)
        if result.rowcount:
            inserted += 1
        else:
            skipped += 1
    return inserted, skipped
