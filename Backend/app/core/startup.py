from __future__ import annotations

import logging
import subprocess
import sys
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings

logger = logging.getLogger(__name__)
_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent


def run_dev_migrations(settings: Settings) -> None:
    if settings.app_env != "development":
        return

    logger.info("Applying pending Alembic migrations (development startup)...")
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=_BACKEND_ROOT,
        check=True,
    )


async def refresh_database_pool() -> None:
    from app.core.database import engine

    await engine.dispose()


async def distributor_branches_table_exists(db: AsyncSession) -> bool:
    result = await db.execute(text("SELECT to_regclass('public.distributor_branches') IS NOT NULL"))
    return bool(result.scalar_one())
