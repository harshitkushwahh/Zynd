#!/usr/bin/env python3
"""Check the tracked Compose file names the infrastructure services."""

from __future__ import annotations

import sys
from pathlib import Path

import yaml

REQUIRED = {"postgres", "redis", "minio", "clamav"}
REQUIRED_PROD = {"ollama", "api"}


def _services(*paths: Path) -> set[str]:
    merged: dict = {}
    for path in paths:
        if not path.is_file():
            continue
        data = yaml.safe_load(path.read_text()) or {}
        merged.update(data.get("services") or {})
    return set(merged)


def main() -> int:
    root = Path(".")
    base = root / "docker-compose.yml"
    prod = root / "docker-compose.prod.yml"
    services = _services(base)
    missing = sorted(REQUIRED - services)
    if missing:
        print("docker-compose.yml is missing services: " + ", ".join(missing))
        return 1
    prod_services = _services(base, prod)
    prod_missing = sorted(REQUIRED_PROD - prod_services)
    if prod_missing:
        print(
            "docker-compose.prod.yml (merged) is missing services: "
            + ", ".join(prod_missing)
        )
        return 1
    print("Required Compose services are present (base + production).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
