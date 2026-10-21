#!/usr/bin/env bash
# Push Groq Help Bot vars from local Backend/.env to the Bluehost VPS over SSH.
# Usage (repo root):
#   Backend/scripts/ssh-push-help-bot-env.sh
# Optional: ZYND_SSH_HOST=root@50.6.205.51
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOCAL_ENV="${REPO_ROOT}/Backend/.env"
HOST="${ZYND_SSH_HOST:-root@50.6.205.51}"
REMOTE_ROOT="${ZYND_ROOT:-/opt/zynd}"

if [ ! -f "${LOCAL_ENV}" ]; then
  echo "Missing ${LOCAL_ENV}"
  exit 1
fi

FRAG="$(mktemp)"
trap 'rm -f "${FRAG}"' EXIT

python3 - "${LOCAL_ENV}" "${FRAG}" << 'PY'
import sys
from pathlib import Path

env_path = Path(sys.argv[1])
out_path = Path(sys.argv[2])
keys = (
    "SUPPORT_LLM_PROVIDER",
    "GROQ_API_KEY",
    "GROQ_MODEL",
    "GROQ_BASE_URL",
    "GROQ_TIMEOUT_SECONDS",
)
values: dict[str, str] = {}
for line in env_path.read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, _, v = line.partition("=")
    k = k.strip()
    v = v.strip().strip('"').strip("'")
    if k in keys and v:
        values[k] = v
if not values.get("GROQ_API_KEY"):
    print("GROQ_API_KEY is missing in local Backend/.env", file=sys.stderr)
    sys.exit(1)
values.setdefault("SUPPORT_LLM_PROVIDER", "groq")
values.setdefault("GROQ_MODEL", "openai/gpt-oss-120b")
values.setdefault("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
values.setdefault("GROQ_TIMEOUT_SECONDS", "120")
lines = [f"{k}={values[k]}" for k in keys if k in values]
out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
PY

REMOTE_FRAG="/tmp/zynd-help-bot-env.$$"
echo "Uploading env fragment to ${HOST}..."
scp -o ConnectTimeout=30 "${FRAG}" "${HOST}:${REMOTE_FRAG}"
echo "Applying on server and recreating api..."
ssh -o ConnectTimeout=30 "${HOST}" "bash ${REMOTE_ROOT}/Backend/scripts/sync-help-bot-groq-env-on-vps.sh ${REMOTE_FRAG}"
