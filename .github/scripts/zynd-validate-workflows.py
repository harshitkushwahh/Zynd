#!/usr/bin/env python3
"""Validate ZYND GitHub workflow YAML without printing secret material."""

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
    if not files:
        print("No workflow files found.")
        return 1
    names = {path.name for path in files}
    if "deploy-main.yml" in names:
        print("deploy-main.yml is present and would start a second Azure deployment.")
        failed = True
    required = {
        "zynd-change-detection.yml",
        "zynd-backend-deploy.yml",
        "zynd-security.yml",
        "zynd-pr-validation.yml",
    }
    missing = required - names
    if missing:
        print("Missing workflow files: " + ", ".join(sorted(missing)))
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
        if not runners:
            print(f"{path.name} has no job runner.")
            failed = True
        for runner in runners:
            if runner != "ubuntu-24.04":
                print(f"{path.name} runner is {runner}")
                failed = True
        print(f"ok {path.name} jobs={len(jobs)} runners={','.join(runners)}")

    deploy = yaml.safe_load((WORKFLOWS / "zynd-backend-deploy.yml").read_text())
    group = (deploy.get("concurrency") or {}).get("group")
    if group != "zynd-production-deploy":
        print("Backend deploy concurrency group changed.")
        failed = True
    if (deploy.get("concurrency") or {}).get("cancel-in-progress") is not False:
        print("Backend deploy must not cancel an in-progress production deploy.")
        failed = True
    deploy_job = (deploy.get("jobs") or {}).get("deploy-backend") or {}
    if deploy_job.get("if") != "needs.confirm-backend-changes.outputs.deploy_backend == 'true'":
        print("Backend deploy job is not gated on the path confirmation.")
        failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
