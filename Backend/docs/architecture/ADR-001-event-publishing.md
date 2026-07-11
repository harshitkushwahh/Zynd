# ADR-001: Domain event publishing strategy

**Status:** Accepted (Phase 0)  
**Date:** 2026-07-10  
**Context:** Zynd Backend has a Redis Streams event bus scaffold (`RedisEventBus`) and a `DomainEvent` envelope, but almost all side effects (audit, email, security reviews) still run synchronously in request handlers. Only SMTP failure/fallback publishes `security.email.requested`.

## Decision

Use a **two-step migration**:

### Step A — Direct publish after commit (Phase 2)

- Application services mutate Postgres, then **after successful commit** publish domain events to Redis Streams.
- Workers (email, security review, projections) consume via consumer groups.
- Acceptable for non-critical notifications during the refactor.

**Pros:** Small change, unblocks workers quickly.  
**Cons:** Crash between commit and publish can drop events (at-most-once).

### Step B — Transactional outbox (Phase 3) ✅

Implemented: `outbox_events` + relay job + idempotent consumers on `event_id`.

**Pros:** At-least-once delivery aligned with DB state.  
**Cons:** Extra table + relay; do this once events matter for compliance/money.

## Non-goals (for now)

- Kafka adapter (config stub only until Redis Streams limits are hit)
- Full CQRS / separate read models
- Publishing every audit row as an event before outbox exists

## Event publishing rules

1. **Request path stays sync** for auth decisions: lockout, captcha, risk score, MFA gate, refresh reuse revoke.
2. **Post-commit / workers** for: security emails, review queue population, analytics projections, OTP channel delivery.
3. Application code should depend on an **EventBus port**, not construct `RedisEventBus` ad hoc (email_service today is the anti-pattern to fix in Phase 1–2).
4. Never put raw OTP codes in durable event payloads in production.

## Related code

- Envelope: `app/domain/shared/events.py`
- Port: `app/infrastructure/messaging/event_bus.py`
- Adapter: `app/infrastructure/messaging/redis_event_bus.py`
- Current publisher: `app/infrastructure/notifications/email_service.py`
