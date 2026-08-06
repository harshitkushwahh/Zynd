#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

API_HOST="${API_HOST:-0.0.0.0}"
API_PORT="${API_PORT:-8000}"

if [ -f .env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    # Skip comments and blank lines
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line//[[:space:]]/}" ]] && continue
    # Only export valid KEY=VALUE assignments (quote values in .env when they start with +)
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      key="${line%%=*}"
      value="${line#*=}"
      export "${key}=${value}"
    fi
  done < .env
fi

parse_database_target() {
  local url="${DATABASE_URL:-}"
  DB_HOST="${DATABASE_HOST:-localhost}"
  DB_PORT="${DATABASE_PORT:-5432}"
  DB_NAME="${DATABASE_NAME:-zynd}"

  if [[ -n "$url" ]]; then
    if [[ "$url" =~ @([^:/]+):([0-9]+)/([^?]+) ]]; then
      DB_HOST="${BASH_REMATCH[1]}"
      DB_PORT="${BASH_REMATCH[2]}"
      DB_NAME="${BASH_REMATCH[3]}"
    elif [[ "$url" =~ @([^:/]+)/([^?]+) ]]; then
      DB_HOST="${BASH_REMATCH[1]}"
      DB_NAME="${BASH_REMATCH[2]}"
    fi
  fi
}

print_postgres_help() {
  echo ""
  echo "PostgreSQL is not reachable at ${DB_HOST}:${DB_PORT} (database: ${DB_NAME})."
  echo ""
  echo "Checks:"
  echo "  1. DATABASE_URL in Backend/.env (currently targets ${DB_HOST}:${DB_PORT})"
  echo "  2. Start Postgres:  docker compose up -d postgres   (from repo root)"
  echo "  3. Or local brew:   brew services start postgresql@16"
  echo ""
  echo "Listening ports that look like PostgreSQL on this machine:"
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | awk '/:(543[0-9]|5432)/ {print "  " $0}' || true
    if ! lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | grep -qE ':(543[0-9]|5432)'; then
      echo "  (none found — Postgres is probably not running)"
    fi
  else
    echo "  (install lsof to auto-detect ports)"
  fi
  echo ""
  echo "If Postgres runs on a different port, update Backend/.env:"
  echo "  DATABASE_URL=postgresql+asyncpg://zynd:zynd@localhost:<port>/zynd"
  echo "  DATABASE_PORT=<port>"
}

check_database_connection() {
  parse_database_target

  if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: DATABASE_URL is not set."
    echo "Copy Backend/.env.example to Backend/.env and configure PostgreSQL."
    exit 1
  fi

  if command -v pg_isready >/dev/null 2>&1; then
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -q; then
      return 0
    fi
  elif command -v nc >/dev/null 2>&1; then
    if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
      return 0
    fi
  elif command -v python3 >/dev/null 2>&1; then
    if python3 - <<PY
import socket
s = socket.socket()
s.settimeout(2)
try:
    s.connect(("${DB_HOST}", int("${DB_PORT}")))
except OSError:
    raise SystemExit(1)
finally:
    s.close()
PY
    then
      return 0
    fi
  fi

  print_postgres_help
  exit 1
}

ensure_alembic_version_column() {
  if [ ! -x ".venv/bin/python" ]; then
    return 0
  fi
  .venv/bin/python - <<'PY' || true
import asyncio
import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def main() -> None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        return
    engine = create_async_engine(url)
    try:
        async with engine.begin() as conn:
            exists = await conn.scalar(
                text(
                    "SELECT EXISTS ("
                    "SELECT 1 FROM information_schema.tables "
                    "WHERE table_name = 'alembic_version'"
                    ")"
                )
            )
            if not exists:
                return
            await conn.execute(
                text(
                    "ALTER TABLE alembic_version "
                    "ALTER COLUMN version_num TYPE VARCHAR(64)"
                )
            )
    finally:
        await engine.dispose()


asyncio.run(main())
PY
}

run_migrations() {
  echo "Applying database migrations..."
  if ! .venv/bin/alembic upgrade head; then
    echo ""
    echo "Migration failed."
    echo "  Database target: ${DB_HOST}:${DB_PORT}/${DB_NAME}"
    echo "  If the revision id was too long, pull latest and re-run ./run.sh"
    echo "  If schema was partially applied, try: .venv/bin/alembic upgrade head"
    exit 1
  fi
}

PYTHON_BIN=""
for candidate in \
  "${PYTHON:-}" \
  "/opt/homebrew/bin/python3.12" \
  "/usr/local/bin/python3.12" \
  "python3.12" \
  "python3.11" \
  "python3"; do
  if [ -n "$candidate" ] && command -v "$candidate" >/dev/null 2>&1; then
    PYTHON_BIN="$candidate"
    break
  fi
done

if [ ! -x ".venv/bin/uvicorn" ]; then
  if [ -z "$PYTHON_BIN" ]; then
    echo "Python 3.10+ not found. Install with: brew install python@3.12"
    exit 1
  fi

  echo "Creating virtualenv with $("$PYTHON_BIN" --version)..."
  "$PYTHON_BIN" -m venv .venv
  .venv/bin/pip install --upgrade pip
  .venv/bin/pip install -r requirements.txt
fi

if [ -x ".venv/bin/python" ]; then
  VENV_PY_VERSION="$(.venv/bin/python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
  if [ "${VENV_PY_VERSION%%.*}" -lt 3 ] || { [ "${VENV_PY_VERSION%%.*}" -eq 3 ] && [ "${VENV_PY_VERSION#*.}" -lt 10 ]; }; then
    echo "Existing .venv uses Python $VENV_PY_VERSION. Recreate with Python 3.10+:"
    echo "  rm -rf .venv && ./run.sh"
    exit 1
  fi
fi

parse_database_target
echo "Checking database connection (${DB_HOST}:${DB_PORT}/${DB_NAME})..."
check_database_connection
ensure_alembic_version_column
run_migrations

if [ "${ZYND_MF_WORKER_AUTOSTART:-true}" = "true" ]; then
  if pgrep -f "app.jobs.run_mf_transaction_workers" >/dev/null 2>&1; then
    echo "Stopping existing MF transaction workers..."
    pkill -9 -f "app.jobs.run_mf_transaction_workers" 2>/dev/null || true
    for _ in 1 2 3 4 5; do
      pgrep -f "app.jobs.run_mf_transaction_workers" >/dev/null 2>&1 || break
      sleep 1
    done
  fi
  rm -f .mf_transaction_worker.lock
  echo "Starting MF order worker in background..."
  .venv/bin/python -m app.jobs.run_mf_transaction_workers --orders &
fi

if lsof -ti :"${API_PORT}" >/dev/null 2>&1; then
  echo "Stopping existing process on port ${API_PORT}..."
  lsof -ti :"${API_PORT}" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

exec .venv/bin/uvicorn app.main:app --host "${API_HOST}" --port "${API_PORT}" --reload
