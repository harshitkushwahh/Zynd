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


async def _wipe_mongo_mf() -> None:
    settings = get_settings()
    mongo_url = settings.resolved_mongo_url
    if not mongo_url:
        print("MongoDB not configured — skipping MF raw/staging wipe.")
        return

    try:
        from motor.motor_asyncio import AsyncIOMotorClient
    except ImportError as exc:
        raise RuntimeError("motor is required to wipe Mongo MF collections") from exc

    db_name = settings.mongo_mf_raw_db
    collections = ("scheme_ingest_batches", "scheme_staging_rows", "raw_ingestions")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    for name in collections:
        await db.drop_collection(name)
        print(f"  Dropped Mongo {db_name}.{name}", flush=True)
    client.close()
    print(f"Mongo MF staging/raw collections wiped in {db_name}.", flush=True)


async def _drop_public_schema(database_url: str) -> None:
    role = _database_role(database_url)
    engine = create_async_engine(database_url, pool_pre_ping=True)
    try:
        async with engine.begin() as conn:
            await conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
            await conn.execute(text("CREATE SCHEMA public"))
            await conn.execute(text(f'GRANT ALL ON SCHEMA public TO "{role}"'))
            await conn.execute(text("GRANT ALL ON SCHEMA public TO public"))
            # Enum types can survive a schema drop in some Postgres setups; clear leftovers.
            await conn.execute(
                text(
                    """
                    DO $$
                    DECLARE
                        enum_row RECORD;
                    BEGIN
                        FOR enum_row IN
                            SELECT t.typname
                            FROM pg_type t
                            JOIN pg_namespace n ON n.oid = t.typnamespace
                            WHERE n.nspname = 'public'
                              AND t.typtype = 'e'
                        LOOP
                            EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE', enum_row.typname);
                        END LOOP;
                    END $$;
                    """
                )
            )
    finally:
        await engine.dispose()


def _ensure_alembic_version_column() -> None:
    python_bin = os.environ.get("PYTHON", sys.executable)
    venv_python = BACKEND_ROOT / ".venv" / "bin" / "python"
    if venv_python.is_file():
        python_bin = str(venv_python)

    subprocess.run(
        [
            python_bin,
            "-c",
            """
import asyncio, os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    url = os.environ.get("DATABASE_URL")
    if not url:
        return
    engine = create_async_engine(url)
    try:
        async with engine.begin() as conn:
            exists = await conn.scalar(text(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alembic_version')"
            ))
            if not exists:
                return
            await conn.execute(text(
                "ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(64)"
            ))
    finally:
        await engine.dispose()

asyncio.run(main())
""",
        ],
        cwd=BACKEND_ROOT,
        check=False,
    )


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
        await ensure_rbac_seed(session)
        await ensure_dev_admin_seed(session, settings=dev_settings)
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

    print(f"Dropping public schema on {masked_url} ...", flush=True)
    await _drop_public_schema(settings.database_url)
    print("Schema dropped.", flush=True)

    print("Wiping Mongo MF staging and raw archive collections ...", flush=True)
    await _wipe_mongo_mf()

    print("Running Alembic migrations ...", flush=True)
    _ensure_alembic_version_column()
    _run_migrations()
    print("Migrations complete.")

    print("Seeding dev admin, RBAC, security config, and retention policies ...")
    await _seed_database()
    print("Seed complete.")
    print()
    print("Dev admin account:")
    print(f"  email:    {DEV_ADMIN_EMAIL}")
    print(f"  password: {DEV_ADMIN_PASSWORD}")
    print()
    print("Restart the backend before logging in:")
    print("  1. Stop any running Backend/run.sh or uvicorn process")
    print("  2. Run: ./Backend/run.sh")
    print("  3. Sign out in Admin and log in again as admin@zynd.com")


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
