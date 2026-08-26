# Database reset

Wipes the PostgreSQL `public` schema completely, re-applies all Alembic migrations, and seeds development data (same as API startup):

- Dev admin: `admin@zynd.com` / `Zynd@1234`
- RBAC roles and permissions (super_admin assigned to all admin users)
- Security config defaults
- Retention policy schedule

## Usage

From the repo root:

```bash
./scripts/database-reset/run.sh
```

Non-interactive (for automation or when an agent runs it):

```bash
./scripts/database-reset/run.sh --yes
```

Requires `Backend/.env` with `DATABASE_URL` pointing at your local Postgres (default: `postgresql+asyncpg://zynd:zynd@localhost:5432/zynd`).

## Safety

- Refuses to run when `APP_ENV=production` unless you pass `--force` or set `FORCE_DB_RESET=1`.
- Interactive mode asks you to type `yes` before dropping anything.

## What it does

1. `DROP SCHEMA public CASCADE`
2. `CREATE SCHEMA public`
3. `alembic upgrade head` (from `Backend/`)
4. Seed admin + RBAC + security config + retention

Does **not** clear Redis, MinIO, or local document files.
