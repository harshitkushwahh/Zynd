#!/usr/bin/env python3
"""Export training batches to Ollama-style chat JSONL for fine-tuning."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRAINING_DIR = ROOT / "data" / "help-bot-training"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.application.support.playbooks_loader import playbooks_for  # noqa: E402
from app.application.support.synthetic_context_factory import (  # noqa: E402
    build_synthetic_context_pack,
    materialize_grounded_answer,
)

SYSTEM_PROMPT = """You are Zynd Help Bot, the first-line assistant inside the Zynd app.
Answer only from the product playbook and the customer context in the user message.
Never use outside knowledge. Never invent amounts, statuses, dates, order ids, or account facts.
If the context does not contain the fact the customer needs, set can_answer to false.
Respond with JSON only: {"can_answer": true or false, "answer": "short reply"}.
When can_answer is true, the answer is shown to the customer. Write in clear, friendly language.
When can_answer is false, the answer is an internal reason, one sentence, with no invented facts.
"""

LEGACY_SYSTEM = (
    "You are Zynd Help Bot. Answer from customer context and playbook only. "
    'Return JSON: {"can_answer": true|false, "answer": "..."}.'
)


def _parse_batches(raw: str) -> set[int] | None:
    cleaned = raw.strip().lower()
    if cleaned in {"all", "*"}:
        return None
    return {int(part.strip()) for part in raw.split(",") if part.strip()}


def _iter_training_rows(
    *,
    batch_filter: set[int] | None,
    include_paraphrases: bool,
) -> list[tuple[dict, str]]:
    """Return (row, question_text) pairs."""
    pairs: list[tuple[dict, str]] = []
    for path in sorted(TRAINING_DIR.glob("batch-*.jsonl")):
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                row = json.loads(line)
                batch_num = int(row.get("batch", 0))
                if batch_filter is not None and batch_num not in batch_filter:
                    continue
                question = str(row.get("question") or "").strip()
                if question:
                    pairs.append((row, question))
                if include_paraphrases:
                    for para in row.get("paraphrases") or []:
                        p = str(para).strip()
                        if p:
                            pairs.append((row, p))
    return pairs


def _build_user_prompt(*, row: dict, question: str, pack: dict[str, object], legacy: bool) -> str:
    if legacy:
        return (
            f"Topics: {','.join(row.get('topics') or [])}\n"
            f"Context fields: {','.join(row.get('context_fields') or [])}\n"
            f"Customer question: {question}"
        )
    playbook = playbooks_for(row.get("topics") or [])
    context_json = json.dumps(pack, ensure_ascii=False, default=str)
    if len(context_json) > 3500:
        context_json = context_json[:3500] + "…"
    return (
        f"Playbook:\n{playbook}\n\n"
        f"Customer context:\n{context_json}\n\n"
        f"Latest question:\n{question}"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--batches",
        type=str,
        default="all",
        help='Comma-separated batch numbers, or "all"',
    )
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--salt", type=int, default=0, help="Salt mixed into per-row synthetic context seed")
    parser.add_argument(
        "--legacy",
        action="store_true",
        help="Export Phase 1 format (field names only, template solutions)",
    )
    parser.add_argument(
        "--include-paraphrases",
        action="store_true",
        help="Emit extra training rows for each paraphrase",
    )
    parser.add_argument("--max-rows", type=int, default=0, help="Cap rows exported (0 = no cap)")
    args = parser.parse_args()

    batch_filter = _parse_batches(args.batches)
    pairs = _iter_training_rows(
        batch_filter=batch_filter,
        include_paraphrases=args.include_paraphrases,
    )
    if args.max_rows > 0:
        pairs = pairs[: args.max_rows]

    lines_out: list[str] = []
    system = LEGACY_SYSTEM if args.legacy else SYSTEM_PROMPT

    for row, question in pairs:
        row_id = str(row.get("id") or question)
        topics = list(row.get("topics") or [])
        context_fields = list(row.get("context_fields") or [])
        can_answer_flag = bool(row.get("can_answer", True))
        pack = build_synthetic_context_pack(
            topics,
            row_id=row_id,
            salt=args.salt,
            context_fields=context_fields,
            can_answer=can_answer_flag,
        )

        if args.legacy:
            assistant_can = can_answer_flag
            assistant_text = str(row.get("solution") or "")
        else:
            assistant_can, assistant_text = materialize_grounded_answer(
                question=question,
                solution=str(row.get("solution") or ""),
                context_fields=context_fields,
                pack=pack,
                can_answer=can_answer_flag,
            )

        user = _build_user_prompt(row=row, question=question, pack=pack, legacy=args.legacy)
        assistant = json.dumps(
            {"can_answer": assistant_can, "answer": assistant_text},
            ensure_ascii=False,
        )
        record = {
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
                {"role": "assistant", "content": assistant},
            ],
            "meta": {
                "id": row_id,
                "batch": row.get("batch"),
                "topics": topics,
            },
        }
        lines_out.append(json.dumps(record, ensure_ascii=False))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text("\n".join(lines_out) + ("\n" if lines_out else ""), encoding="utf-8")
    mode = "legacy" if args.legacy else "context-rich (Phase 2)"
    print(f"Wrote {len(lines_out)} fine-tune rows ({mode}) to {args.out}")


if __name__ == "__main__":
    main()
