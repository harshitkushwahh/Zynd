# Zynd — Platform foundation plan

Workstream **1 of N** from [ZYND_PLATFORM_CAPABILITY_MATRIX.md](./ZYND_PLATFORM_CAPABILITY_MATRIX.md).  
Focus: what to **fix and ship next**, **in-house vs third party** (Cybrilla treated as already in place — not listed as a new dependency).

**Updated:** 22 Oct 2026

---

## Goals for this workstream

1. Make the platform **easier to operate** (health, envs, releases, DR basics).
2. Close **compliance gaps** (consent, audit, retention) without waiting on product verticals.
3. Finish the **event spine** enough that metrics, notifications, and future decision engines share one catalogue.
4. **Defer** native offline PM app and app-size work unless product explicitly prioritises field/mobile.

---

## Current snapshot (repo truth)

| Area | What exists today | Main gap |
|------|-------------------|----------|
| Architecture | FastAPI modular monolith, Web/Distributor/Admin, `SERVICE_BOUNDARIES.md`, phase docs | No single “frozen” domain map / bounded-context doc for new engineers |
| Events | ADR-001, `DomainEvent`, Redis Streams, **transactional outbox** (`outbox_events`, relay job) | Small event surface (auth/account/notifications); many side effects still sync; **no event taxonomy doc** |
| Consent | `consent_service`, versioned definitions, user records, `domain/consent/keys.py`, ZTO consent table | Not full DPDP artefact set (purpose registry doc, AA bundle, one-tap revoke UX everywhere) |
| Audit | `audit_logs`, admin reads, provider logs, MF pipeline audit job | No **rules registry** (versioned rules + golden tests + approval workflow) |
| Cloud / DR | VPS deploy via GitHub pipeline; `/health`, `/health/redis` | No readiness (DB), no runbook/SLO, no secondary region |
| Availability | API + workers + Redis | Single-node patterns; failover not exercised |
| Envs / flags | `APP_ENV`, many `ZYND_*` settings in `config.py`, CI pipeline on `main` | No unified feature-flag layer; staging ↔ prod parity manual |
| Design system | shadcn, shared copy (`Web` etc.) | ✅ Maintain; occasional cross-app drift |
| Offline native app | — | Web-only; out of scope unless new initiative |
| App size | — | N/A for web |

---

## Recommended order (phases)

Do these in order so later work does not rework earlier layers.

| Phase | Theme | Outcome |
|-------|--------|---------|
| **PF-0** (1–2 weeks) | Operability quick wins | Deep health checks, env checklist, release/runbook doc |
| **PF-1** (2–4 weeks) | Consent + audit hardening | DPDP-ready consent gaps closed; audit coverage matrix |
| **PF-2** (3–5 weeks) | Event taxonomy + migration | Published event catalogue; migrate top 3 sync side effects to outbox |
| **PF-3** (parallel / ops) | Resilience | DB backup/restore drill, optional read replica or warm standby |
| **PF-4** (optional) | Feature flags | DB or env-backed flags + admin read; no SaaS required for v1 |
| **Defer** | Offline RN + MDM | Separate initiative when field PM app is approved |

---

## Capability-by-capability plan

### 1. Architecture and data model freeze

**Status today:** 🟡 Partial — structure is sound; “freeze” is documentation and discipline, not a rewrite.

**Fix / deliver**

- [ ] Publish **`ARCHITECTURE_BOUNDED_CONTEXTS.md`**: Backend packages (`application/`, `domain/`, `infrastructure/`), the three frontends, and which DB tables each context owns.
- [ ] Link existing artefacts: `SERVICE_BOUNDARIES.md`, `RBAC_PERMISSION_MATRIX.md`, `ADR-001`, MF phase docs.
- [ ] Add a **“no new logic in frozen modules”** checklist to PR template or `AGENTS.md` (auth monolith already called out).
- [ ] Optional: one-page **entity relationship** diagram for core tables (users, investors, MF orders, consent, outbox).

| In-house | Third party (excl. Cybrilla) |
|----------|------------------------------|
| Docs, diagrams, PR discipline | **None** |

---

### 2. Event spine and taxonomy

**Status today:** 🟡 Partial — outbox + Redis exist; ADR-001 notes most side effects still synchronous.

**Fix / deliver**

- [ ] Add **`EVENT_TAXONOMY.md`**: table of `event_type`, owning team/context, payload schema reference, idempotency key, PII rules (e.g. no OTP in payloads).
- [ ] Seed taxonomy from existing: `domain/auth/events.py`, `domain/account/events.py`, `domain/notifications/events.py`.
- [ ] **PF-2 migration list** (pick 3 high-value paths first):
  1. Security / review queue population (already ADR target).
  2. Notification fan-out after DB commit.
  3. Audit or analytics projection (non-blocking).
- [ ] Wire publishers through **EventBus port** only (retire ad-hoc `RedisEventBus` in handlers — email_service called out in ADR).
- [ ] Ensure prod runs **outbox relay + event workers** (document in `run.sh` / deploy compose).

