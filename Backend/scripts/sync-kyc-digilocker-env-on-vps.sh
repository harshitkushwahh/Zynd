#!/usr/bin/env bash
# Upsert POA / DigiLocker KYC settings in /opt/zynd/Backend/.env (run on the VPS as root).
# Local (repo root, when SSH works):
#   Backend/scripts/ssh-push-kyc-digilocker-env.sh
set -euo pipefail

ROOT="${ZYND_ROOT:-/opt/zynd}"
ENV_FILE="${ROOT}/Backend/.env"
FRAGMENT="${1:-}"
DEFAULT_FRAGMENT="${ROOT}/Backend/env/server-kyc-digilocker.env"
RECREATE_API="${RECREATE_API:-true}"

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

apply_fragment() {
  local file="$1"
  [ -f "${file}" ] || return 0
  while IFS= read -r line || [ -n "${line}" ]; do
    line="${line%%#*}"
    line="$(echo "${line}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    [ -z "${line}" ] && continue
    key="${line%%=*}"
    value="${line#*=}"
    [ -z "${key}" ] && continue
    upsert "${key}" "${value}"
  done < "${file}"
}

if [ -n "${FRAGMENT}" ] && [ -f "${FRAGMENT}" ]; then
  apply_fragment "${FRAGMENT}"
  rm -f "${FRAGMENT}"
fi

apply_fragment "${DEFAULT_FRAGMENT}"

# Live DigiLocker OAuth: prefer explicit DIGILOCKER_*_LIVE, else mirror FP_*_LIVE from server .env
python3 - "${ENV_FILE}" << 'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

def read_key(name: str) -> str:
    m = re.search(rf"^{re.escape(name)}=(.*)$", text, re.MULTILINE)
    if not m:
        return ""
    return m.group(1).strip().strip('"').strip("'")

pairs = (
    ("DIGILOCKER_FP_CLIENT_ID_LIVE", "FP_CLIENT_ID_LIVE"),
    ("DIGILOCKER_FP_CLIENT_SECRET_LIVE", "FP_CLIENT_SECRET_LIVE"),
)
missing = [dk for dk, fk in pairs if not read_key(dk) and read_key(fk)]
if not missing:
    sys.exit(0)
lines = text.splitlines()
out: list[str] = []
for line in lines:
    key = line.split("=", 1)[0] if "=" in line else ""
    replaced = False
    for dk, fk in pairs:
        if key == dk and not read_key(dk):
            value = read_key(fk)
            if value:
                out.append(f"{dk}={value}")
                replaced = True
                break
    if not replaced:
        out.append(line)
for dk, fk in pairs:
    if not read_key(dk):
        value = read_key(fk)
        if value and not any(l.startswith(dk + "=") for l in out):
            out.append(f"{dk}={value}")
path.write_text("\n".join(out) + "\n", encoding="utf-8")
PY

chown root:root "${ENV_FILE}"
chmod 600 "${ENV_FILE}"

echo "KYC DigiLocker env updated in ${ENV_FILE}"
grep -E '^(KYC_POA_PROOF|KYC_DIGILOCKER_SANDBOX|KYC_FORM_DISCOVERY|KYC_ESIGN_SANDBOX|KYC_DIGILOCKER_CALLBACK|KYC_DIGILOCKER_WEB_REDIRECT|KYC_PROOF_CALLBACK|DIGILOCKER_FP_BASE_URL|DIGILOCKER_FP_TENANT_LIVE)=' "${ENV_FILE}" || true

if [ "${RECREATE_API}" = "true" ] && [ -d "${ROOT}" ] && [ -f "${ROOT}/docker-compose.prod.yml" ]; then
  cd "${ROOT}"
  echo "Recreating api container to load .env..."
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps --force-recreate api
fi

echo "Done."
