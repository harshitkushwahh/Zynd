#!/usr/bin/env python3
"""Phase 0: field catalog export + training corpus coverage report."""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRAINING_DIR = ROOT / "data" / "help-bot-training"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.application.support.help_bot_field_catalog import (  # noqa: E402
    CATALOG,
    PATH_TO_SPEC,
    catalog_as_json,
    prefix_match_path,
)

_BATCH_LINE = re.compile(r"^batch-\d+\.jsonl$")


def _normalize_question(text: str) -> str:
    lowered = text.lower().strip()
    lowered = re.sub(r"\s+", " ", lowered)
    return re.sub(r"[^\w\s]", "", lowered)


def _load_training_rows() -> list[dict]:
    rows: list[dict] = []
    for path in sorted(TRAINING_DIR.glob("batch-*.jsonl")):
        if not _BATCH_LINE.match(path.name):
            continue
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if line:
                    rows.append(json.loads(line))
    return rows


def _compute_coverage(rows: list[dict]) -> dict:
    touched: Counter[str] = Counter()
    unknown_refs: Counter[str] = Counter()
    by_topic: Counter[str] = Counter()
    can_answer_counts = Counter()

    for row in rows:
        can_answer_counts[str(bool(row.get("can_answer", True)))] += 1
        for topic in row.get("topics") or []:
            by_topic[str(topic)] += 1
        for ref in row.get("context_fields") or []:
            mapped = prefix_match_path(str(ref))
            if mapped:
                touched[mapped] += 1
            else:
                unknown_refs[str(ref)] += 1

    catalog_paths = set(PATH_TO_SPEC)
    covered = {path for path, count in touched.items() if count > 0}
    missing = sorted(catalog_paths - covered)

    heatmap: dict[str, dict[str, int]] = defaultdict(dict)
    for spec in CATALOG:
        heatmap[spec.topic][spec.path] = touched.get(spec.path, 0)

    return {
        "training_rows": len(rows),
        "catalog_fields": len(catalog_paths),
        "covered_fields": len(covered),
        "coverage_pct": round(100.0 * len(covered) / max(len(catalog_paths), 1), 2),
        "missing_fields": missing,
        "unknown_context_field_refs": dict(unknown_refs.most_common(50)),
        "can_answer_distribution": dict(can_answer_counts),
        "rows_by_topic": dict(by_topic.most_common()),
        "heatmap_by_topic": heatmap,
        "top_field_hits": dict(Counter(touched).most_common(30)),
    }


def _markdown_report(report: dict) -> str:
    lines = [
        "# Help bot training coverage report",
        "",
        f"- Training rows: **{report['training_rows']}**",
        f"- Catalog fields: **{report['catalog_fields']}**",
        f"- Covered fields: **{report['covered_fields']}** ({report['coverage_pct']}%)",
        "",
        "## Rows by topic",
        "",
    ]
    for topic, count in sorted((report.get("rows_by_topic") or {}).items()):
        lines.append(f"- `{topic}`: {count}")
    lines.extend(["", "## Missing catalog fields", ""])
    missing = report.get("missing_fields") or []
    if not missing:
        lines.append("_None  full field coverage._")
    else:
        for path in missing:
            spec = PATH_TO_SPEC.get(path)
            label = spec.label if spec else path
            lines.append(f"- `{path}` ({label})")
    lines.extend(["", "## Top field hits", ""])
    for path, count in (report.get("top_field_hits") or {}).items():
        lines.append(f"- `{path}`: {count}")
    unknown = report.get("unknown_context_field_refs") or {}
    if unknown:
        lines.extend(["", "## Unknown context_field refs (not in catalog)", ""])
        for ref, count in unknown.items():
            lines.append(f"- `{ref}`: {count}")
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--write-catalog",
        type=Path,
        default=TRAINING_DIR / "field_catalog.json",
        help="Write field catalog JSON",
    )
    parser.add_argument(
        "--out-json",
        type=Path,
        default=TRAINING_DIR / "coverage-report.json",
    )
    parser.add_argument(
        "--out-md",
        type=Path,
        default=TRAINING_DIR / "coverage-report.md",
    )
    args = parser.parse_args()

    if args.write_catalog:
        args.write_catalog.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": 1,
            "source": "app/application/support/help_bot_field_catalog.py",
            "field_count": len(CATALOG),
            "fields": catalog_as_json(),
        }
        args.write_catalog.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote catalog ({len(CATALOG)} fields) -> {args.write_catalog}")

    rows = _load_training_rows()
    report = _compute_coverage(rows)
    report["normalized_question_count"] = len({_normalize_question(str(r.get("question") or "")) for r in rows})

    args.out_json.parent.mkdir(parents=True, exist_ok=True)
    args.out_json.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    args.out_md.write_text(_markdown_report(report), encoding="utf-8")
    print(
        f"Coverage: {report['covered_fields']}/{report['catalog_fields']} "
        f"({report['coverage_pct']}%) -> {args.out_json}"
    )


if __name__ == "__main__":
    main()
