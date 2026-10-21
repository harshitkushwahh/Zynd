#!/usr/bin/env python3
"""Compile help-bot training corpus: stats, coverage refresh, fine-tune JSONL export."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRAINING_DIR = ROOT / "data" / "help-bot-training"
COMPILED_DIR = TRAINING_DIR / "compiled"
EXPORTS_DIR = TRAINING_DIR / "exports"
MANIFEST_PATH = TRAINING_DIR / "manifest.json"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Roman Hindi / Hinglish cues (curated batches + parametric pool)
_HINGlish_RE = re.compile(
    r"\b(kya|hai|hain|mera|meri|mere|nahi|nahin|chahiye|bhai|dikha|matlab|"
    r"kaise|kab|kahan|kyun|ho gaya|hua|hoga|batao|bas|abhi|thoda|jaldi|"
    r"paisa|payment fail|order fail|kyc complete|sip band)\b",
    re.IGNORECASE,
)


def _load_all_rows() -> list[dict]:
    rows: list[dict] = []
    for path in sorted(TRAINING_DIR.glob("batch-*.jsonl")):
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def _is_hinglish(text: str) -> bool:
    t = text.strip()
    if not t:
        return False
    if _HINGlish_RE.search(t):
        return True
    return bool(re.search(r"[\u0900-\u097F]", t))


def _build_summary(rows: list[dict]) -> dict:
    topic_counts: Counter[str] = Counter()
    batch_counts: Counter[int] = Counter()
    can_answer_true = 0
    can_answer_false = 0
    paraphrase_rows = 0
    hinglish_questions = 0
    context_field_counts: Counter[str] = Counter()
    curated_batches = {60, 61}

    for row in rows:
        batch = int(row.get("batch") or 0)
        batch_counts[batch] += 1
        for topic in row.get("topics") or []:
            topic_counts[str(topic)] += 1
        if row.get("can_answer"):
            can_answer_true += 1
        else:
            can_answer_false += 1
        for para in row.get("paraphrases") or []:
            paraphrase_rows += 1
            if _is_hinglish(str(para)):
                hinglish_questions += 1
        q = str(row.get("question") or "")
        if _is_hinglish(q):
            hinglish_questions += 1
        for field in row.get("context_fields") or []:
            context_field_counts[str(field)] += 1

    hinglish_by_batch = {
        str(b): sum(
            1
            for r in rows
            if int(r.get("batch") or 0) == b
            and (
                _is_hinglish(str(r.get("question") or ""))
                or any(_is_hinglish(str(p)) for p in (r.get("paraphrases") or []))
            )
        )
        for b in sorted(batch_counts)
        if b >= 2 or b in curated_batches
    }

    manifest_target = None
    if MANIFEST_PATH.is_file():
        manifest_target = json.loads(MANIFEST_PATH.read_text(encoding="utf-8")).get("target_total")

    return {
        "total_training_rows": len(rows),
        "manifest_target_total": manifest_target,
        "paraphrase_variants": paraphrase_rows,
        "can_answer_true": can_answer_true,
        "can_answer_false": can_answer_false,
        "hinglish_question_or_paraphrase_hits": hinglish_questions,
        "hinglish_by_batch_sample": hinglish_by_batch,
        "curated_hinglish_batches": {
            "060": batch_counts.get(60, 0),
            "061": batch_counts.get(61, 0),
        },
        "topics_row_tag_counts": dict(topic_counts.most_common()),
        "batches": {str(k): v for k, v in sorted(batch_counts.items())},
        "unique_context_fields": len(context_field_counts),
        "top_context_fields": dict(context_field_counts.most_common(25)),
    }


def _write_markdown(summary: dict, coverage_path: Path) -> str:
    lines = [
        "# Compiled help-bot dataset summary",
        "",
        f"- **Training rows:** {summary['total_training_rows']}",
        f"- **Manifest target:** {summary.get('manifest_target_total')}",
        f"- **Can answer (true / false):** {summary['can_answer_true']} / {summary['can_answer_false']}",
        f"- **Paraphrase variants:** {summary['paraphrase_variants']}",
        f"- **Hinglish-tagged questions/paraphrases (heuristic):** {summary['hinglish_question_or_paraphrase_hits']}",
        f"- **Curated Hinglish batches 060+061:** {summary['curated_hinglish_batches']}",
        f"- **Unique context fields referenced:** {summary['unique_context_fields']}",
        "",
        "## Topics (row tag counts)",
        "",
    ]
    for topic, count in summary.get("topics_row_tag_counts", {}).items():
        lines.append(f"- `{topic}`: {count}")
    lines.extend(["", "## Top context fields", ""])
    for field, count in summary.get("top_context_fields", {}).items():
        lines.append(f"- `{field}`: {count}")
    if coverage_path.is_file():
        lines.extend(["", f"See also [{coverage_path.name}](../coverage-report.md).", ""])
    lines.extend(
        [
            "## Fine-tune export",
            "",
            "Chat JSONL (Phase 2 context-rich) is written under `exports/` by this script.",
            "Use the same prompt shape as `export_help_bot_finetune_jsonl.py` for OpenAI-compatible fine-tunes.",
            "Production help bot uses **retrieval + Groq** until a custom model is wired via `SUPPORT_LLM_*`.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Compile stats and export fine-tune JSONL")
    parser.add_argument("--skip-coverage", action="store_true")
    parser.add_argument("--skip-export", action="store_true")
    parser.add_argument(
        "--export-out",
        type=Path,
        default=EXPORTS_DIR / "zynd-help-finetune-full.jsonl",
    )
    parser.add_argument("--include-paraphrases", action="store_true", help="Double export rows for paraphrases")
    parser.add_argument("--max-export-rows", type=int, default=0)
    parser.add_argument("--salt", type=int, default=0)
    args = parser.parse_args()

    rows = _load_all_rows()
    summary = _build_summary(rows)
    COMPILED_DIR.mkdir(parents=True, exist_ok=True)
    summary_path = COMPILED_DIR / "dataset-summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    if not args.skip_coverage:
        subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "help_bot_coverage_report.py")],
            check=True,
            cwd=str(ROOT),
        )

    md = _write_markdown(summary, TRAINING_DIR / "coverage-report.md")
    (COMPILED_DIR / "dataset-summary.md").write_text(md, encoding="utf-8")

    if not args.skip_export:
        cmd = [
            sys.executable,
            str(ROOT / "scripts" / "export_help_bot_finetune_jsonl.py"),
            "--batches",
            "all",
            "--out",
            str(args.export_out),
            "--salt",
            str(args.salt),
        ]
        if args.include_paraphrases:
            cmd.append("--include-paraphrases")
        if args.max_export_rows > 0:
            cmd.extend(["--max-rows", str(args.max_export_rows)])
        subprocess.run(cmd, check=True, cwd=str(ROOT))
        summary["finetune_export"] = {
            "path": str(args.export_out.relative_to(ROOT)),
            "include_paraphrases": args.include_paraphrases,
        }
        summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(json.dumps(summary, indent=2))
    print(f"Wrote {summary_path} and {COMPILED_DIR / 'dataset-summary.md'}")


if __name__ == "__main__":
    main()
