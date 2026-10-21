#!/usr/bin/env bash
# Upsert Help Bot Groq settings in /opt/zynd/Backend/.env (run on the VPS as root).
# Local one-liner (from repo root, when SSH works):
#   Backend/scripts/ssh-push-help-bot-env.sh
set -euo pipefail

ROOT="${ZYND_ROOT:-/opt/zynd}"
ENV_FILE="${ROOT}/Backend/.env"
FRAGMENT="${1:-}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root on the VPS."
  exit 1
fi

if [ ! -f "${ENV_FILE}" ]; then
  echo "Missing ${ENV_FILE}"
  exit 1
fi

upsert() {
  local key="$1"
  local value="$2"
  python3 - "${ENV_FILE}" "${key}" "${value}" << 'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
key = sys.argv[2]
value = sys.argv[3]
lines = path.read_text(encoding="utf-8").splitlines() if path.is_file() else []
out: list[str] = []
replaced = False
prefix = key + "="
for line in lines:
    if line.startswith(prefix):
        if not replaced:
            out.append(f"{key}={value}")
            replaced = True
    else:
        out.append(line)
if not replaced:
    out.append(f"{key}={value}")
path.write_text("\n".join(out) + ("\n" if out else ""), encoding="utf-8")
PY
}

# Optional fragment file: KEY=VALUE lines (no export). Used by ssh-push helper.
if [ -n "${FRAGMENT}" ] && [ -f "${FRAGMENT}" ]; then
  while IFS= read -r line || [ -n "${line}" ]; do
    line="${line%%#*}"
    line="$(echo "${line}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    [ -z "${line}" ] && continue
    key="${line%%=*}"
    value="${line#*=}"
    [ -z "${key}" ] && continue
    upsert "${key}" "${value}"
  done < "${FRAGMENT}"
  rm -f "${FRAGMENT}"
fi

# Defaults when fragment omitted or keys still missing
default_upsert() {
  local key="$1"
  local value="$2"
  if ! grep -qE "^${key}=" "${ENV_FILE}"; then
    upsert "${key}" "${value}"
  fi
}

default_upsert SUPPORT_LLM_PROVIDER groq
default_upsert GROQ_MODEL "openai/gpt-oss-120b"
default_upsert GROQ_BASE_URL "https://api.groq.com/openai/v1"
default_upsert GROQ_TIMEOUT_SECONDS "120"

# Remove stale Ollama-only production lines if present
sed -i '/^SUPPORT_LLM_PROVIDER=ollama$/d' "${ENV_FILE}" 2>/dev/null || true

chown root:root "${ENV_FILE}"
chmod 600 "${ENV_FILE}"

echo "Help Bot env updated in ${ENV_FILE}"
echo "Keys set (values hidden):"
grep -E '^(SUPPORT_LLM_PROVIDER|GROQ_MODEL|GROQ_BASE_URL|GROQ_TIMEOUT_SECONDS|GROQ_API_KEY)=' "${ENV_FILE}" \
  | sed 's/=.*$/=***/' || true

if ! grep -qE '^GROQ_API_KEY=.+$' "${ENV_FILE}"; then
  echo "ERROR: GROQ_API_KEY is still empty. Pass it via ssh-push-help-bot-env.sh from your local Backend/.env."
  exit 1
fi

if [ -d "${ROOT}" ] && [ -f "${ROOT}/docker-compose.prod.yml" ]; then
  cd "${ROOT}"
  echo "Recreating api container to load .env..."
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps --force-recreate api
  echo "Running help-bot verify..."
  docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T api python scripts/verify_help_bot_production.py || true
fi

echo "Done."
