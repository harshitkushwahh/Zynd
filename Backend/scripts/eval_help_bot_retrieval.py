#!/usr/bin/env python3
"""Score retrieval hit@k on held-out eval set (Phase 0)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRAINING_DIR = ROOT / "data" / "help-bot-training"
EVAL_PATH = TRAINING_DIR / "eval" / "eval-set.jsonl"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.application.support.help_bot_field_catalog import prefix_match_path  # noqa: E402
from app.application.support.training_loader import similar_training_examples  # noqa: E402


def _load_training_index() -> dict[str, dict]:
    index: dict[str, dict] = {}
    for path in sorted(TRAINING_DIR.glob("batch-*.jsonl")):
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                row = json.loads(line)
                row_id = str(row.get("id") or "")
                if row_id:
                    index[row_id] = row
    return index


def _load_eval() -> list[dict]:
    rows: list[dict] = []
    with EVAL_PATH.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def _fields_for_row(row: dict) -> set[str]:
    out: set[str] = set()
    for ref in row.get("context_fields") or []:
        mapped = prefix_match_path(str(ref))
        if mapped:
            out.add(mapped)
    return out


def _example_hits(case: dict, examples: list[dict], training_index: dict[str, dict]) -> bool:
    expected_fields = _fields_for_row(case)
    topics = set(case.get("topics") or [])
    case_tokens = {t for t in case.get("question", "").lower().split() if len(t) > 4}

    for ex in examples:
        ex_topics = set((ex.get("topics") or "").split(",")) if ex.get("topics") else set()
        if topics & ex_topics:
            train_row = training_index.get(str(ex.get("id") or ""))
            if train_row and expected_fields:
                if _fields_for_row(train_row) & expected_fields:
                    return True
            elif train_row or not expected_fields:
                return True

        ex_q = (ex.get("question") or "").lower()
        if case_tokens and any(token in ex_q for token in case_tokens):
            return True

    return False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=3, help="Retrieval limit (hit@k)")
    parser.add_argument("--out", type=Path, default=TRAINING_DIR / "eval" / "retrieval-report.json")
    args = parser.parse_args()

    eval_rows = _load_eval()
    training_index = _load_training_index()
    hits = 0
    misses: list[dict] = []

    for case in eval_rows:
        question = str(case.get("question") or "")
        topics = tuple(case.get("topics") or [])
        examples = similar_training_examples(question, topics, limit=args.limit)
        if _example_hits(case, examples, training_index):
            hits += 1
        else:
            misses.append({"id": case.get("id"), "question": question, "retrieved": examples})

    report = {
        "eval_rows": len(eval_rows),
        "hit_at_k": args.limit,
        "hits": hits,
        "hit_rate_pct": round(100.0 * hits / max(len(eval_rows), 1), 2),
        "misses_sample": misses[:25],
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Retrieval hit@{args.limit}: {hits}/{len(eval_rows)} ({report['hit_rate_pct']}%) -> {args.out}")


if __name__ == "__main__":
    main()
