# Phase 6 — Domain deepening

Completed checklist.

## Done

| Item | Artifact |
|------|----------|
| Typed auth events | `app/domain/auth/events.py` |
| Typed account events | `app/domain/account/events.py` |
| Admin domain stub | `app/domain/admin/events.py` |
| Event factory helpers | `app/domain/shared/event_factory.py` |
| Repository protocols | `app/domain/auth/repositories.py`, `app/domain/shared/repositories.py` |
| SQLAlchemy adapters | `app/infrastructure/persistence/repositories/` |
| Publishers migrated | `auth_events.py`, `otp_events.py`, `email_service.py` |
| Workers parse typed payloads | login, OTP, email handlers |
| Stream constants | `streams.py` re-exports domain event types |
| Phase 6 tests | `tests/test_phase6_domain.py` |

## Domain layout

```
app/domain/
  shared/
    events.py           # DomainEvent envelope
    event_factory.py    # build_domain_event, parse_event_payload
    repositories.py     # AuditRepository protocol
  auth/
    events.py           # login / refresh / security review payloads
    repositories.py     # UserRepository protocol
  account/
    events.py           # OTP + security email payloads
  admin/
    events.py           # placeholder for future admin bus events
```

## Repository pattern

Application services depend on **protocols** in `app/domain/**/repositories.py`.  
SQLAlchemy implementations live in `app/infrastructure/persistence/repositories/`.

Initial adapters:

- `SqlAlchemyUserRepository` — used by `user_service`
- `SqlAlchemyAuditRepository` — used by `audit_service` and `audit_admin_service`

Further services can adopt repositories incrementally without changing HTTP contracts.

## Typed events

Publishers build events via domain factories (`login_succeeded_event`, `otp_requested_event`, …).  
Workers validate inbound payloads with `parse_event_payload(event, PayloadModel)`.

The durable envelope remains `DomainEvent`; payload schemas version independently via `schema_version`.

## Deferred (per ADR-001)

- **Kafka adapter** — only when Redis Streams limits are hit
- Full CQRS / separate read models
- Migrating every SQLAlchemy query to repositories in one pass

## Guardrails

- `tests/test_phase6_domain.py` — payload round-trip, repository lookups, stream constant alignment
