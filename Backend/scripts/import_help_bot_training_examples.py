#!/usr/bin/env python3
"""Import JSONL training rows into support_resolution_examples (optional RAG seed)."""

from __future__ import annotations

import argparse
import asyncio
import json
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRAINING_DIR = ROOT / "data" / "help-bot-training"
SEED_TICKET_PUBLIC_ID = "TRAIN-SEED"


async def _import_batch(db, ticket, batch: int) -> int:
    from app.infrastructure.persistence.support_models import SupportResolutionExample

    path = TRAINING_DIR / f"batch-{batch:03d}.jsonl"
    if not path.is_file():
        return 0
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    for row in rows:
        topics = row.get("topics") or ["other"]
        db.add(
            SupportResolutionExample(
                id=uuid.uuid4(),
                ticket_id=ticket.id,
                topic=str(topics[0]),
                question=str(row.get("question") or "")[:2000],
                answer=str(row.get("solution") or "")[:2000],
            )
        )
    return len(rows)


async def _run(batch: int | None, all_batches: bool, dry_run: bool) -> None:
    from sqlalchemy import select

    from app.core.database import async_session_factory
    from app.infrastructure.persistence.support_models import SupportResolutionExample, SupportTicket

    if all_batches:
        batch_nums = sorted(
            int(p.stem.split("-")[1])
            for p in TRAINING_DIR.glob("batch-*.jsonl")
            if p.stem.split("-")[1].isdigit()
        )
    else:
        if batch is None:
            raise SystemExit("Specify --batch N or --all-batches")
        batch_nums = [batch]

    total = 0
    for batch_num in batch_nums:
        path = TRAINING_DIR / f"batch-{batch_num:03d}.jsonl"
        if not path.is_file():
            print(f"Skip missing {path.name}")
            continue
        count = len([ln for ln in path.read_text(encoding="utf-8").splitlines() if ln.strip()])
        total += count
        print(f"Queued {count} rows from {path.name}")

    if dry_run:
        print(f"Dry run: would import {total} rows")
        return

    async with async_session_factory() as db:
        ticket = await db.scalar(
            select(SupportTicket).where(SupportTicket.public_id == SEED_TICKET_PUBLIC_ID)
        )
        if ticket is None:
            raise SystemExit(
                f"No seed ticket {SEED_TICKET_PUBLIC_ID}. Create one via support admin or skip DB import."
            )

        await db.execute(
            SupportResolutionExample.__table__.delete().where(
                SupportResolutionExample.ticket_id == ticket.id
            )
        )
        imported = 0
        for batch_num in batch_nums:
            imported += await _import_batch(db, ticket, batch_num)
        await db.commit()
    print(f"Imported {imported} examples onto ticket {SEED_TICKET_PUBLIC_ID}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=int, default=None, help="Single batch number (e.g. 1)")
    parser.add_argument(
        "--all-batches",
        action="store_true",
        help="Import every batch-*.jsonl file (full corpus for retrieval)",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    asyncio.run(_run(args.batch, args.all_batches, args.dry_run))


if __name__ == "__main__":
    main()