| In-house | Third party (excl. Cybrilla) |
|----------|------------------------------|
| Taxonomy doc, publishers, consumers, tests | **Optional later:** managed queue (**AWS SNS/SQS**, **GCP Pub/Sub**) if Redis Streams becomes a bottleneck — not required for PF-2 |

---

### 3. Consent service (DPDP-aligned)

**Status today:** 🟡 Partial — versioned consent + accept/revoke + audit hooks; keys for signup, KYC, MF txn.

**Fix / deliver**

- [ ] **Purpose registry** (in-house): markdown or admin-readable table mapping each `consent_keys` entry → legal purpose, data categories, retention, revocable Y/N.
- [ ] **One-tap revoke** UX: expose revoke for user-revocable consents in Web settings (backend APIs largely exist via consent service patterns).
- [ ] Ensure every new flow uses **`ConsentAcceptContext`** (IP, UA, source) consistently — audit trail for DPDP.
- [ ] **Re-consent on publish**: verify `ConsentReacceptPolicy` paths for ToS/Privacy updates (admin publish → forced reaccept).
- [ ] Document **AA consent bundle** as *future* — blocked until Account Aggregator workstream; do not scope AA vendor here.

| In-house | Third party (excl. Cybrilla) |
|----------|------------------------------|
| Registry doc, API/UX, admin publish workflow, tests | **Legal/compliance review** (external counsel) for wording — not a tech vendor |
| | **AA vendor** only when AA product starts — out of PF scope |

---

### 4. Audit log and rules registry

**Status today:** 🟡 Partial — append-only `audit_logs`, typed `AuditEventType`, retention/deletion services.

**Fix / deliver**

- [ ] **Audit coverage matrix**: route/service → which events must be written (extend RBAC matrix style).
- [ ] Close gaps where money/KYC/admin mutations lack audit rows (grep-driven audit).
- [ ] **Rules registry v1** (in-house):
  - Store invest/KYC/risk **rules as versioned files** in repo (YAML/JSON), e.g. `Backend/rules/` with semver.
  - Golden tests: given fixture input → expected allow/deny (start with suitability/risk gates).
  - Admin “rules version” read-only API or doc link — two-person approval = GitHub PR + required reviewer (process, not product).
- [ ] Optional: ship **immutable** audit export for compliance (CSV/S3) using existing retention schedule.

| In-house | Third party (excl. Cybrilla) |
|----------|------------------------------|
| Matrix, code paths, rules repo, pytest golden files | **Object storage** (e.g. **AWS S3**, **Backblaze B2**) only if audit export to WORM bucket is required |

---

### 5. Cloud, India residency, DR, and LLM route

**Status today:** 🟡 Partial — production on VPS; data stays on chosen host; DR not formalised.

**Fix / deliver**

- [ ] **Residency statement** doc: where Postgres, Redis, backups, and logs live (India region VPS or IN cloud region).
- [ ] **Backup + restore drill** (quarterly): RTO/RPO targets on paper, tested restore to staging.
- [ ] **DR v1** (choose one): warm standby second VPS + replicated DB, *or* managed Postgres with PITR (no app rewrite).
- [ ] **LLM route** (only if expanding agents beyond help bot): document allowed providers, data minimisation, no PII in prompts — implementation can wait until AI workstream.

| In-house | Third party (excl. Cybrilla) |
|----------|------------------------------|
| Runbooks, backup scripts, deploy pipeline tweaks | **Hosting/cloud** (current VPS provider or **AWS/GCP/Azure Mumbai**) |
| | **LLM API** (**OpenAI**, **Azure OpenAI**, **Gemini**) when agent gateway ships — not blocking PF-0/1 |
| | **DNS / CDN** (**Cloudflare**) optional for static assets and DDoS |

---

### 6. Offline-first app foundation

**Status today:** ⬜ Missing — intentional for current product (web-first).

**Recommendation:** **Defer** to a dedicated “Field PM / native app” initiative.

If approved later:

| In-house | Third party (excl. Cybrilla) |
|----------|------------------------------|
| React Native app, offline store, sync protocol | **MDM** (**Scalefusion**, **Microsoft Intune**) for issued devices |
| | **Push** (FCM/APNs) — Google/Apple platforms |

---

### 7. App size optimisation

**Status today:** — N/A (web).

**Action:** None for Platform foundation unless native apps are scoped.

---

### 8. Availability and redundancy (99.5% → 99.9% path)

**Status today:** 🟡 Partial — `/health` does not check Postgres; workers separate from API.

**Fix / deliver**

- [ ] **`GET /health/ready`**: Postgres ping + Redis + optional “outbox lag” metric.
- [ ] Load balancer or reverse proxy **health routing** (stop sending traffic if not ready).
- [ ] Document **worker dependencies** (outbox relay, MF workers, NFO scheduler) in one ops diagram.
- [ ] **Synthetic check** (optional): GitHub scheduled workflow or **UptimeRobot/Better Stack** hitting `/health/ready`.

