#!/usr/bin/env bash
# Push KYC DigiLocker env to Bluehost VPS (production URLs + optional live OAuth from local Backend/.env).
# Usage (repo root):
#   Backend/scripts/ssh-push-kyc-digilocker-env.sh
# Optional: ZYND_SSH_HOST=root@50.6.205.51  RECREATE_API=false
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOCAL_ENV="${REPO_ROOT}/Backend/.env"
SERVER_FRAGMENT="${REPO_ROOT}/Backend/env/server-kyc-digilocker.env"
HOST="${ZYND_SSH_HOST:-root@50.6.205.51}"
REMOTE_ROOT="${ZYND_ROOT:-/opt/zynd}"

if [ ! -f "${SERVER_FRAGMENT}" ]; then
  echo "Missing ${SERVER_FRAGMENT}"
  exit 1
fi

FRAG="$(mktemp)"
trap 'rm -f "${FRAG}"' EXIT

{
  cat "${SERVER_FRAGMENT}"
  if [ -f "${LOCAL_ENV}" ]; then
    python3 - "${LOCAL_ENV}" << 'PY'
import sys
from pathlib import Path

env_path = Path(sys.argv[1])
keys = (
    "DIGILOCKER_FP_CLIENT_ID_LIVE",
    "DIGILOCKER_FP_CLIENT_SECRET_LIVE",
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
for k in keys:
    if k in values:
        print(f"{k}={values[k]}")
PY
  fi
} > "${FRAG}"

REMOTE_FRAG="/tmp/zynd-kyc-digilocker-env.$$"
echo "Uploading KYC env fragment to ${HOST}..."
scp -o ConnectTimeout=30 "${FRAG}" "${HOST}:${REMOTE_FRAG}"
echo "Applying on server..."
ssh -o ConnectTimeout=30 "${HOST}" "RECREATE_API=${RECREATE_API:-true} bash ${REMOTE_ROOT}/Backend/scripts/sync-kyc-digilocker-env-on-vps.sh ${REMOTE_FRAG}"
