#!/usr/bin/env python3
"""Pack curated JSONL sources into batch-NNN.jsonl (customer voice, not parametric)."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRAINING_DIR = ROOT / "data" / "help-bot-training"
SCRIPTS = Path(__file__).resolve().parent
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from generate_help_bot_training_batch import _row  # noqa: E402


def _normalize(text: str) -> str:
    lowered = text.lower().strip()
    lowered = re.sub(r"\s+", " ", lowered)
    return re.sub(r"[^\w\s]", "", lowered)


def _train_questions(exclude_out: Path) -> set[str]:
    seen: set[str] = set()
    for path in sorted(TRAINING_DIR.glob("batch-*.jsonl")):
        if path.resolve() == exclude_out.resolve():
            continue
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                row = json.loads(line)
                q = _normalize(str(row.get("question") or ""))
                if q:
                    seen.add(q)
    return seen


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=int, required=True)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--count", type=int, default=1000)
    parser.add_argument("--slug-prefix", type=str, default="cur")
    parser.add_argument("--notes", type=str, default="Curated customer corpus")
    args = parser.parse_args()

    out = TRAINING_DIR / f"batch-{args.batch:03d}.jsonl"
    source = args.source if args.source.is_absolute() else TRAINING_DIR / args.source

    if not source.is_file():
        raise SystemExit(f"Missing source: {source}")

    train_q = _train_questions(out)
    rows: list[dict] = []
    seen: set[str] = set()

    with source.open(encoding="utf-8") as handle:
        for index, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            payload = json.loads(line)
            question = str(payload.get("question") or "").strip()
            if not question:
                raise SystemExit(f"Line {index}: empty question")
            norm = _normalize(question)
            if norm in seen:
                raise SystemExit(f"Duplicate in source line {index}")
            if norm in train_q:
                raise SystemExit(f"Line {index}: overlaps existing training question")
            seen.add(norm)

            topics = list(payload.get("topics") or [])
            if not topics:
                raise SystemExit(f"Line {index}: missing topics")
            slug = f"{args.slug_prefix}-{index:04d}"
            rows.append(
                _row(
                    args.batch,
                    slug,
                    topics,
                    question,
                    context_fields=list(payload.get("context_fields") or []),
                    solution=str(payload.get("solution") or "").strip(),
                    can_answer=bool(payload.get("can_answer", True)),
                    paraphrases=list(payload.get("paraphrases") or []),
                )
            )

    if len(rows) != args.count:
        raise SystemExit(f"Expected {args.count} rows, got {len(rows)}")

    with out.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")

    total_rows = sum(
        1
        for path in sorted(TRAINING_DIR.glob("batch-*.jsonl"))
        for line in path.open(encoding="utf-8")
        if line.strip()
    )

    manifest_path = TRAINING_DIR / "manifest.json"
    if manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["cumulative_count"] = total_rows
        manifest["target_total"] = max(int(manifest.get("target_total") or 0), total_rows)
        batches = manifest.get("batches") or []
        if not any(int(b.get("batch", 0)) == args.batch for b in batches):
            batches.append(
                {
                    "batch": args.batch,
                    "file": out.name,
                    "count": args.count,
                    "status": "complete",
                    "notes": args.notes,
                }
            )
        else:
            for entry in batches:
                if int(entry.get("batch", 0)) == args.batch:
                    entry["notes"] = args.notes
                    entry["count"] = args.count
        manifest["batches"] = sorted(batches, key=lambda b: int(b["batch"]))
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print(f"Wrote {len(rows)} rows -> {out} (corpus total {total_rows})")


if __name__ == "__main__":
    main()
