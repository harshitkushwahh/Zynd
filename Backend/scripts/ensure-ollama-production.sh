#!/usr/bin/env bash
# Idempotent Ollama setup for the Bluehost VPS (Support AI / Help Bot).
# Invoked from .github/workflows/zynd-pipeline.yml before API recreate.
set -euo pipefail

ROOT="${ZYND_ROOT:-/opt/zynd}"
cd "${ROOT}"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
ENV_FILE="${ROOT}/Backend/.env"

read_env() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "${ENV_FILE}" 2>/dev/null | tail -n 1 || true)"
  [ -n "${line}" ] || return 1
  local value="${line#*=}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  value="${value#\"}"
  value="${value%\"}"
  value="${value#\'}"
  value="${value%\'}"
  printf '%s' "${value}"
}

ensure_swap() {
  if swapon --show 2>/dev/null | grep -q .; then
    echo "swap: already enabled"
    return 0
  fi
  if [ ! -f /swapfile ]; then
    echo "Creating 4G /swapfile (Ollama needs extra memory on small VPS)..."
    if ! fallocate -l 4G /swapfile 2>/dev/null; then
      dd if=/dev/zero of=/swapfile bs=1M count=4096 status=none
    fi
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
  if ! grep -qE '^/swapfile[[:space:]]' /etc/fstab 2>/dev/null; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
  echo "swap: enabled"
}

if ! "${COMPOSE[@]}" config --services 2>/dev/null | grep -qx ollama; then
  echo "ERROR: ollama service is missing from compose (docker-compose.prod.yml)."
  exit 1
fi

if systemctl is-active --quiet ollama 2>/dev/null; then
  echo "Stopping host systemd ollama (production uses Docker ollama service)."
  systemctl stop ollama || true
  systemctl disable ollama || true
fi

ensure_swap

echo "Starting ollama container..."
"${COMPOSE[@]}" up -d ollama

model="$(read_env OLLAMA_MODEL || true)"
model="${model:-qwen3.5:4b}"

echo "Waiting for Ollama API (model: ${model})..."
ready=0
for _ in $(seq 1 90); do
  if "${COMPOSE[@]}" exec -T ollama ollama list >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
if [ "${ready}" -ne 1 ]; then
  echo "ERROR: Ollama container did not become ready within ~3 minutes."
  "${COMPOSE[@]}" logs --tail 80 ollama || true
  exit 1
fi

if ! "${COMPOSE[@]}" exec -T ollama ollama show "${model}" >/dev/null 2>&1; then
  echo "Pulling ${model} (first deploy or model change; may take several minutes)..."
  "${COMPOSE[@]}" exec -T ollama ollama pull "${model}"
else
  echo "Model ${model} is already present."
fi

want_url="http://ollama:11434"
current="$(read_env OLLAMA_BASE_URL || true)"
if [ "${current}" != "${want_url}" ]; then
  echo "Updating OLLAMA_BASE_URL to ${want_url} (was: ${current:-unset})."
  if grep -q '^OLLAMA_BASE_URL=' "${ENV_FILE}"; then
    sed -i "s|^OLLAMA_BASE_URL=.*|OLLAMA_BASE_URL=${want_url}|" "${ENV_FILE}"
  else
    printf '\nOLLAMA_BASE_URL=%s\n' "${want_url}" >> "${ENV_FILE}"
  fi
  chown root:root "${ENV_FILE}" 2>/dev/null || true
  chmod 600 "${ENV_FILE}"
fi

if ! read_env OLLAMA_MODEL >/dev/null 2>&1; then
  if grep -q '^OLLAMA_MODEL=' "${ENV_FILE}"; then
    sed -i "s|^OLLAMA_MODEL=.*|OLLAMA_MODEL=${model}|" "${ENV_FILE}"
  else
    printf 'OLLAMA_MODEL=%s\n' "${model}" >> "${ENV_FILE}"
  fi
  chown root:root "${ENV_FILE}" 2>/dev/null || true
  chmod 600 "${ENV_FILE}"
fi

echo "Verifying Ollama reachable on the compose network..."
"${COMPOSE[@]}" run --rm --no-deps \
  -e "OLLAMA_BASE_URL=${want_url}" \
  api python -c "
import os, urllib.request
base = os.environ['OLLAMA_BASE_URL'].rstrip('/')
with urllib.request.urlopen(base + '/api/tags', timeout=60) as resp:
    resp.read()
print('Ollama /api/tags OK at', base)
"

echo "Warming ${model} (loads weights into memory for faster first Help Bot reply)..."
if ! "${COMPOSE[@]}" run --rm --no-deps \
  -e "OLLAMA_BASE_URL=${want_url}" \
  -e "OLLAMA_MODEL=${model}" \
  api python -c "
import json, os, urllib.request

base = os.environ['OLLAMA_BASE_URL'].rstrip('/')
model = os.environ['OLLAMA_MODEL']
body = json.dumps({
    'model': model,
    'stream': False,
    'keep_alive': '30m',
    'messages': [{'role': 'user', 'content': 'ping'}],
    'options': {'num_predict': 8},
}).encode()
req = urllib.request.Request(
    base + '/api/chat',
    data=body,
    headers={'Content-Type': 'application/json'},
    method='POST',
)
with urllib.request.urlopen(req, timeout=180) as resp:
    resp.read()
print('Ollama warm-up chat OK')
"; then
  echo "WARN: model warm-up failed; Help Bot may be slow on the first message."
fi

if [ -f "${ROOT}/Backend/scripts/nginx-zynd-api-timeouts.snippet" ]; then
  echo "NOTE: Ensure nginx/Apache proxy_read_timeout is >= 180s for /api/ (see Backend/scripts/nginx-zynd-api-timeouts.snippet)."
fi

echo "Ollama ensure complete."
