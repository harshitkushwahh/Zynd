#!/usr/bin/env python3
"""Drop the PostgreSQL public schema, re-run Alembic, and seed dev data."""

from __future__ import annotations

import argparse
import asyncio
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
BACKEND_ROOT = REPO_ROOT / "Backend"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

load_dotenv(BACKEND_ROOT / ".env")

from app.application.admin.dev_admin_seed_service import (  # noqa: E402
    DEV_ADMIN_EMAIL,
    DEV_ADMIN_PASSWORD,
    ensure_dev_admin_seed,
)
from app.application.admin.rbac_service import ensure_rbac_seed  # noqa: E402
from app.application.compliance.retention_service import ensure_retention_seed  # noqa: E402
from app.application.security.security_config_service import ensure_security_config_seed  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.core.database import AsyncSessionLocal  # noqa: E402


def _mask_database_url(url: str) -> str:
    parsed = urlparse(url.replace("+asyncpg", ""))
    host = parsed.hostname or "localhost"
    port = f":{parsed.port}" if parsed.port else ""
    user = parsed.username or ""
    database = (parsed.path or "/").lstrip("/")
    return f"postgresql://{user}:***@{host}{port}/{database}"


def _database_role(url: str) -> str:
    parsed = urlparse(url.replace("+asyncpg", ""))
    return parsed.username or "zynd"


def _confirm_proceed(masked_url: str, *, assume_yes: bool) -> None:
    if assume_yes:
        return
    print()
    print("WARNING: This will DROP the entire public schema (all tables, enums, and data).")
    print(f"Database: {masked_url}")
    print()
    answer = input("Type 'yes' to continue: ").strip().lower()
    if answer != "yes":
        print("Aborted.")
        raise SystemExit(1)


def _guard_environment(*, force: bool) -> None:
    settings = get_settings()
    if settings.app_env == "production" and not force:
        print(
            "Refusing to reset a production database. "
            "Set FORCE_DB_RESET=1 or pass --force to override."
        )
        raise SystemExit(1)


async def _drop_public_schema(database_url: str) -> None:
    role = _database_role(database_url)
    engine = create_async_engine(database_url, pool_pre_ping=True)
    try:
        async with engine.begin() as conn:
            await conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
            await conn.execute(text("CREATE SCHEMA public"))
            await conn.execute(text(f'GRANT ALL ON SCHEMA public TO "{role}"'))
            await conn.execute(text("GRANT ALL ON SCHEMA public TO public"))
    finally:
        await engine.dispose()


def _run_migrations() -> None:
    python_bin = os.environ.get("PYTHON", sys.executable)
    venv_python = BACKEND_ROOT / ".venv" / "bin" / "python"
    if venv_python.is_file():
        python_bin = str(venv_python)

    subprocess.run(
        [python_bin, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_ROOT,
        check=True,
    )


async def _seed_database() -> None:
    settings = get_settings()
    dev_settings = settings.model_copy(update={"app_env": "development"})
    get_settings.cache_clear()

    async with AsyncSessionLocal() as session:
        await ensure_dev_admin_seed(session, settings=dev_settings)
        await ensure_rbac_seed(session)
        await ensure_security_config_seed(session)
        await ensure_retention_seed(session)
        await session.commit()

    get_settings.cache_clear()


async def _run(*, assume_yes: bool, force: bool) -> None:
    get_settings.cache_clear()
    settings = get_settings()
    masked_url = _mask_database_url(settings.database_url)

    _guard_environment(force=force)
    _confirm_proceed(masked_url, assume_yes=assume_yes)

    print(f"Dropping public schema on {masked_url} ...")
    await _drop_public_schema(settings.database_url)
    print("Schema dropped.")

    print("Running Alembic migrations ...")
    _run_migrations()
    print("Migrations complete.")

    print("Seeding dev admin, RBAC, security config, and retention policies ...")
    await _seed_database()
    print("Seed complete.")
    print()
    print("Dev admin account:")
    print(f"  email:    {DEV_ADMIN_EMAIL}")
    print(f"  password: {DEV_ADMIN_PASSWORD}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Drop PostgreSQL schema, migrate from scratch, and seed development data.",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip interactive confirmation.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Allow running when APP_ENV=production (also respects FORCE_DB_RESET=1).",
    )
    args = parser.parse_args()
    force = args.force or os.environ.get("FORCE_DB_RESET", "").strip() in {"1", "true", "yes"}
    asyncio.run(_run(assume_yes=args.yes, force=force))


if __name__ == "__main__":
    main()
