#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-7777}"

if [ -f .env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line//[[:space:]]/}" ]] && continue
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      export "$line"
    fi
  done < .env
fi

# Turbopack + chart libs can spike memory during HMR; give dev headroom.
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

exec npm run dev -- --port "${PORT}"
