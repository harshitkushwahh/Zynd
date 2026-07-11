#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BACKEND_ROOT="${REPO_ROOT}/Backend"

if [ -f "${BACKEND_ROOT}/.env" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line//[[:space:]]/}" ]] && continue
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      export "$line"
    fi
  done < "${BACKEND_ROOT}/.env"
fi

PYTHON_BIN=""
for candidate in \
  "${PYTHON:-}" \
  "${BACKEND_ROOT}/.venv/bin/python" \
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

if [ -z "$PYTHON_BIN" ]; then
  echo "Python 3.10+ not found."
  exit 1
fi

if [ ! -x "${BACKEND_ROOT}/.venv/bin/python" ]; then
  echo "Backend virtualenv not found. Run ${BACKEND_ROOT}/run.sh once to create it."
  exit 1
fi

exec "${BACKEND_ROOT}/.venv/bin/python" "${SCRIPT_DIR}/reset_and_seed.py" "$@"
