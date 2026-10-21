#!/usr/bin/env bash
# Remove local Ollama from the Bluehost VPS (Docker service, volume, optional host install).
# Run on the server as root, e.g.:
#   ssh root@50.6.205.51 'bash -s' < Backend/scripts/remove-ollama-from-vps.sh
# After removal, point Backend/.env OLLAMA_BASE_URL at your external Ollama service (next step).
set -euo pipefail

ROOT="${ZYND_ROOT:-/opt/zynd}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

echo "==> Stopping host systemd Ollama (if any)"
if systemctl list-unit-files ollama.service &>/dev/null; then
  systemctl stop ollama 2>/dev/null || true
  systemctl disable ollama 2>/dev/null || true
fi

if [ -d "${ROOT}" ] && [ -f "${ROOT}/docker-compose.prod.yml" ]; then
  cd "${ROOT}"
  echo "==> Stopping and removing Docker Ollama service"
  if "${COMPOSE[@]}" config --services 2>/dev/null | grep -qx ollama; then
    "${COMPOSE[@]}" stop ollama 2>/dev/null || true
    "${COMPOSE[@]}" rm -f ollama 2>/dev/null || true
  fi
fi

echo "==> Removing Ollama Docker volumes (if present)"
for vol in zynd_ollama_data ollama_data; do
  docker volume rm "${vol}" 2>/dev/null || true
done
docker volume ls -q | grep -i ollama | while read -r vol; do
  docker volume rm "${vol}" 2>/dev/null || true
done

echo "==> Removing Ollama Docker images (if present)"
docker images 'ollama/ollama' -q | xargs -r docker rmi -f 2>/dev/null || true

echo "==> Removing host Ollama binary/install (if present)"
if command -v ollama >/dev/null 2>&1; then
  ollama stop 2>/dev/null || true
fi
rm -f /usr/local/bin/ollama /usr/bin/ollama 2>/dev/null || true
rm -rf /usr/share/ollama /var/lib/ollama 2>/dev/null || true

echo "==> Done. Verify:"
docker ps -a --filter 'name=ollama' --format '{{.Names}}' || true
command -v ollama || echo 'no host ollama binary'
echo "Next: set OLLAMA_BASE_URL in ${ROOT}/Backend/.env to your external Ollama URL and recreate api."
