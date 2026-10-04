# ZYND GitHub Actions

One workflow, four stages, in this order:

```
Stage 1  Change detection
   |
   v
Stage 2  Security and quality
   |
   v
Stage 3  Validate the areas that changed
   |
   v
Stage 4  Azure backend deployment
```

The workflow file is `zynd-pipeline.yml`. Its Actions name is **ZYND • Pipeline**. A push to `main` creates one run. Frontend apps stay on Vercel.

```
Developer
   |
   v
GitHub main
   |
   v
ZYND • Pipeline
   |
   +-- Stage 1  what changed
   +-- Stage 2  secrets, workflow syntax, compile, audits
   +-- Stage 3  typecheck or compile the changed areas
   |
   +-- backend change?
         /        \
       YES         NO
        |           |
        v           v
 Stage 4 Azure    skip Azure
 API deploy          |
                     v
                  Vercel
              frontend deploy
```

## When each stage runs

| Stage | Push to main | Pull request | Manual run | Monday 03:17 UTC |
|-------|--------------|--------------|------------|------------------|
| 1 Change detection | yes | yes | yes | yes |
| 2 Security and quality | after stage 1 | after stage 1 | after stage 1 | after stage 1 |
| 3 Validation | after stage 2, when code in that area changed | same | same | same |
| 4 Azure deploy | after stages 2 and 3, and only when backend deployment is required | no | yes | no |

Stage 4 is skipped for `Web/**`, `Admin/**`, `Distributor/**`, `Support/**`, `Mobile/**`, `packages/**`, documentation, and other frontend files. It runs for `Backend/**` code, `Backend/Dockerfile`, `docker-compose.yml`, `docker-compose.prod.yml`, `Redis/**`, and changes to `zynd-pipeline.yml`. A documentation-only change under `Backend/**` does not deploy.

A mixed backend and frontend commit still deploys the API once, in stage 4. Vercel publishes the frontend on its own.

Production deploys use the concurrency group `zynd-production-deploy` and are not cancelled by a newer push. Pull requests use a separate group so they do not sit in the production queue.

## Azure deploy

Stage 4 keeps the existing checks: server, git, Key Vault env, Docker, Compose, infrastructure, API build, API recreate, Postgres, Redis, Mongo, local health, `/api/v1/health`, `/api/v1/health/redis`, HTTPS, CORS, and container stability.

Phase 8 also recreates the backend worker services that exist in the compose config (`mf-scheduler`, `mf-order-worker`, `mf-cas-worker`, `event-worker`, `outbox-relay`, `document-scan-worker`, `deletion-cron`) with `--no-deps`, because they run the same Backend image as the API. Infrastructure containers (Postgres, Redis, Mongo, MinIO, ClamAV) are never restarted. Phase 14 fails the deploy if any recreated worker is not `running` with a zero restart count.

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d --no-deps --force-recreate api
```

The VM directory is `/opt/zynd`. The API is https://api.zynd.shop. Environment sync is `sudo /usr/local/bin/zynd-sync-env` from Key Vault `zynd-vault` secret `BACKEND-ENV`. `Backend/.env` must be `azureuser:azureuser` mode `600`. The log does not print that file.

SSH uses `appleboy/ssh-action@v1.2.2` and `DEPLOY_KNOWN_HOSTS`. Host key checking stays enabled. Runners are `ubuntu-24.04`.

## Secrets and variables

| Name | Kind | Purpose |
|------|------|---------|
| `DEPLOY_HOST` | secret | Azure VM |
| `DEPLOY_USER` | secret | SSH user |
| `DEPLOY_SSH_KEY` | secret | SSH private key |
| `DEPLOY_SSH_PASSPHRASE` | secret | Passphrase for `DEPLOY_SSH_KEY`. Leave empty for an unencrypted key. |
| `DEPLOY_KNOWN_HOSTS` | secret | SHA256 fingerprint or known_hosts line |
| `ZYND_STRICT_PRODUCTION` | variable | Leave unset on the testing VM. `true` fails the deploy when development runtime flags are enabled. |

## Rollback

Stage 4 prints this after a failure and does not run it:

```bash
cd /opt/zynd
git reset --hard <previous-commit>
docker compose -f docker-compose.yml -f docker-compose.prod.yml build api
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps --force-recreate api
```

Skip the git reset when the new API has already applied a migration the previous image cannot read.
