#!/usr/bin/env python3
"""Post-deploy check: Groq config + on-disk help-bot training corpus for retrieval."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "help-bot-training" / "manifest.json"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.application.support.ollama_client import check_llm_ready  # noqa: E402
from app.application.support.training_loader import (  # noqa: E402
    training_corpus_stats,
    warm_training_corpus,
)
from app.core.config import get_settings  # noqa: E402


def _expected_min_rows() -> int:
    if not MANIFEST.is_file():
        return 1
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    target = int(manifest.get("cumulative_count") or manifest.get("target_total") or 0)
    if target <= 0:
        return 1
    # Allow small drift if a batch is mid-rollout; CI gates enforce full corpus in git.
    return max(1, int(target * 0.95))


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--require-llm",
        action="store_true",
        help="Fail if Groq/Ollama probe fails (default: corpus-only check for deploy)",
    )
    args = parser.parse_args()

    settings = get_settings()
    warm_training_corpus()
    stats = training_corpus_stats()
    rows = int(stats["training_rows"])
    min_rows = _expected_min_rows()

    errors: list[str] = []
    if rows < min_rows:
        errors.append(
            f"Training corpus too small: {rows} rows loaded, expected at least {min_rows}. "
            "Ensure data/help-bot-training/batch-*.jsonl is in the Backend image."
        )
    if not stats["retrieval_ready"]:
        errors.append("Retrieval corpus is empty.")

    provider = settings.support_llm_provider
    if provider == "groq" and not settings.groq_api_key.strip():
        errors.append("SUPPORT_LLM_PROVIDER=groq but GROQ_API_KEY is empty.")

    llm_ok, model = asyncio.run(check_llm_ready())
    if not llm_ok and args.require_llm:
        errors.append(f"LLM probe failed (provider={provider}, model={model}).")
    elif not llm_ok:
        print(
            f"WARN: LLM probe failed (provider={provider}, model={model}); corpus check still passed.",
            file=sys.stderr,
        )

    print(
        json.dumps(
            {
                "provider": provider,
                "model": model,
                "llm_ready": llm_ok,
                "training_rows": rows,
                "batch_files": stats["batch_files"],
                "min_rows_required": min_rows,
                "retrieval_ready": stats["retrieval_ready"],
            },
            indent=2,
        )
    )

    if errors:
        for msg in errors:
            print(f"ERROR: {msg}", file=sys.stderr)
        raise SystemExit(1)

    print("help_bot_production ok")


if __name__ == "__main__":
    main()
