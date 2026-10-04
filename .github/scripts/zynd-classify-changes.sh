#!/usr/bin/env bash
# Classify a newline-separated path list for ZYND workflows.
# Prints key=value lines suitable for GITHUB_OUTPUT. Prints no file contents.
set -euo pipefail

list="${1:-}"
if [ -z "${list}" ] || [ ! -f "${list}" ]; then
  echo "usage: zynd-classify-changes.sh <changed-files.txt>" >&2
  exit 1
fi

backend_changed=false
web_changed=false
admin_changed=false
distributor_changed=false
support_changed=false
mobile_changed=false
shared_changed=false
infrastructure_changed=false
workflow_changed=false
documentation_changed=false
other_changed=false
deploy_backend=false

is_documentation() {
  local path="$1"
  local base
  base="$(basename "${path}")"
  case "${path}" in
    Docs/*|docs/*|*/docs/*) return 0 ;;
  esac
  case "${base}" in
    README|README.*) return 0 ;;
  esac
  case "${path}" in
    *.md) return 0 ;;
  esac
  return 1
}

while IFS= read -r path || [ -n "${path}" ]; do
  path="${path%$'\r'}"
  [ -z "${path}" ] && continue

  documented=false
  if is_documentation "${path}"; then
    documentation_changed=true
    documented=true
  fi

  case "${path}" in
    Web/*)
      web_changed=true
      ;;
    Admin/*)
      admin_changed=true
      ;;
    Distributor/*)
      distributor_changed=true
      ;;
    Support/*)
      support_changed=true
      ;;
    Mobile/*)
      mobile_changed=true
      ;;
    packages/*)
      shared_changed=true
      ;;
    Redis/*|docker-compose.yml|docker-compose.prod.yml|Backend/Dockerfile)
      infrastructure_changed=true
      deploy_backend=true
      case "${path}" in
        Backend/*) backend_changed=true ;;
      esac
      ;;
    .github/workflows/zynd-pipeline.yml)
      workflow_changed=true
      deploy_backend=true
      ;;
    .github/workflows/*|.github/scripts/*)
      workflow_changed=true
      ;;
    Backend/*)
      if [ "${documented}" = "false" ]; then
        backend_changed=true
        deploy_backend=true
      fi
      ;;
    *)
      if [ "${documented}" = "false" ]; then
        other_changed=true
      fi
      ;;
  esac
done < "${list}"

printf 'backend_changed=%s\n' "${backend_changed}"
printf 'web_changed=%s\n' "${web_changed}"
printf 'admin_changed=%s\n' "${admin_changed}"
printf 'distributor_changed=%s\n' "${distributor_changed}"
printf 'support_changed=%s\n' "${support_changed}"
printf 'mobile_changed=%s\n' "${mobile_changed}"
printf 'shared_changed=%s\n' "${shared_changed}"
printf 'infrastructure_changed=%s\n' "${infrastructure_changed}"
printf 'workflow_changed=%s\n' "${workflow_changed}"
printf 'documentation_changed=%s\n' "${documentation_changed}"
printf 'other_changed=%s\n' "${other_changed}"
printf 'deploy_backend=%s\n' "${deploy_backend}"
