#!/usr/bin/env python3
"""Generate batch-062.jsonl — 100 Hinglish referral count / program questions."""

from __future__ import annotations

import json
import random
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/help-bot-training/batch-062.jsonl"

random.seed(62062)

TEMPLATES: list[tuple[str, list[str], str]] = [
    ("acha mere kitne referral hai", ["referrals.signup_count", "referrals.kyc_verified_count"], "Quote signup_count and kyc/investment counts from referrals context."),
    ("mera kitne referral signup hue", ["referrals.signup_count"], "Summarise referrals.signup_count in plain language."),
    ("kitne logon ne mere link se join kiya", ["referrals.signup_count"], "Use referrals.signup_count only."),
    ("how many referrals do i have on zynd", ["referrals.signup_count"], "Answer with referrals.signup_count from context."),
    ("referral count batao please", ["referrals.signup_count"], "Quote referrals.signup_count directly."),
    ("mere referal kitne hai", ["referrals.signup_count"], "Handle referal typo; use signup_count."),
    ("total referral signups kya hai", ["referrals.signup_count"], "Use referrals.signup_count."),
    ("friends joined through my code kitne", ["referrals.signup_count"], "signup_count from referrals slice."),
    ("refer and earn me kitne signups", ["referrals.signup_count"], "Referrals dashboard + signup_count."),
    ("zynd pe mere kitne referral complete hue", ["referrals.kyc_verified_count"], "Use kyc_verified_count."),
    ("kitne referrals ne kyc kar liya", ["referrals.kyc_verified_count"], "Quote kyc_verified_count."),
    ("referral wale me se kitne invested", ["referrals.first_investment_count"], "Use first_investment_count."),
    ("meri referral link pe kitne clicks", ["referrals.click_count"], "Quote click_count."),
    ("kya mera referral code active hai", ["referrals.has_code"], "Answer from referrals.has_code."),
    ("mera invite code hai ya nahi", ["referrals.has_code"], "Use has_code boolean from context."),
]

SUFFIXES = (
    "",
    " please",
    " yaar",
    " jaldi batao",
    " dashboard se dekh raha tha",
    " help chat se puch raha hu",
    " ?",
    " thnx",
)

FIELDS_EXTRA = [
    ["referrals.signup_count", "referrals.kyc_verified_count", "referrals.first_investment_count"],
    ["referrals.signup_count", "referrals.click_count"],
    ["referrals.has_code", "referrals.signup_count"],
]


def main() -> None:
    rows: list[dict] = []
    seen: set[str] = set()
    idx = 0
    attempts = 0
    variant = 0
    while len(rows) < 100:
        attempts += 1
        if attempts > 5000:
            raise SystemExit("Could not generate 100 unique referral rows")
        tpl, fields, solution = random.choice(TEMPLATES)
        suffix = random.choice(SUFFIXES)
        q = (tpl + suffix).strip()
        if attempts % 11 == 0:
            variant += 1
            q = f"{q} (v{variant})"
        norm = re.sub(r"\s+", " ", q.lower())
        if norm in seen:
            continue
        seen.add(norm)
        idx += 1
        if random.random() < 0.25:
            fields = random.choice(FIELDS_EXTRA)
        rows.append(
            {
                "id": f"b062-ref-{62000 + idx}",
                "batch": 62,
                "topics": ["referrals"],
                "question": q,
                "paraphrases": [],
                "in_scope": True,
                "needs_human": False,
                "can_answer": True,
                "context_fields": fields,
                "solution": solution,
                "escalate_if_missing": "Referrals slice missing; guide to Dashboard → Referrals without inventing counts.",
            }
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"Wrote {len(rows)} lines to {OUT}")


if __name__ == "__main__":
    main()
