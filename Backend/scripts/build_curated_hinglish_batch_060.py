#!/usr/bin/env python3
"""Pack curated customer Hinglish JSONL into batch-060.jsonl (no parametric generation)."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRAINING_DIR = ROOT / "data" / "help-bot-training"
SOURCE = TRAINING_DIR / "curated" / "batch-060-entries.jsonl"
OUT = TRAINING_DIR / "batch-060.jsonl"
BATCH = 60

SCRIPTS = Path(__file__).resolve().parent
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from generate_help_bot_training_batch import _row  # noqa: E402


def _normalize(text: str) -> str:
    lowered = text.lower().strip()
    lowered = re.sub(r"\s+", " ", lowered)
    return re.sub(r"[^\w\s]", "", lowered)


def _train_questions() -> set[str]:
    seen: set[str] = set()
    for path in sorted(TRAINING_DIR.glob("batch-*.jsonl")):
        if path.name == OUT.name:
            continue
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                row = json.loads(line)
                q = _normalize(str(row.get("question") or ""))
                if q:
                    seen.add(q)
    return seen


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"Missing curated source: {SOURCE}")

    train_q = _train_questions()
    rows: list[dict] = []
    seen: set[str] = set()

    with SOURCE.open(encoding="utf-8") as handle:
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
                raise SystemExit(f"Duplicate in curated file line {index}")
            if norm in train_q:
                raise SystemExit(f"Line {index}: overlaps existing training question")
            seen.add(norm)

            topics = list(payload.get("topics") or [])
            if not topics:
                raise SystemExit(f"Line {index}: missing topics")
            slug = f"hi-{index:04d}"
            rows.append(
                _row(
                    BATCH,
                    slug,
                    topics,
                    question,
                    context_fields=list(payload.get("context_fields") or []),
                    solution=str(payload.get("solution") or "").strip(),
                    can_answer=bool(payload.get("can_answer", True)),
                    paraphrases=list(payload.get("paraphrases") or []),
                )
            )

    if len(rows) != 1000:
        raise SystemExit(f"Expected 1000 curated rows, got {len(rows)}")

    with OUT.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")

    total_rows = 0
    for path in sorted(TRAINING_DIR.glob("batch-*.jsonl")):
        with path.open(encoding="utf-8") as handle:
            total_rows += sum(1 for line in handle if line.strip())

    manifest_path = TRAINING_DIR / "manifest.json"
    if manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["cumulative_count"] = total_rows
        manifest["target_total"] = max(int(manifest.get("target_total") or 0), total_rows)
        batches = manifest.get("batches") or []
        if not any(int(b.get("batch", 0)) == BATCH for b in batches):
            batches.append(
                {
                    "batch": BATCH,
                    "file": "batch-060.jsonl",
                    "count": 1000,
                    "status": "complete",
                    "notes": "Curated customer Hinglish (hand-authored corpus, not parametric)",
                }
            )
        manifest["batches"] = sorted(batches, key=lambda b: int(b["batch"]))
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print(f"Wrote {len(rows)} curated rows -> {OUT}")


if __name__ == "__main__":
    main()
