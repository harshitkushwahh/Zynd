# ZYND GitHub Actions

GitHub Actions deploys the FastAPI backend to the existing Azure VM. Vercel publishes the Next.js apps. These workflows do not deploy frontends, and a frontend-only commit does not start an Azure deployment.

```
Developer
   |
   v
GitHub main
   |
   +----------------------+
   |                      |
   v                      v
Change Detection       Security/CI
   |
   +----------+-----------+-----------+
              |
      backend changed?
         /          \
       YES           NO
        |             |
        v             v
 Azure Backend     Skip Azure
 Deployment        Deployment
                      |
                      v
                    Vercel
                 frontend deploy
```

## Workflows

| Workflow | File | What it does |
|----------|------|----------------|
| ZYND • Change Detection | `zynd-change-detection.yml` | Reports which areas changed. Does not deploy. |
| ZYND • Backend Deployment | `zynd-backend-deploy.yml` | The only Azure deployment. |
| ZYND • Security & Quality | `zynd-security.yml` | Secret scan, workflow syntax, Python compile, dependency reports. Does not deploy. |
| ZYND • Pull Request Validation | `zynd-pr-validation.yml` | Typechecks and compiles only the areas a pull request changed. Does not deploy. |

Path classification lives in `.github/scripts/zynd-classify-changes.sh`. The backend workflow also has a path filter, so a customer-web commit never starts the Azure job. The confirm job inside the deploy workflow skips the SSH session when the only `Backend/**` changes are documentation.

There is one production deploy workflow. `deploy-main.yml` was removed so a commit cannot deploy twice.

## Triggers

| Event | Change Detection | Backend Deployment | Security & Quality | Pull Request Validation |
|-------|------------------|--------------------|--------------------|-------------------------|
| Push to `main` | always | only backend paths below | always | no |
| Pull request to `main` | always | no | always | always, jobs skip when their area did not change |
| Manual run | report only | deploys the current `main` checkout | scan only | no |
| Monday 03:17 UTC | no | no | scan only | no |

Runners are `ubuntu-24.04`.

## Paths that deploy the backend

A push to `main` starts `ZYND • Backend Deployment` when it touches:

- `Backend/**`
- `docker-compose.yml`
- `docker-compose.prod.yml` (server file; included so a tracked copy would deploy)
- `Redis/**`
- `.github/workflows/zynd-backend-deploy.yml`
- `.github/workflows/zynd-change-detection.yml`

The SSH deploy then runs only when the change is more than documentation. These still deploy:

- `Backend/**` application, Docker, and Alembic files
- `Backend/Dockerfile`
- `docker-compose.yml` and `docker-compose.prod.yml`
- `Redis/**`
- the two workflow files listed above

A commit that only changes `Backend/**/*.md`, `Backend/docs/**`, or `Backend/README.md` matches the path filter, then the confirm job skips Azure.

A manual run of `ZYND • Backend Deployment` always deploys.

## Paths that skip the backend

These do not start the Azure workflow:

- `Web/**` — Vercel publishes https://zynd.shop
- `Admin/**` — Vercel publishes https://admin.zynd.shop
- `Distributor/**` — Vercel publishes https://mitra.zynd.shop
- `Support/**`
- `Mobile/**`
- `packages/**`
- `Docs/**`, root `README*`, and other `*.md` files outside `Backend/**`
- `package.json` and `package-lock.json`
- `scripts/**`
- `.github/workflows/zynd-security.yml`
- `.github/workflows/zynd-pr-validation.yml`

A mixed commit that changes `Backend/app/**` and `Web/**` deploys the backend once. Vercel handles the customer app on its own.

## What deploys and what validates

| Workflow | Azure SSH | Vercel | Validates |
|----------|-----------|--------|-----------|
| Change Detection | no | no | changed-path report |
| Backend Deployment | yes, API container only | no | server, git, Key Vault env, Docker, Compose, infrastructure, build, health, HTTPS, CORS, stability |
| Security & Quality | no | no | tracked secrets, workflow YAML, `compileall`, pip-audit report, npm audit report |
| Pull Request Validation | no | no | backend compile, Compose service names, `tsc` for Web, Admin, Distributor, and Support |

`pip-audit` and `npm audit` are recorded in the security summary. Existing advisories do not fail the branch. The secret scan does fail the branch. It prints paths and pattern names, not values. `NEXT_PUBLIC_*` variables are not treated as leaks. The already tracked `Backend/privateKey.pem` is reported as a known JWT key and is not treated as a new leak.

Pull-request typecheck runs for a frontend when that app changes. A change under `packages/**` also typechecks Web, Admin, Distributor, and Support, because those apps import `@zynd/shared`. Mobile is reported by change detection and is not typechecked here.

## Backend deployment checks

The Azure script still runs these phases, in order:

1. Validate Azure VM
2. Validate Git repository
3. Sync Key Vault environment
4. Validate environment
5. Validate Docker
6. Check infrastructure
7. Build API
8. Deploy API
9. Wait for readiness
10. Local API health
11. API functional health
12. HTTPS check
13. CORS check
14. Stability check
15. Deployment summary

The API update command remains:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d --no-deps --force-recreate api
```

PostgreSQL, MongoDB, Redis, MinIO, and ClamAV are not recreated. Volumes are not removed. Alembic is not invoked by Actions. With `APP_ENV=development`, the API process still runs `alembic upgrade head` on startup.

Concurrency group `zynd-production-deploy` does not cancel an in-progress deploy. The other workflows use their own groups.

## Azure layout

| Item | Value |
|------|-------|
| VM directory | `/opt/zynd` |
| SSH user | `azureuser` |
| API | https://api.zynd.shop |
| Local API | http://127.0.0.1:8000 |
| Compose files | `docker-compose.yml` and server-only `docker-compose.prod.yml` |
| Environment | `/opt/zynd/Backend/.env` |
| Key Vault | `zynd-vault` secret `BACKEND-ENV` |
| Sync command | `sudo /usr/local/bin/zynd-sync-env` |

The sync uses the VM managed identity. After it runs, `Backend/.env` must be owned by `azureuser:azureuser` and mode `600`. The workflow checks that and does not print the file.

SSH uses `appleboy/ssh-action@v1.2.2` with `DEPLOY_KNOWN_HOSTS`. Host key checking stays enabled.

## GitHub secrets

| Secret | Used by |
|--------|---------|
| `DEPLOY_HOST` | Backend deployment |
| `DEPLOY_USER` | Backend deployment |
| `DEPLOY_SSH_KEY` | Backend deployment |
| `DEPLOY_KNOWN_HOSTS` | Backend deployment. SHA256 fingerprint or a known_hosts line. |

## GitHub variables

| Variable | Used by |
|----------|---------|
| `ZYND_STRICT_PRODUCTION` | Optional. Leave unset on the testing VM. Set to `true` to fail a deploy when `APP_ENV` is not production or when `DEBUG`, `DEV_OTP`, or `DEV_SKIP_RATE_LIMITS` are enabled. The values of secrets are not printed. |

## Rollback

The deploy log records the previous commit and prints this command. It does not run it.

```bash
cd /opt/zynd
git reset --hard <previous-commit>
docker compose -f docker-compose.yml -f docker-compose.prod.yml build api
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps --force-recreate api
```

Skip the git reset when the new API has already applied a migration the previous image cannot read.

## Server changes

No server change is required for this layout. The VM already has the Key Vault sync script, `docker-compose.prod.yml`, and the managed identity.
