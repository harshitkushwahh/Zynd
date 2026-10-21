#!/usr/bin/env python3
"""Fail when API routers import Cybrilla/Finprim infrastructure clients directly."""

from __future__ import annotations

import re
import sys
from pathlib import Path

FORBIDDEN = re.compile(
    r"from app\.infrastructure\.(?:kyc\.fp_clients|mf\.fp_)"
)

ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "Backend" / "app" / "api"


def main() -> int:
    violations: list[str] = []
    for path in sorted(API_ROOT.rglob("*.py")):
        text = path.read_text(encoding="utf-8")
        for line_no, line in enumerate(text.splitlines(), start=1):
            if FORBIDDEN.search(line):
                rel = path.relative_to(ROOT)
                violations.append(f"{rel}:{line_no}: {line.strip()}")
    if violations:
        print("API layer must not import Finprim/Cybrilla infrastructure clients directly:")
        for item in violations:
            print(f"  {item}")
        print("Use app.application.core.facade or an application service instead.")
        print("(Do not import app.infrastructure.core or legacy cybrilla paths from API routers.)")
        return 1
    print("API Cybrilla import guard passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
