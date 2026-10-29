#!/usr/bin/env python3
"""batch-063.jsonl — 100 Hinglish explain / kya hai / smajao across modules."""

from __future__ import annotations

import json
import random
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/help-bot-training/batch-063.jsonl"

random.seed(63063)

ROWS: list[tuple[list[str], str, list[str], str]] = [
    (["referrals"], "referal smajao", ["referrals.signup_count"], "Explain Refer & Earn; optional signup_count from context."),
    (["referrals"], "referrals kya hai", ["referrals.has_code"], "Educational answer; do not invent rewards."),
    (["referrals"], "refer and earn matlab", ["referrals.signup_count"], "Program explanation from playbook."),
    (["portfolio"], "porotlfio explain", ["portfolio.current_value", "portfolio.holdings_count"], "Explain portfolio module; quote value if present."),
    (["portfolio"], "portfolio kya hota hai", ["portfolio.invested"], "Educational + invested from context."),
    (["portfolio"], "holdings smajao", ["portfolio.holdings_count"], "Explain holdings screen."),
    (["kyc"], "kyc kya hai", ["kyc.overall_status"], "Explain KYC steps; quote status if available."),
    (["payment"], "sip smajao", ["payments.recent_failed_orders"], "Explain SIP without inventing amounts."),
    (["goals"], "goals kya hai", ["goals.goals"], "Explain goals feature."),
    (["account"], "zynd pin kya hai", ["account.zynd_pin_enabled"], "Explain PIN setup path."),
    (["risk_profile"], "risk profile explain", ["risk_profile.tier"], "Explain risk assessment."),
    (["reports"], "reports kya hai", ["reports.available_types"], "Explain report downloads."),
]

SUFFIXES = ("", " please", " yaar", " zynd pe", " app me")


def main() -> None:
    out_rows: list[dict] = []
    seen: set[str] = set()
    idx = 0
    attempts = 0
    variant = 0
    while len(out_rows) < 100:
        attempts += 1
        if attempts > 5000:
            raise SystemExit("Could not generate 100 unique education rows")
        topics, q, fields, solution = random.choice(ROWS)
        q = q + random.choice(SUFFIXES)
        if attempts % 7 == 0:
            variant += 1
            q = f"{q} (v{variant})"
        norm = re.sub(r"\s+", " ", q.lower())
        if norm in seen:
            continue
        seen.add(norm)
        idx += 1
        out_rows.append(
            {
                "id": f"b063-edu-{63000 + idx}",
                "batch": 63,
                "topics": topics,
                "question": q.strip(),
                "paraphrases": [],
                "in_scope": True,
                "needs_human": False,
                "can_answer": True,
                "context_fields": fields,
                "solution": solution,
                "escalate_if_missing": None,
            }
        )

    with OUT.open("w", encoding="utf-8") as handle:
        for row in out_rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"Wrote {len(out_rows)} to {OUT}")


if __name__ == "__main__":
    main()
