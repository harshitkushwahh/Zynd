#!/usr/bin/env bash
# Create/update Support console login users in PostgreSQL (agent + lead).
# Safe on production: uses force=True inside run_dev_support_seed.
#
# Usage (SSH / Bluehost terminal):
#   cd /path/to/Zynd/Backend
#   ./scripts/run_support_seed.sh
#
# Requires Backend/.env with DATABASE_URL and a working Python venv (.venv).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line//[[:space:]]/}" ]] && continue
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      export "$line"
    fi
  done < .env
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set. Configure Backend/.env first."
  exit 1
fi

if [ ! -x ".venv/bin/python" ]; then
  echo "ERROR: Backend/.venv not found. Create venv and install requirements on the server."
  exit 1
fi

# shellcheck source=/dev/null
source .venv/bin/activate

echo "Applying migrations (if any)..."
alembic upgrade head

echo "Seeding Support console users (support_agent, support_lead)..."
python -m app.jobs.run_dev_support_seed

echo ""
echo "Done. Sign in at the Support app with:"
echo "  support@zynd.com       (Support Agent)"
echo "  support.lead@zynd.com  (Support Lead)"
echo "  Password: Zynd@1234  (change after first login in production)"
