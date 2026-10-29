#!/usr/bin/env python3
"""Run Help Bot policy regression (no LLM)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.application.support.help_bot_policy_eval import (  # noqa: E402
    _DEFAULT_PATH,
    run_policy_regression,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Help Bot policy regression eval")
    parser.add_argument(
        "--file",
        type=Path,
        default=_DEFAULT_PATH,
        help="Path to policy-regression.jsonl",
    )
    args = parser.parse_args()
    passed, total, results = run_policy_regression(args.file)
    for row in results:
        status = "PASS" if row.ok else "FAIL"
        print(f"{status} {row.case_id}: {row.detail}")
    print(f"policy_regression: {passed}/{total} passed")
    if passed != total:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
