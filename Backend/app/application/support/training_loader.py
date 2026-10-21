"""Load gold help-bot Q&A from JSONL batches for retrieval (pre–fine-tune)."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

_TRAINING_DIR = Path(__file__).resolve().parents[3] / "data" / "help-bot-training"
_TOKEN = re.compile(r"[a-z0-9]+", re.I)


@lru_cache(maxsize=1)
def _load_corpus() -> tuple[dict[str, str], ...]:
    rows: list[dict[str, str]] = []
    if not _TRAINING_DIR.is_dir():
        return tuple()
    for path in sorted(_TRAINING_DIR.glob("batch-*.jsonl")):
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                payload = json.loads(line)
                question = str(payload.get("question") or "").strip()
                solution = str(payload.get("solution") or "").strip()
                if not question or not solution:
                    continue
                topics = payload.get("topics") or []
                topic = topics[0] if topics else "other"
                base = {
                    "question": question,
                    "answer": solution,
                    "topic": str(topic),
                    "topics": ",".join(str(t) for t in topics),
                    "id": str(payload.get("id") or ""),
                }
                rows.append(base)
                for para in payload.get("paraphrases") or []:
                    p = str(para).strip()
                    if p:
                        rows.append({**base, "question": p})
    return tuple(rows)


def warm_training_corpus() -> int:
    """Load JSONL gold corpus into process memory (idempotent). Returns row count."""
    return len(_load_corpus())


def training_corpus_stats() -> dict[str, int | bool]:
    """Lightweight health snapshot for ops / help-bot status."""
    rows = _load_corpus()
    batch_files = 0
    if _TRAINING_DIR.is_dir():
        batch_files = len(list(_TRAINING_DIR.glob("batch-*.jsonl")))
    return {
        "training_rows": len(rows),
        "batch_files": batch_files,
        "retrieval_ready": len(rows) > 0,
    }


def _tokens(text: str) -> set[str]:
    return set(_TOKEN.findall(text.lower()))


def similar_training_examples(
    question: str,
    topics: tuple[str, ...] | list[str],
    *,
    limit: int = 3,
) -> list[dict[str, str]]:
    """Rank local JSONL gold answers for few-shot prompting."""
    cleaned = " ".join(question.split())
    if len(cleaned) < 3 or limit <= 0:
        return []

    corpus = _load_corpus()
    if not corpus:
        return []

    q_tokens = _tokens(cleaned)
    topic_set = set(topics)

    scored: list[tuple[float, dict[str, str]]] = []
    for row in corpus:
        row_topics = set(row["topics"].split(",")) if row["topics"] else set()
        overlap = len(q_tokens & _tokens(row["question"]))
        if overlap == 0 and not (topic_set & row_topics):
            continue
        score = float(overlap)
        if topic_set & row_topics:
            score += 2.0
        if row["topic"] in topic_set:
            score += 1.0
        scored.append((score, row))

    scored.sort(key=lambda item: item[0], reverse=True)
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for _score, row in scored:
        key = row["id"] or row["question"]
        if key in seen:
            continue
        seen.add(key)
        out.append({"question": row["question"], "answer": row["answer"]})
        if len(out) >= limit:
            break
    return out
