#!/usr/bin/env bash
# Fail when a new secret-looking file is tracked.
# Prints paths and pattern names only. Never prints file contents or matched values.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

fail=0

note() {
  printf '%s\n' "$1"
}

is_env_example() {
  case "$1" in
    *.example|*.sample|*.template) return 0 ;;
  esac
  return 1
}

while IFS= read -r path; do
  [ -z "${path}" ] && continue
  base="$(basename "${path}")"
  case "${base}" in
    .env|.env.*|*.env)
      if is_env_example "${base}"; then
        continue
      fi
      note "tracked environment file: ${path}"
      fail=1
      ;;
  esac
done < <(git ls-files)

while IFS= read -r path; do
  [ -z "${path}" ] && continue
  note "tracked key file: ${path}"
  fail=1
done < <(git ls-files '*.pem' '*.p12' '*.pfx' 'id_rsa' 'id_rsa.*' '*.key')

scan_pattern() {
  local name="$1"
  local pattern="$2"
  local matches
  matches="$(git grep -l -I -E "${pattern}" -- . ':(exclude)package-lock.json' || true)"
  if [ -z "${matches}" ]; then
    return 0
  fi
  while IFS= read -r path; do
    [ -z "${path}" ] && continue
    note "pattern ${name}: ${path}"
    fail=1
  done <<< "${matches}"
}

scan_pattern "private-key-block" "BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY"
scan_pattern "aws-access-key-id" "AKIA[0-9A-Z]{16}"
scan_pattern "github-token" "ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}"
scan_pattern "slack-token" "xox[baprs]-[A-Za-z0-9-]{10,}"
scan_pattern "stripe-live-key" "sk_live_[A-Za-z0-9]{10,}"

if [ "${fail}" -ne 0 ]; then
  note "Secret scan failed. Matching values were not printed."
  exit 1
fi

note "Secret scan passed."
