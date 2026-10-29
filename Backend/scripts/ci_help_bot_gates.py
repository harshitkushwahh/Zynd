#!/usr/bin/env python3
"""CI gates: field coverage + held-out eval retrieval (Phase 0)."""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = Path(__file__).resolve().parent
TRAINING_DIR = ROOT / "data" / "help-bot-training"
EVAL_PATH = TRAINING_DIR / "eval" / "eval-set.jsonl"
MANIFEST_PATH = TRAINING_DIR / "manifest.json"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from app.application.support.help_bot_policy_eval import run_policy_regression  # noqa: E402
from app.application.support.training_loader import similar_training_examples  # noqa: E402
import eval_help_bot_retrieval as retrieval_eval  # noqa: E402
import help_bot_coverage_report as coverage_report  # noqa: E402

POLICY_REGRESSION_PATH = TRAINING_DIR / "eval" / "policy-regression.jsonl"

_compute_coverage = coverage_report._compute_coverage
_load_training_rows = coverage_report._load_training_rows
_example_hits = retrieval_eval._example_hits
_load_training_index = retrieval_eval._load_training_index


def _normalize(text: str) -> str:
    lowered = text.lower().strip()
    lowered = re.sub(r"\s+", " ", lowered)
    return re.sub(r"[^\w\s]", "", lowered)


def _load_manifest_thresholds() -> dict:
    defaults = {
        "min_coverage_pct": 100.0,
        "min_retrieval_hit_at_3_pct": 75.0,
        "eval_row_count": 250,
        "retrieval_k": 3,
        "policy_regression_count": 12,
        "min_policy_regression_pass_pct": 100.0,
    }
    if not MANIFEST_PATH.is_file():
        return defaults
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    eval_meta = manifest.get("eval") or {}
    return {
        "min_coverage_pct": float(eval_meta.get("min_coverage_pct", defaults["min_coverage_pct"])),
        "min_retrieval_hit_at_3_pct": float(
            eval_meta.get("min_retrieval_hit_at_3_pct", defaults["min_retrieval_hit_at_3_pct"])
        ),
        "eval_row_count": int(eval_meta.get("count", defaults["eval_row_count"])),
        "retrieval_k": int(eval_meta.get("retrieval_k", defaults["retrieval_k"])),
        "policy_regression_count": int(
            eval_meta.get("policy_regression_count", defaults["policy_regression_count"])
        ),
        "min_policy_regression_pass_pct": float(
            eval_meta.get(
                "min_policy_regression_pass_pct",
                defaults["min_policy_regression_pass_pct"],
            )
        ),
    }


def _verify_eval_no_train_overlap(train_rows: list[dict], eval_rows: list[dict]) -> None:
    train_q = {_normalize(str(r.get("question") or "")) for r in train_rows if r.get("question")}
    for para_source in train_rows:
        for para in para_source.get("paraphrases") or []:
            train_q.add(_normalize(str(para)))
    for case in eval_rows:
        norm = _normalize(str(case.get("question") or ""))
        if norm in train_q:
            raise SystemExit(f"Eval question overlaps training: {case.get('id')}")


def _github_summary(lines: list[str]) -> None:
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return
    with open(summary_path, "a", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")


def main() -> None:
    thresholds = _load_manifest_thresholds()
    train_rows = _load_training_rows()
    coverage = _compute_coverage(train_rows)

    if not EVAL_PATH.is_file():
        raise SystemExit(f"Missing eval set: {EVAL_PATH}")

    eval_rows: list[dict] = []
    with EVAL_PATH.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                eval_rows.append(json.loads(line))

    expected_eval = thresholds["eval_row_count"]
    if len(eval_rows) != expected_eval:
        raise SystemExit(f"Eval set has {len(eval_rows)} rows, expected {expected_eval}")

    _verify_eval_no_train_overlap(train_rows, eval_rows)

    coverage_pct = float(coverage["coverage_pct"])
    min_cov = thresholds["min_coverage_pct"]
    if coverage_pct < min_cov:
        missing = coverage.get("missing_fields") or []
        raise SystemExit(
            f"Field coverage {coverage_pct}% below minimum {min_cov}%. Missing: {missing[:10]}"
        )

    k = thresholds["retrieval_k"]
    training_index = _load_training_index()
    hits = 0
    for case in eval_rows:
        examples = similar_training_examples(
            str(case.get("question") or ""),
            tuple(case.get("topics") or []),
            limit=k,
        )
        if _example_hits(case, examples, training_index):
            hits += 1

    hit_pct = 100.0 * hits / max(len(eval_rows), 1)
    min_hit = thresholds["min_retrieval_hit_at_3_pct"]
    if hit_pct < min_hit:
        raise SystemExit(
            f"Retrieval hit@{k} {hit_pct:.1f}% below minimum {min_hit}% ({hits}/{len(eval_rows)})"
        )

    if not POLICY_REGRESSION_PATH.is_file():
        raise SystemExit(f"Missing policy regression set: {POLICY_REGRESSION_PATH}")

    policy_passed, policy_total, policy_results = run_policy_regression(POLICY_REGRESSION_PATH)
    expected_policy = thresholds["policy_regression_count"]
    if policy_total != expected_policy:
        raise SystemExit(
            f"Policy regression has {policy_total} rows, expected {expected_policy}"
        )
    policy_pct = 100.0 * policy_passed / max(policy_total, 1)
    min_policy = thresholds["min_policy_regression_pass_pct"]
    if policy_pct < min_policy:
        failed = [row.case_id for row in policy_results if not row.ok]
        raise SystemExit(
            f"Policy regression {policy_pct:.1f}% below minimum {min_policy}% "
            f"({policy_passed}/{policy_total}) failed={failed[:6]}"
        )

    print(
        f"help_bot_gates ok: coverage={coverage_pct}% "
        f"hit@{k}={hit_pct:.1f}% ({hits}/{len(eval_rows)}) "
        f"policy={policy_pct:.1f}% ({policy_passed}/{policy_total}) "
        f"train_rows={len(train_rows)}"
    )
    _github_summary(
        [
            "## Help bot corpus gates",
            "",
            f"- Training rows: **{len(train_rows)}**",
            f"- Field coverage: **{coverage_pct}%** (min {min_cov}%)",
            f"- Eval rows: **{len(eval_rows)}**",
            f"- Retrieval hit@{k}: **{hit_pct:.1f}%** ({hits}/{len(eval_rows)}, min {min_hit}%)",
            f"- Policy regression: **{policy_pct:.1f}%** ({policy_passed}/{policy_total}, min {min_policy}%)",
            "",
            "Eval set is held out from `batch-*.jsonl` (overlap check passed).",
            "`policy-regression.jsonl` exercises answer/escalation policy without LLM calls.",
        ]
    )


if __name__ == "__main__":
    main()
