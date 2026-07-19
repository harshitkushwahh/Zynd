#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PYTHON="${REPO_ROOT}/Backend/.venv/bin/python"

export PYTHONUNBUFFERED=1

exec "${PYTHON}" "${SCRIPT_DIR}/run_mf_bootstrap_resume.py" "$@"
