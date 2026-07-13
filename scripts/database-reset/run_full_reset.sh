#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BACKEND_ROOT="${REPO_ROOT}/Backend"
PYTHON="${BACKEND_ROOT}/.venv/bin/python"

export PYTHONUNBUFFERED=1

echo "=== 1/3 Reset PostgreSQL + Mongo, migrate, seed ==="
"${SCRIPT_DIR}/run.sh" --yes

echo ""
echo "=== 2/3 MF staging + scheduler pipeline ==="
echo "(Cybrilla ingest + NAV cold-start can take 30-90+ minutes; progress prints below.)"
"${PYTHON}" "${SCRIPT_DIR}/run_mf_pipeline.py"

echo ""
echo "=== Done ==="
