#!/usr/bin/env python3
"""Parametric help-bot corpus generator (Phase 1): scale to arbitrary row counts."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "help-bot-training"
SCRIPTS = Path(__file__).resolve().parent
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from help_bot_corpus_templates import generate_rows  # noqa: E402


def _count_existing() -> tuple[int, int, set[str]]:
    total = 0
    max_batch = 0
    ids: set[str] = set()
    if not OUT_DIR.is_dir():
        return 0, 0, ids
    for path in sorted(OUT_DIR.glob("batch-*.jsonl")):
        batch_num = int(path.stem.split("-")[1])
        max_batch = max(max_batch, batch_num)
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                payload = json.loads(line)
                total += 1
                row_id = str(payload.get("id") or "")
                if row_id:
                    ids.add(row_id)
    return total, max_batch, ids


def _assign_batches(rows: list[dict], *, start_batch: int, batch_size: int) -> dict[int, list[dict]]:
    by_batch: dict[int, list[dict]] = {}
    for index, row in enumerate(rows):
        batch_num = start_batch + index // batch_size
        row = dict(row)
        row["batch"] = batch_num
        prefix = f"b{batch_num:03d}"
        old_id = str(row.get("id") or "")
        slug = old_id.split("-", 1)[-1] if "-" in old_id else old_id
        row["id"] = f"{prefix}-{slug}"
        by_batch.setdefault(batch_num, []).append(row)
    return by_batch


def _write_batches(by_batch: dict[int, list[dict]], *, batch_size: int, overwrite: bool) -> int:
    written = 0
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for batch_num in sorted(by_batch):
        rows = by_batch[batch_num]
        if len(rows) != batch_size:
            raise SystemExit(f"Batch {batch_num} has {len(rows)} rows, expected {batch_size}")
        out_path = OUT_DIR / f"batch-{batch_num:03d}.jsonl"
        if out_path.exists() and not overwrite:
            raise SystemExit(f"Refusing to overwrite {out_path} (pass --overwrite)")
        with out_path.open("w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row, ensure_ascii=False) + "\n")
        written += len(rows)
        print(f"Wrote {len(rows)} rows -> {out_path}")
    return written


def _update_manifest(total_rows: int, batch_size: int) -> None:
    manifest_path = OUT_DIR / "manifest.json"
    if not manifest_path.is_file():
        return
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["cumulative_count"] = total_rows
    manifest["target_total"] = max(int(manifest.get("target_total") or 0), total_rows)
    manifest["batch_size"] = batch_size
    manifest["generator"] = "generate_help_bot_corpus.py"
    batches_meta = manifest.get("batches") or []
    existing_nums = {int(b["batch"]) for b in batches_meta if "batch" in b}
    max_batch = max((int(b["batch"]) for b in batches_meta), default=0)
    for batch_num in range(1, (total_rows + batch_size - 1) // batch_size + 1):
        if batch_num in existing_nums and batch_num <= 10:
            continue
        if batch_num <= max_batch and batch_num in existing_nums:
            for entry in batches_meta:
                if int(entry.get("batch", 0)) == batch_num:
                    entry["count"] = batch_size
                    entry["status"] = "complete"
                    entry["file"] = f"batch-{batch_num:03d}.jsonl"
                    entry["notes"] = (
                        "Hinglish + module templates (Phase 1 expansion)"
                        if batch_num >= 40
                        else "Parametric corpus (Phase 1)"
                    )
        else:
            batches_meta.append(
                {
                    "batch": batch_num,
                    "file": f"batch-{batch_num:03d}.jsonl",
                    "count": batch_size,
                    "status": "complete",
                    "notes": (
                        "Hinglish + module templates (Phase 1 expansion)"
                        if batch_num >= 40
                        else "Parametric corpus (Phase 1)"
                    ),
                }
            )
    manifest["batches"] = sorted(batches_meta, key=lambda b: int(b["batch"]))
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Updated manifest cumulative_count={total_rows}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate help-bot JSONL batches to a target corpus size.")
    parser.add_argument("--target", type=int, default=30_000, help="Total rows across all batch-*.jsonl files")
    parser.add_argument("--batch-size", type=int, default=1000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow overwriting batch files that would be written",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print plan only; do not write files",
    )
    parser.add_argument(
        "--focus",
        type=str,
        default="auto",
        choices=("auto", "balanced", "hinglish", "modules", "modules_only", "expansion"),
        help="auto: Hinglish/module pool from row 30k+; balanced: legacy pool only",
    )
    args = parser.parse_args()

    if args.batch_size <= 0 or args.target <= 0:
        raise SystemExit("target and batch-size must be positive")

    existing_total, max_batch, _ = _count_existing()
    if existing_total >= args.target:
        print(f"Corpus already has {existing_total} rows (target {args.target}). Nothing to do.")
        return

    need = args.target - existing_total
    start_batch = max_batch + 1 if max_batch else 1
    # If curated batches 1-10 exist (1000 rows), start_batch is 11
    start_seq = existing_total

    focus = args.focus
    if focus == "auto" and start_seq >= 30_000:
        focus_note = "auto → expansion (Hinglish/modules) for new rows"
    elif focus == "auto":
        focus_note = "auto → balanced until row 30k, then expansion"
    else:
        focus_note = focus

    print(
        f"Existing rows: {existing_total}; generating {need} new rows "
        f"into batches starting at {start_batch} (batch_size={args.batch_size}, seed={args.seed}, focus={focus_note})"
    )

    if args.dry_run:
        batches = (need + args.batch_size - 1) // args.batch_size
        end_batch = start_batch + batches - 1
        print(f"Dry run: would create {batches} batch file(s), ending at batch {end_batch}")
        if args.focus == "auto" and existing_total < 30_000 <= args.target:
            print("Note: rows from seq 30000+ use Hinglish + module navigation templates.")
        return

    rows = generate_rows(need, start_seq=start_seq, seed=args.seed, focus=args.focus)
    by_batch = _assign_batches(rows, start_batch=start_batch, batch_size=args.batch_size)
    written = _write_batches(by_batch, batch_size=args.batch_size, overwrite=args.overwrite)
    new_total = existing_total + written
    _update_manifest(new_total, args.batch_size)
    print(f"Done. Added {written} rows; corpus total {new_total}.")


if __name__ == "__main__":
    main()
