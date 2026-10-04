#!/usr/bin/env python3
"""Validate the single ZYND pipeline without printing secret material."""

from __future__ import annotations

import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github" / "workflows"
FORBIDDEN = (
    "ubuntu-latest",
    "StrictHostKeyChecking=no",
    "git clean -fdx",
    "docker system prune",
)


def job_runners(jobs: dict) -> list[str]:
    runners: list[str] = []
    for job in jobs.values():
        if not isinstance(job, dict):
            continue
        runs_on = job.get("runs-on")
        if isinstance(runs_on, str):
            runners.append(runs_on)
        elif isinstance(runs_on, list):
            runners.extend(str(item) for item in runs_on)
    return runners


def main() -> int:
    failed = False
    files = sorted(WORKFLOWS.glob("*.yml"))
    names = {path.name for path in files}
    if names != {"zynd-pipeline.yml"}:
        print("Expected only zynd-pipeline.yml, found: " + ", ".join(sorted(names)))
        failed = True
    if "deploy-main.yml" in names:
        print("deploy-main.yml would start a second backend deployment.")
        failed = True

    for path in files:
        text = path.read_text()
        for token in FORBIDDEN:
            if token in text:
                print(f"{path.name} contains forbidden text: {token}")
                failed = True
        data = yaml.safe_load(text)
        if not isinstance(data, dict):
            print(f"{path.name} did not parse as a mapping.")
            failed = True
            continue
        trigger = data.get("on", data.get(True))
        if trigger is None:
            print(f"{path.name} has no trigger.")
            failed = True
        jobs = data.get("jobs") or {}
        runners = job_runners(jobs)
        if runners != ["ubuntu-24.04"] * len(runners) or not runners:
            print(f"{path.name} runners={','.join(runners)}")
            failed = True
        expected = ["detect-changes", "security-scan", "validate-changes", "deploy-backend"]
        if list(jobs) != expected:
            print(f"Job order is {list(jobs)}")
            failed = True
        if jobs.get("security-scan", {}).get("needs") != "detect-changes":
            print("Security must follow change detection.")
            failed = True
        validate_needs = jobs.get("validate-changes", {}).get("needs")
        if validate_needs != ["detect-changes", "security-scan"]:
            print(f"Validation needs={validate_needs}")
            failed = True
        deploy_needs = jobs.get("deploy-backend", {}).get("needs")
        if deploy_needs != ["detect-changes", "security-scan", "validate-changes"]:
            print(f"Deploy needs={deploy_needs}")
            failed = True
        deploy_if = str(jobs.get("deploy-backend", {}).get("if") or "")
        required_if = (
            "needs.detect-changes.outputs.deploy_backend == 'true'",
            "needs.security-scan.result == 'success'",
            "github.event_name == 'push'",
            "github.event_name == 'workflow_dispatch'",
        )
        for piece in required_if:
            if piece not in deploy_if:
                print(f"Deploy condition is missing: {piece}")
                failed = True
        print(f"ok {path.name} jobs={len(jobs)}")

    pipeline = (WORKFLOWS / "zynd-pipeline.yml").read_text()
    if "zynd-production-deploy" not in pipeline:
        print("Production concurrency group is missing.")
        failed = True
    if "cancel-in-progress: ${{ github.event_name == 'pull_request' }}" not in pipeline:
        print("Pull requests must be the only runs that cancel an in-progress pipeline.")
        failed = True
    if "--no-deps --force-recreate api" not in pipeline:
        print("API deploy command changed.")
        failed = True
    if "check_mf_worker_recreate" not in pipeline:
        print("Deploy must skip mf-scheduler recreate while ingestion is live.")
        failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