| In-house | Third party (excl. Cybrilla) |
|----------|------------------------------|
| Ready endpoint, compose/systemd, runbooks | **Uptime monitoring** (**Better Stack**, **Pingdom**, **UptimeRobot**) — cheap external ping |
| | **Hosting** HA (second node, managed DB) as in §5 |

---

### 9. Environments, feature flags, release discipline

**Status today:** 🟡 Partial — strong CI (`zynd-pipeline.yml`), alembic on deploy; flags scattered in env vars.

**Fix / deliver**

- [ ] **`ENV_PARITY_CHECKLIST.md`**: required env keys per env (from `.env.example`), including workers.
- [ ] **Release discipline**: tag releases, changelog snippet for backend deploy, rollback = previous image + DB migration policy.
- [ ] **Feature flags v1 (in-house)**:
  - Pattern A: continue `ZYND_*` in `config.py` (already used for MF, KYC POA, etc.).
  - Pattern B: small `feature_flags` table + cache in Redis for **ops toggles** without redeploy.
  - Admin read-only UI for flag state (optional PF-4).
- [ ] **Poor-network testing**: document Web offline/PWA stance (if any) or manual QA checklist on 3G throttle.

| In-house | Third party (excl. Cybrilla) |
|----------|------------------------------|
| Checklist, flag table/API, CI docs | **Optional:** **LaunchDarkly / Flagsmith** if non-engineers must flip flags daily — not needed for v1 |
| | **GitHub Actions** (already in use) — no new vendor |

---

### 10. Shared component library and design system

**Status today:** ✅ Implemented.

**Fix / deliver (maintenance only)**

- [ ] Periodic **cross-app audit**: button variants, status badges, chart tooltips (Web vs Distributor).
- [ ] Document **where copy lives** (`Web/src/shared/config/copy.ts`) vs Distributor-local strings.

| In-house | Third party (excl. Cybrilla) |
|----------|------------------------------|
| Design/engineering time | **None** |

---

## Third-party summary (Platform foundation only)

Cybrilla is **excluded** from this table (already integrated). Nothing below is mandatory to *start* PF-0/PF-1.

| Need | Typical vendor | When |
|------|----------------|------|
| Hosting / DR | VPS provider, AWS/GCP/Azure (IN region) | PF-3 |
| Uptime probes | Better Stack, UptimeRobot | PF-0 optional |
| Audit WORM export | S3, B2 | Only if compliance asks |
| Event bus at scale | SNS/SQS, Pub/Sub | Only if Redis limits hit |
| Feature flags SaaS | LaunchDarkly, Flagsmith | Only if ops-heavy flag churn |
| LLM routing | OpenAI, Azure OpenAI | AI workstream, not PF-1 |
| MDM + native app | Scalefusion, Intune | Deferred offline app |
| Legal | External counsel | Consent copy / DPDP policy |

---

## PF-0 sprint backlog (concrete tickets)

Use these as first GitHub issues / tasks:

1. Add **`/health/ready`** with DB (+ document Redis/worker expectations).
2. Write **`ENV_PARITY_CHECKLIST.md`** from `Backend/.env.example` + worker envs.
3. Write **`ARCHITECTURE_BOUNDED_CONTEXTS.md`** (1–2 pages + links).
4. Draft **`EVENT_TAXONOMY.md`** from existing domain events (stub future types).
5. Draft **consent purpose registry** for all keys in `domain/consent/keys.py`.
6. Run **backup/restore drill** once; record RTO/RPO in ops doc.
7. Verify prod/staging run **outbox relay** + document in deploy README.

---

## Success criteria (exit “Platform foundation” v1)

- [ ] New engineer can read bounded-context + event taxonomy docs and know where to put code.
- [ ] `/health/ready` used by deploy/monitoring; incident runbook exists.
- [ ] Consent purposes documented; revocable consents reachable from user settings where applicable.
- [ ] Top 3 side effects moved to outbox per ADR-001; no new sync SMTP from request path.
- [ ] Audit matrix covers admin + MF money paths; rules registry v1 exists with ≥1 golden test.
- [ ] Env parity checklist used on every prod deploy.

---

## Related documents

- [ZYND_PLATFORM_CAPABILITY_MATRIX.md](./ZYND_PLATFORM_CAPABILITY_MATRIX.md) — full product matrix
- [ADR-001-event-publishing.md](../../Backend/docs/architecture/ADR-001-event-publishing.md)
- [PHASE_3.md](../../Backend/docs/architecture/PHASE_3.md) — outbox
- [SERVICE_BOUNDARIES.md](../../Backend/docs/architecture/SERVICE_BOUNDARIES.md)
- [RBAC_PERMISSION_MATRIX.md](../../Backend/docs/architecture/RBAC_PERMISSION_MATRIX.md)

---

## Next workstream

When Platform foundation v1 criteria are met, pick **Decision engines** or **Integrations & rails** (e.g. AA) as the next grouped plan file using the same format.
