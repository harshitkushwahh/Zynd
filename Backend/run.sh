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
    # Only export valid KEY=VALUE assignments
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      export "$line"
    fi
  done < .env
fi

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

echo "Applying database migrations..."
.venv/bin/alembic upgrade head

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
