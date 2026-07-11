# Phase 2 — Event bus becomes real

Completed checklist per ADR-001 Step A (direct publish after commit).

## Done

| Item | Artifact |
|------|----------|
| Post-commit event scheduling | `app/application/messaging/post_commit.py` wired in `get_db` |
| Stream + event constants | `app/application/messaging/streams.py`, `auth_events.py` |
| Redis consumer groups | `RedisEventBus.ensure_consumer_group`, `read_group`, `ack` |
| Event worker CLI | `app/jobs/run_event_worker.py` |
| Email handler (SMTP in worker) | `app/workers/handlers/email_handler.py` |
| Login/security handlers | `app/workers/handlers/security_login_handler.py` |
| Event dispatcher | `app/workers/event_dispatcher.py` |
| Request path publishes, worker delivers | `send_security_email` schedules only; no inline SMTP |
| Login events | `auth.login.succeeded`, `auth.login.failed`, `auth.refresh_reuse.detected` |
| Security review via events | `security.review.flagged` + login handler side effects |
| Router import cleanup | `app/api/v1/auth/router.py`, `deps.py` import split modules |
| Config | `EVENT_DISPATCH_MODE=redis|sync` (tests use `sync`) |
| Phase 2 tests | `tests/test_phase2_events.py` |

## Running the worker

```bash
cd Backend
.venv/bin/python -m app.jobs.run_event_worker
```

Set `EVENT_DISPATCH_MODE=redis` in production so the API publishes to Redis Streams after DB commit. Run one or more worker processes to consume and deliver email / security side effects.

## Dispatch modes

| Mode | Behavior |
|------|----------|
| `redis` | After commit, `XADD` to Redis Streams; worker consumes |
| `sync` | After commit, run handlers in-process (used by pytest) |

## Outbox (implemented in Phase 3)

See `docs/architecture/PHASE_3.md`. Direct publish (`redis` mode) is replaced by transactional outbox.

## Next: Phase 4

OTP platformization — see refactor plan.
