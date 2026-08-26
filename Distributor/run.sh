#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-9900}"

if [ -f .env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line//[[:space:]]/}" ]] && continue
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      export "$line"
    fi
  done < .env
elif [ -f .env.example ]; then
  echo "No Distributor/.env found — copy .env.example to .env and set NEXT_PUBLIC_TURNSTILE_SITE_KEY."
fi

# Turbopack caches compiled CSS under .next; a bad distributor.css parse can stick until this is removed.
# ZYND_DISTRIBUTOR_CLEAN=0 skips the wipe (faster restarts once CSS is stable).
if [ "${ZYND_DISTRIBUTOR_CLEAN:-1}" != "0" ]; then
  rm -rf .next
fi

exec npm run dev -- --port "${PORT}"
