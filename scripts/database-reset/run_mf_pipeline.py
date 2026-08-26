#!/usr/bin/env python3
"""Run the full MF ingestion pipeline after a fresh DB reset + seed."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
BACKEND_ROOT = REPO_ROOT / "Backend"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv

load_dotenv(BACKEND_ROOT / ".env")

from app.application.mf.mf_pipeline_orchestrator_service import run_mf_pipeline_sync  # noqa: E402


async def main() -> None:
    await run_mf_pipeline_sync(mode="full", triggered_by="BOOTSTRAP")


if __name__ == "__main__":
    asyncio.run(main())
