# Phase 3 — Transactional outbox

Completed checklist per ADR-001 Step B.

## Done

| Item | Artifact |
|------|----------|
| Outbox table | `outbox_events` model + migration `011_outbox_events` |
| Processed-event dedupe | `processed_domain_events` + claim-before-handle in dispatcher |
| Persist before commit | `persist_scheduled_events` in `commit_session_with_events` |
| Outbox relay | `app/application/messaging/outbox_service.py` |
| Standalone relay job | `app/jobs/run_outbox_relay.py` (`--once` for single batch) |
| Dispatch modes | `sync` (tests), `outbox` (production); `redis` alias → `outbox` |
| Phase 3 tests | `tests/test_phase3_outbox.py` |

## Flow

1. Application calls `schedule_domain_event` during a request.
2. Before DB commit, pending events are written to `outbox_events` in the **same transaction**.
3. After commit, `flush_scheduled_events` runs the relay (inline) or a background relay job picks up pending rows.
4. Relay `XADD`s to Redis Streams; workers consume and dispatch handlers.
5. Handlers claim `event_id` in `processed_domain_events` before running (idempotent on redelivery).

## Running relay + worker

```bash
cd Backend
# Relay outbox → Redis (loop or one-shot)
.venv/bin/python -m app.jobs.run_outbox_relay --once

# Consume streams → side effects
.venv/bin/python -m app.jobs.run_event_worker
```

Production: run relay and worker as separate processes alongside the API.

## Next: Phase 5

See `docs/architecture/PHASE_4.md`. RBAC completion — admin APIs + enforcement tests.
