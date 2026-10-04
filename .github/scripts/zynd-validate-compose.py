#!/usr/bin/env python3
"""Check the tracked Compose file names the infrastructure services."""

from __future__ import annotations

import sys
from pathlib import Path

import yaml

REQUIRED = {"postgres", "redis", "minio", "clamav"}


def main() -> int:
    path = Path("docker-compose.yml")
    data = yaml.safe_load(path.read_text())
    services = set((data or {}).get("services") or {})
    missing = sorted(REQUIRED - services)
    if missing:
        print("docker-compose.yml is missing services: " + ", ".join(missing))
        return 1
    print("Required Compose services are present.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
