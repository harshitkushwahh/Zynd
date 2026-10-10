# NFO (New Fund Offer) — Zynd implementation plan

**Status:** Implemented (v1) — see migration `100_nfo_offers`, worker `nfo-scheduler`, admin `/dashboard/mutual-funds/nfo`  

**Last updated:** 2026-10-10 (scheduler orchestration, admin console, invest category, checkout)  
**Reference repo (Multiplus):** `/Users/THUNDERFANG1/Desktop/MultiPlus Core/Main/multiplus` (Java/Quarkus monorepo — **not** in the Zynd git tree)

**Related Zynd docs:**

- [MF_SCHEDULER_PHASES.md](./MF_SCHEDULER_PHASES.md) — Cybrilla + AMFI cron pipeline
- [MF_PAYMENTS_MASTER_LUMPSUM_SIP.md](./MF_PAYMENTS_MASTER_LUMPSUM_SIP.md) — OMS checkout parity with Multiplus

---

## Executive summary

**Goal:** Let Zynd investors **discover**, **understand**, and **subscribe** to mutual funds during their NFO / fresh-offer window, with the same reliability constraints as the existing catalog (empanelled AMCs, Cybrilla OMS investability, KYC + order gates).

**Research finding:** Multiplus does **not** implement a standalone `NFO` microservice or dedicated `GET /nfo` API. NFOs are handled as **regular catalog funds** that appear when:

1. Scheme master data ingests them (AMFI / internal upsert rules),
2. Cybrilla OMS marks them **purchase- and/or SIP-allowed**,
3. Product lifecycle + investability SQL hides non-tradeable rows,
4. UI sorts funds with **missing trailing returns last** (typical for new schemes).

Zynd already shares most of that stack (Cybrilla scheme sync/staging, `fp_oms_purchase_allowed`, `catalog-lifecycle-sync`, `/invest/*`). The plan below adds an explicit **NFO lifecycle model**, a **dedicated NFO scheduler worker** (separate Docker service, chained after MF ingest), **admin console** for NFO jobs and offers, an invest **category `nfo`**, and **checkout reuse** of the existing Cybrilla lumpsum/SIP payment flow.

---

## Glossary

| Term | Meaning |
|------|---------|
| **NFO** | New Fund Offer — initial subscription period for a new scheme (or new share class) before / around regular trading. |
| **Open / close** | Subscription window (NFO period). Often **not** exposed as structured dates in Cybrilla OMS; may appear in SID text (“during NFO: Rs …”) or AMC announcements. |
| **Allotment** | Units credited after NFO close; NAV history often starts at or after allotment. |
| **Investability** | Whether lumpsum and/or SIP is allowed **right now** per OMS (`purchase_allowed`, `sip_allowed`, `active`). |
| **Catalog vs OMS** | Zynd **catalog** = Postgres `products` + `mutual_funds` + governance; **OMS** = Finprim/Cybrilla trading constraints and order execution. |
| **Regular MF** | Open-ended scheme with NAV history, metrics, and collections — current default browse experience. |
| **MF scheduler worker** | Docker service `mf-scheduler` → `python -m app.jobs.run_mf_scheduler --schedule` ([`docker-compose.yml`](../../../docker-compose.yml)). |
| **NFO scheduler worker** | **Proposed** separate service `nfo-scheduler` → `python -m app.jobs.run_nfo_scheduler --schedule`. |
| **Ingestion mutex** | Only one of `{mf-scheduler daily chain, nfo-scheduler run}` may hold the MF ingest lock at a time. |

---

## Reference: Multiplus flow (as-is)

### Repository location

| Item | Path |
|------|------|
| Monorepo root | `/Users/THUNDERFANG1/Desktop/MultiPlus Core/Main/multiplus` |
| Backend (Java) | `backend/src/main/java/com/multiplus/` |
| Webapp | `webapp/src/` |
| DB migrations | `database/migrations/` |

Zynd docs that point at Multiplus (external): [MF_PAYMENTS_MASTER_LUMPSUM_SIP.md](./MF_PAYMENTS_MASTER_LUMPSUM_SIP.md) §7–8.

### Backend layer map (MF catalog + ingest)

```text
com.multiplus.zahaan.officialmf.*     AMFI NAV/AUM/TER, SID PDF pipeline, scheme upsert writers
com.multiplus.zahaan.mf.*             OMS catalog sync, investability, ingestion admin APIs
com.multiplus.zahaan.fund.*           Fund list/detail/compare HTTP APIs
com.multiplus.productmanagement.*     Product catalog, dashboard rails, invest-per-category browse
com.multiplus.payment.fp.*            Finprim token + HTTP client
com.multiplus.payment.service.*       OMS scheme hydration, lumpsum/SIP checkout
```

### Discovery: no dedicated NFO API

Fund browsing for authenticated users:

| API | File | Query params (representative) |
|-----|------|--------------------------------|
| `GET /api/v1/funds` | `zahaan/fund/api/FundController.java` | `category_code`, `amc_code`, `plan_type`, `risk_band`, `is_active`, `sort_by`, `page`, `page_size` |
| `GET /api/v1/funds/{fund_id}/detail` | same | `multiplus_account_no`, `nav_history_years` |
| `GET /api/v1/funds/mobile/returns` | same | Same filters; capped row count |
| `GET /api/v1/products/invest-per-category` | `productmanagement/resource/ProductResource.java` | Pillar/category browse (invest home table) |

**There is no `nfo=true` filter** in `FundController` or `FundListService`. NFO-like funds surface when they pass **active + OMS investability** predicates.

Investability (list + catalog tiles):

- `MutualFundInvestabilityService.java` — requires synced OMS + `(fp_oms_purchase_allowed = 1 OR fp_oms_sip_allowed = 1)` + `fp_oms_active = 1` + empanelled AMC.
- `FundListService.java` — when `is_active=true`, appends the same OMS predicates to SQL `WHERE`.

### Data sync & schedulers

| Job / trigger | Implementation | External source |
|---------------|----------------|-----------------|
| AMFI NAV daily | `officialmf/scheduler/AmfiNavScheduler.java`, parsers under `officialmf/parser/` | AMFI NAV file (see Zynd: `NAVAll.txt` URLs in `.env.example`) |
| AMFI AUM / TER / AAUM | `AmfiAumScheduler`, `AmfiTerScheduler`, `AmfiAverageAumScheduler` | AMFI portal/API (see Zynd `MF_SCHEDULER_PHASES.md` Phase 3) |
| SID min amounts (incl. “during NFO”) | `SidIngestionScheduler.java` → `SidIngestionPipelineService` | AMC SID PDFs; `SidMinAmountExtractor.java` regex `during nfo : … Rs` |
| OMS snapshot refresh | `MutualFundOmsCatalogSyncScheduler.java` (default cron Sun 02:00 IST) | Cybrilla `GET /api/oms/fund_schemes/{isin}` |
| Inception backfill | `FundInceptionDateService.java` | `MIN(scheme_navs.nav_date)` per fund |
| Manual ops | `officialmf/controller/OfficialMfIngestionController.java` | Triggers NAV, AUM, TER, OMS full refresh, inception populate, etc. |

### External APIs (Cybrilla / Finprim)

Documented in Multiplus hydration code:

| Operation | HTTP | Client |
|-----------|------|--------|
| OMS scheme by ISIN | `GET /api/oms/fund_schemes/{isin}` | `FintechPrimitivesClient.getOmsFundSchemeByIsinWithToken` |
| Holdings / MFIA | `GET /api/oms/investment_accounts/{id}/holdings` | same client |

Persisted on `mutual_funds` (MySQL) including `fp_oms_purchase_allowed`, `fp_oms_sip_allowed`, min amounts, `sip_frequency_specific_data` JSON — see `MutualFundOmsSchemeHydrationService.java` (Zynd equivalent: `scheme_row_normalizer.py`, `investment_constraints.py`).

**AMFI** does not drive investability in Multiplus; it enriches NAV, AUM, TER, scheme naming, and SID-derived mins. **Cybrilla OMS** is the source of truth for **can invest today**.

### Database entities (Multiplus)

Core tables (MySQL, `V001` / `V002` migrations):

- `mutual_funds` — scheme identity, `inception_date`, `scheme_status`, `fp_oms_*` flags, min amounts
- `products` — catalog wrapper, `lifecycle_status`, active window
- `scheme_navs`, `scheme_aums`, `scheme_ter` — official MF metrics
- `fund_amcs` — empanelment / active flags
- Product taxonomy: `categories`, `product_categories`

**NFO-specific columns:** none found. Comment in `V002__baseline_schema_consolidated.sql` mentions “no fresh subscriptions post-NFO” only as **scheme-name exclusion** logic for closed-ended “Capital Builder” products (`mf_scheme_qualifies_for_product_catalog` function), not live NFO windows.

### Relationship: regular catalog vs NFO-only funds

| Aspect | Regular open-ended fund | NFO / new scheme |
|--------|-------------------------|------------------|
| Enters catalog | AMFI upsert + product rules + OMS sync | Same path — **new ISIN** must appear in ingest |
| NAV / returns | Rich `scheme_navs` → metrics | Often **empty or shallow** NAV; returns null |
| List sort | Category rank / returns | Webapp pushes **incomplete returns last** (`investBrowseReturnSort.js`) |
| Invest gate | OMS purchase/SIP allowed | Same; NFO period usually `purchase_allowed=true` when open |
| Close-ended NFO | Excluded by name rules (`close ended`, `fixed horizon`, etc.) | `MutualFundUpsertService.java` name gates |

### Webhooks & admin

- **Webhooks:** MF order state via Finprim webhooks (payments module) — not NFO-specific.
- **Admin:** `OfficialMfIngestionController` manual ingest; product enable/disable under `productmanagement`; fund admin via `admin` services. No “NFO admin” screen found.

### Multiplus → Zynd parity summary

| Capability | Multiplus | Zynd today |
|------------|-----------|------------|
| Scheme discovery | AMFI + internal writers + OMS | Cybrilla `list_fund_schemes` + staging ([Phase 15](./MF_SCHEDULER_PHASES.md)) |
| Investability flags | `fp_oms_*` on `mutual_funds` | Same columns ([`mf_models.py`](../../app/infrastructure/persistence/mf_models.py)) |
| List APIs | `/api/v1/funds`, products browse | `/api/v1/invest/funds`, `/invest/home` |
| NFO collection / badge | **Not found** | **Not implemented** |
| NFO open/close dates | **Not stored** | **Not stored** |
| SID “during NFO” min | `SidMinAmountExtractor.java` | **TBD** (Zynd has `scheme-min-amounts-backfill` from OMS, not SID PDF) |

---

## Zynd context (existing MF architecture)

Brief map — **do not duplicate** full scheduler docs.

| Layer | Location |
|-------|----------|
| Invest HTTP | `Backend/app/api/v1/invest/router.py` |
| Catalog / home | `invest_home_service.py`, `catalog_governance_service.py` |
| Lifecycle | `catalog_lifecycle_service.py` — promotes when `fp_oms_purchase_allowed` |
| Cybrilla ingest | `cybrilla_scheme_sync_service.py`, staging in Phase 15 |
| OMS client | `infrastructure/mf/fp_oms_client.py` — `list_fund_schemes`, `get_fund_scheme_by_isin` |
| AMFI | `amfi_nav_ingestion_service.py`, `amfi_scheme_master_service.py` |
| Jobs registry | `mf_scheduler_jobs.py`, `run_mf_scheduler.py` |
| Orders | `mf_order_service.py`, `investment_constraints.py` |
| Web | `Web/src/features/invest/` |

**Important Zynd rule (Phase 1):** AMFI NAV daily **does not create** new `mutual_funds` rows — Cybrilla (or staging promote) must create the scheme first. NFO plans must align with that rule.

---

## Proposed Zynd architecture

### Design principles

1. **OMS investability remains authoritative** for “Subscribe now” (reuse `investment_constraints` + governance).
2. **NFO is a catalog annotation + filter**, not a separate product type — unless closed-ended NFOs are explicitly out of scope.
3. **Open/close dates** are best-effort: prefer Cybrilla/AMFI when available; allow **admin override** for marketing windows.
4. **Missing metrics are expected** — NFO list UX must not depend on 1Y/3Y returns.

### Layer diagram

```mermaid
flowchart TB
  subgraph external [External systems]
    AMFI[AMFI NAV / scheme master]
    FP[Cybrilla Finprim OMS]
  end

  subgraph workers [Docker workers proposed]
    MF_W[mf-scheduler container]
    NFO_W[nfo-scheduler container]
  end

  subgraph ingest [Zynd ingest jobs]
    CYB[cybrilla-scheme-ingest / promote]
    NAV[amfi-nav-daily]
    MASTER[amfi-scheme-master-sync]
    OMS_H[scheme-min-amounts-backfill]
    NFO_JOB[nfo-lifecycle-sync]
  end

  subgraph store [PostgreSQL]
    MF[mutual_funds]
    NFO[nfo_offers proposed]
    PROD[products]
  end

  subgraph app [Application services]
    DET[nfo_detection_service proposed]
    LIST[invest_home_service + nfo_list_service]
    GOV[catalog_governance_service]
    ORD[mf_order_service]
  end

  subgraph api [API]
    INV["/invest/nfo/* proposed"]
    ADM["/admin/mf/nfo/* proposed"]
  end

  MF_W --> CYB
  MF_W --> NAV
  FP --> CYB --> MF
  AMFI --> NAV --> MF
  AMFI --> MASTER
  FP --> OMS_H --> MF
  MF_W -. successful daily chain .-> NFO_W
  NFO_W --> NFO_JOB
  MF --> DET --> NFO
  NFO --> LIST
  MF --> GOV --> LIST
  LIST --> INV
  NFO --> ADM
  LIST --> ORD
```

### Proposed modules (Python)

| Module | Responsibility |
|--------|----------------|
| `nfo_detection_service.py` | Derive/update NFO phase from signals (inception, NAV depth, OMS flags, age) |
| `nfo_offer_service.py` | CRUD for curated copy, featured window, manual open/close override |
| `nfo_list_service.py` | Query layer for list/detail DTOs used by invest API |
| `run_nfo_scheduler.py` | **New worker entrypoint** — cron loop for NFO-only jobs (not mixed into `run_mf_scheduler.py`) |
| `nfo_scheduler_jobs.py` | Job registry: `nfo-lifecycle-sync`, `nfo-collection-assign-sync` |
| `nfo_ingestion_mutex_service.py` | Shared lock with MF worker: block NFO while MF chain running and vice versa |
| `nfo_chain_trigger_service.py` | After MF daily success, signal NFO worker to start immediately (Redis / DB flag) |
| `invest_nfo_mappers.py` | API shapes for Web (badges, disclaimers, empty returns) |

Integrate with existing:

- `catalog_lifecycle_service.py` — NFO funds still require `fp_oms_purchase_allowed` for `ACTIVE` unless admin `FORCE_SHOW` with `BLOCK_ORDERS`
- `invest_catalog_cache.py` — invalidate on NFO job + admin edits

---

## API surface (proposed)

Base prefix: `/api/v1/invest` (investor session + existing visibility rules).

### Invest (read)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/invest/nfo` | Paginated NFO list (`status=open\|upcoming\|recently_allotted`, `category`, `amc`) |
| `GET` | `/invest/nfo/{product_id}` | Detail: offer window, min amounts, OMS modes, data-quality flags, SID/OMS disclaimer |
| `GET` | `/invest/home` | **Extend** payload: ensure category slug **`nfo`** appears in categories/collections; optional `nfo_carousel` |
| `GET` | `/invest/categories/nfo/funds` | Same as other category pages — funds assigned by `nfo-collection-assign-sync` |

Existing reuse:

- `GET /invest/funds/{product_id}` — extend with optional `nfo` block (non-breaking)
- `POST /invest/orders` — no change to shape; enforce NFO-specific copy in UI only unless OMS rejects

### Admin

| Method | Path | Permission | Purpose |
|--------|------|------------|---------|
| `GET` | `/admin/mf/nfo` | `mf.catalog.read` | List detected + curated NFO rows |
| `GET` | `/admin/mf/nfo/category` | `mf.catalog.read` | Browse-category `nfo` membership for admin curation |
| `GET` | `/admin/mf/nfo/jobs` | `mf.jobs.read` | NFO job library (cron, last run, processed counts) |
| `PATCH` | `/admin/mf/nfo/{product_id}` | `mf.catalog.manage` | Override dates, featured, hide, marketing copy |
| `POST` | `/admin/mf/nfo/jobs/{job_name}/run` | `mf.jobs.run` | Manual NFO job trigger |
| `GET` | `/admin/mf/nfo/scheduler/status` | `mf.jobs.read` | Worker health, last chain trigger, mutex holder |
| `GET` | `/admin/mf/nfo/ingestion-runs` | `mf.jobs.read` | NFO job run history (filter `job_name` prefix `nfo-`) |

Reuse patterns from existing [`mf_router.py`](../../app/api/v1/admin/mf_router.py) (`GET /admin/mf/jobs`, `GET /admin/mf/ingestion-runs`, `POST /admin/mf/jobs/{job_name}/run`).

Update `permission_matrix.py` when routes are added.

---

## External integrations — who owns what

| Data | Owner | Zynd source | Notes |
|------|-------|-------------|-------|
| New scheme ISIN / name | Cybrilla OMS | `GET /api/oms/fund_schemes` (paged), staging promote | Creates `mutual_funds` |
| Purchase / SIP allowed | Cybrilla OMS | `purchase_allowed`, `sip_allowed`, `active` on scheme JSON | Drives invest buttons |
| Min lumpsum / SIP | Cybrilla OMS (primary) | `scheme-min-amounts-backfill` job | Multiplus also parses SID “during NFO” |
| NAV history | AMFI | `NAVAll.txt` → `scheme_navs` | Match existing ISINs only |
| Scheme code / AMFI row | AMFI | `amfi-scheme-master-sync` | Reference + bridge to `mutual_funds` |
| NFO subscription calendar | AMC / SID / manual | **Gap** — propose `nfo_offers` admin override | Verify Cybrilla payload for date fields in sandbox |
| Order execution | Cybrilla OMS + PG | Existing lumpsum/SIP flow | Same as regular MF |

---

## Data model sketch (proposed)

### Option A — columns on `mutual_funds` (minimal)

```text
nfo_status          ENUM('NOT_NFO','UPCOMING','OPEN','CLOSED','ALLOTTED') NULL
nfo_open_date       DATE NULL
nfo_close_date      DATE NULL
nfo_allotment_date  DATE NULL
nfo_source          VARCHAR(32)  -- 'HEURISTIC','ADMIN','CYBRILLA'
nfo_updated_at      TIMESTAMPTZ
```

### Option B — side table (recommended for audit + marketing)

```text
nfo_offers (
  id UUID PK,
  product_id UUID FK products UNIQUE,
  mutual_fund_id INT FK mutual_funds,
  status ENUM(...),
  subscription_open_date DATE,
  subscription_close_date DATE,
  allotment_date DATE,
  is_featured BOOLEAN,
  marketing_headline TEXT,
  marketing_body TEXT,
  source VARCHAR(32),
  admin_override BOOLEAN,
  created_at, updated_at
)
```

**Detection inputs (heuristic v1):**

- `fp_oms_purchase_allowed = true` AND (nav row count ≤ N **or** fund age since `products.created_at` ≤ X days)
- Optional: name contains `"NFO"` / `"New Fund"` (low trust)
- Transition to `ALLOTTED` when NAV depth ≥ threshold and inception stable

**Verify in Cybrilla sandbox:** whether scheme JSON includes structured NFO dates — if yes, prefer over heuristics (`TBD / verify Multiplus` — not observed in Multiplus Java models).

### Collections

Add **invest category** slug **`nfo`** (display name “NFO” / “New fund offers”) in category/collection definitions and auto-assign in `nfo-collection-assign-sync` (mirror `collection-assign-sync`). This is the **primary browse entry** on the retail app — not a hidden collection only.

---

## Sync / listing lifecycle

```mermaid
sequenceDiagram
  participant FP as Cybrilla OMS
  participant CYB as cybrilla-scheme-promote
  participant AMFI as AMFI NAV
  participant NFO as nfo-lifecycle-sync
  participant CAT as catalog-lifecycle-sync
  participant API as /invest/nfo

  FP->>CYB: New ISIN in fund_schemes
  CYB->>CYB: mutual_funds + products DRAFT
  CAT->>CAT: fp_oms_purchase_allowed → ACTIVE
  AMFI->>AMFI: NAV row when ISIN appears in NAVAll
  NFO->>NFO: Classify OPEN vs ALLOTTED
  NFO->>API: Curated list + badges
  Note over API: Orders use existing POST /invest/orders
```

| Stage | User-visible | Backend state |
|-------|--------------|---------------|
| Discovery | — | Cybrilla ingest only |
| Staged | — | Mongo staging / DRAFT product |
| Open NFO | Listed in NFO hub, subscribe CTA | ACTIVE + OMS purchase/SIP + `nfo_status=OPEN` |
| Closed, awaiting allotment | “Allotment pending” | OMS may disable purchase; still show detail |
| Allotted / regular | Moves to normal browse; optional “Recently launched” | NAV metrics populate; NFO badge drops |

---

## NFO scheduler worker (separate from MF scheduler)

### Why a second Docker service

MF ingestion already runs in an isolated container (`mf-scheduler`). NFO classification must **not** extend the MF cron table blindly — it needs:

1. **Strict ordering** — run only after the MF daily chain has **succeeded** (Cybrilla promote, lifecycle, NAV/metrics as configured).
2. **Mutual exclusion** — while MF scheduler is running its daily jobs, NFO scheduler **must not** start; while NFO scheduler is running, MF scheduler **must not** start a new daily chain.
3. **Independent ops** — restart, logs, and deploy guard for NFO without touching `mf-scheduler` (same pattern as [`mf_scheduler_deploy_guard.py`](../../app/application/mf/mf_scheduler_deploy_guard.py)).

### Proposed `docker-compose` service

```yaml
# Planning only — add to docker-compose.yml / prod overlay when implemented
nfo-scheduler:
  build:
    context: ./Backend
  command: python -m app.jobs.run_nfo_scheduler --schedule
  env_file:
    - ./Backend/.env
  environment:
    DATABASE_URL: postgresql+asyncpg://zynd:zynd@postgres:5432/zynd
    REDIS_URL: redis://redis:6379/0
    ZYND_NFO_INGESTION_ENABLED: "true"
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
  restart: unless-stopped
```

Env knobs (proposed):

| Variable | Purpose |
|----------|---------|
| `ZYND_NFO_INGESTION_ENABLED` | Master kill switch |
| `ZYND_NFO_SCHEDULER_TIMEZONE` | Default `Asia/Kolkata` |
| `ZYND_NFO_CHAIN_AFTER_MF_ENABLED` | If true, primary trigger = MF success |
| `ZYND_NFO_FALLBACK_CRON` | Default `0 22 * * *` — **22:00 IST (10:00 PM)** safety run |
| `ZYND_MF_NFO_MUTEX_KEY` | Redis lock name shared by both workers |

### Orchestration rules

```mermaid
flowchart TD
  MF_START[MF scheduler slot fires e.g. evening IST]
  MF_CHAIN[MF daily job chain runs]
  MF_OK{MF chain succeeded?}
  MF_FAIL[Log failure; NFO chain trigger skipped]
  TRIGGER[Set nfo_pending_after_mf flag in Redis/DB]
  NFO_WAKE[NFO worker picks up flag immediately]
  NFO_RUN[nfo-lifecycle-sync + nfo-collection-assign-sync]
  FALLBACK[22:00 IST cron tick]
  MUTEX{Ingest mutex free?}
  SKIP[Skip — MF or NFO already running]
  DONE[Mark nfo_daily_complete for date]

  MF_START --> MF_CHAIN --> MF_OK
  MF_OK -->|no| MF_FAIL
  MF_OK -->|yes| TRIGGER --> NFO_WAKE --> MUTEX
  FALLBACK --> MUTEX
  MUTEX -->|busy| SKIP
  MUTEX -->|free| NFO_RUN --> DONE
```

| Rule | Behavior |
|------|----------|
| **Primary trigger** | When `mf-scheduler` finishes the configured **daily success boundary** (proposed: last job in evening chain, e.g. after `catalog-lifecycle-sync` + `amfi-nav-daily` + `nav-metrics-compute` — exact list configurable), set `nfo_pending_after_mf=1` with run metadata (MF `ingestion_run_log` UUID). NFO worker loop polls every N seconds (e.g. 30s) or subscribes via Redis pub/sub and **starts NFO jobs immediately**. |
| **Example timing** | If MF window starts ~20:00 IST and completes ~21:30 IST, NFO runs ~21:30 IST same night — **not** waiting until 22:00. |
| **Fallback trigger** | **Daily at 22:00 IST (10:00 PM)** if no successful NFO run yet for that calendar date **and** primary chain trigger did not run (MF failed, worker down, flag lost). Ensures NFO data refreshes at least once per day. |
| **Mutex** | Extend [`has_running_job`](../../app/application/mf/ingestion_run_service.py) or add `begin_mf_family_ingestion_run()` that rejects when **any** job in `{mf-scheduler registry, nfo-scheduler registry}` is `running`. Admin “Run job” buttons respect the same lock. |
| **Idempotency** | If NFO already succeeded for `as_of_date` today, chain trigger and fallback are no-ops. |

NFO job registry (runs **inside `nfo-scheduler` only**):

| Job | Depends on | Notes |
|-----|------------|-------|
| **`nfo-lifecycle-sync`** | MF catalog fresh for day | Classify OPEN / CLOSED / ALLOTTED; upsert `nfo_offers` |
| **`nfo-collection-assign-sync`** | `nfo-lifecycle-sync` | Assign category slug `nfo` |

MF jobs stay in [`mf_scheduler_jobs.py`](../../app/application/mf/mf_scheduler_jobs.py) / [`run_mf_scheduler.py`](../../app/jobs/run_mf_scheduler.py). Document NFO worker in this file + cross-link from [MF_SCHEDULER_PHASES.md](./MF_SCHEDULER_PHASES.md) when implemented.

---

## Admin console UI plan (NFO)

### Navigation

Add a **dedicated admin area** parallel to the existing Mutual Funds console — not only a tab buried in Operations.

| Route (proposed) | Purpose |
|------------------|---------|
| `/dashboard/mutual-funds/nfo` | **NFO admin home** — scheduler, offers, category membership |

Alternative: new top-level sidebar item **“NFO”** under the same MF product area; avoid mixing NFO scheduler rows into the generic MF pipeline preview without labels.

Reference layout: [`Admin/src/app/dashboard/mutual-funds/page.tsx`](../../../Admin/src/app/dashboard/mutual-funds/page.tsx) (tabs: overview, health, staging, funds, **operations**). NFO page reuses the same shell components (`AdminSectionPageShell`, metric cards, tables).

### Page sections

| Section | Content | Reuse from MF admin |
|---------|---------|---------------------|
| **Overview** | Counts: open / upcoming / closed NFOs, featured, stale OMS flags | `fetchMfOverview` pattern |
| **Scheduler & runs** | NFO worker status, mutex holder (MF vs NFO), last MF chain success, last chain-trigger time, next fallback (22:00 IST), job list with cron descriptions | [`MfOperationsPanel`](../../../Admin/src/components/mf/mf-operations-panel.tsx), [`MfPipelineAutoPanel`](../../../Admin/src/components/mf/mf-pipeline-auto-panel.tsx) — **NFO-scoped** |
| **Ingestion history** | Table of `ingestion_run_logs` where `job_name` ∈ `nfo-*` | `GET /admin/mf/ingestion-runs` with filter |
| **Offers table** | All `nfo_offers` + linked fund: status, open/close, OMS purchase/SIP, admin override | New panel; fund drawer links to existing fund detail |
| **Category `nfo`** | Read-only count + link to category curation; which product_ids auto-assigned | [`CategoryCurationPanel`](../../../Admin/src/components/mf/category-curation-panel.tsx) |
| **Actions** | Run `nfo-lifecycle-sync` manually, clear stuck runs (NFO-only), disable featured | Permissions: `mf.jobs.run`, `mf.catalog.manage` |

### Scheduler detail UX (must-have)

Ops should see the same clarity as MF Operations:

- Last **MF daily chain** outcome (success/fail + timestamp) — read-only from MF ingestion runs.
- Whether **NFO ran via chain trigger** vs **22:00 fallback** vs **manual**.
- Live indicator if **mutex blocked** a start (“MF scheduler running — NFO queued”).
- Prometheus/metrics hook optional (`get_mf_prometheus_metrics` pattern) for `nfo_scheduler_*`.

---

## Investor UI plan (Mutual Funds + category `nfo`)

### Category as first-class browse

| Surface | Behavior |
|---------|----------|
| **Invest home** | Show **`nfo`** in categories/collections rail (same as Equity, Debt, etc.) with copy e.g. “New fund offers”. |
| **Route** | `/dashboard/mutual-funds/collections/nfo` (reuse [`mf-collection-page.tsx`](../../../Web/src/features/invest/components/mf-collection-page.tsx)) **or** dedicated `/dashboard/mutual-funds/nfo` if layout differs. |
| **Category slug** | **`nfo`** — backend `InvestCategory.slug`; populated by `nfo-collection-assign-sync`. |
| **All funds browse** | Optional filter chip “NFO” via [`mf-browse-category-tabs.tsx`](../../../Web/src/features/invest/components/mf-browse-category-tabs.tsx) / category tabs. |
| **Fund cards** | Badge “NFO”, subscription close date, **hide 1Y/3Y return** or show “—”; sort missing returns last. |
| **Fund detail** | NFO banner, min investment, disclaimer; calculator only when NAV exists. |

No separate payment UI — tapping invest uses the **same** fund detail + cart + checkout as regular MF.

### Wireframe (logical)

```text
Mutual Funds home
  ├── Categories row  →  [ Equity | Debt | Hybrid | … | NFO ]
  └── Featured NFO carousel (optional)

/dashboard/mutual-funds/collections/nfo
  └── Grid of NFO funds (open first)

/dashboard/mutual-funds/{slug}  (fund detail)
  └── Invest CTA → existing mf-invest-payment-card flow
```

---

## Purchasing & payments (reuse Cybrilla flow)

NFO subscription **does not** introduce a new payment rail or OMS API.

| Step | Zynd today | NFO plan |
|------|------------|----------|
| Eligibility | `investment_constraints.py`, `fp_oms_purchase_allowed` / SIP | Same — NFO must be OMS-allowed |
| Lumpsum | `POST /invest/orders` → Cybrilla OMS + PG ([MF_PAYMENTS_MASTER_LUMPSUM_SIP.md](./MF_PAYMENTS_MASTER_LUMPSUM_SIP.md)) | **Reuse unchanged** |
| SIP | SIP plan + mandate flow | Reuse if OMS `sip_allowed` during NFO |
| Cart | `mf_cart_service.py` | Same product_id |
| Webhooks | `mf_webhook_service.py` | Same order lifecycle |
| Copy only | — | UI disclaimers: allotment NAV, NFO period, no guaranteed returns |

**Verify in sandbox:** NFO ISIN accepts the same `create purchase` payload as mature schemes — expected yes (Multiplus uses identical path).

---

## Scheduler / jobs (summary table)

| Job | Worker | Depends on | Schedule |
|-----|--------|------------|----------|
| MF jobs (Cybrilla, NAV, metrics, …) | `mf-scheduler` | — | Existing [MF_SCHEDULER_PHASES.md](./MF_SCHEDULER_PHASES.md) |
| **`nfo-lifecycle-sync`** | `nfo-scheduler` | Successful MF daily boundary + mutex | **Immediately after MF success** |
| **`nfo-collection-assign-sync`** | `nfo-scheduler` | `nfo-lifecycle-sync` | Same run, sequential |
| **NFO fallback bundle** | `nfo-scheduler` | Mutex free, no success today | **`0 22 * * *` IST (10:00 PM)** |

---

## Frontend touchpoints (summary)

See **Investor UI plan** and **Admin console UI plan** above. Implementation roots:

- Web: `Web/src/features/invest/` — `mf-collection-page.tsx`, `mf-fund-detail-view.tsx`, `mf-invest-payment-card.tsx`
- Admin: new `Admin/src/app/dashboard/mutual-funds/nfo/` + `Admin/src/components/mf/nfo-*`

**Multiplus UX note:** `investBrowseReturnSort.js` deprioritizes empty returns — reuse for NFO category sorts.

---

## Open questions / gaps

| # | Question | Action |
|---|----------|--------|
| 1 | Does Cybrilla `fund_schemes` return **NFO open/close** dates? | Capture sample JSON in sandbox; compare Multiplus `MutualFundOmsSchemeHydrationService` applied fields |
| 2 | Are **closed-ended NFOs** in scope for Zynd retail? | Multiplus excludes via scheme name SQL — confirm product policy |
| 3 | Should Zynd ingest **SID PDF** mins (“during NFO”) like Multiplus? | Cost/benefit vs OMS-only `scheme-min-amounts-backfill` |
| 4 | Distributor / Mitra surfaces for NFO? | Out of scope v1 unless parity required |
| 5 | Recommendations / “Funds for you” including NFO? | Likely exclude until metrics exist (`FundEligibilityFilterService` pattern in Multiplus) |
| 6 | **`amfi-scheme-master`** vs Cybrilla for **first discovery** | Zynd Phase 16 master is reference-only for NAV match — do not auto-create funds from AMFI alone |
| 7 | Exact **MF daily success boundary** for chain trigger | Config list of job names that must succeed before NFO starts |
| 8 | Fallback at **22:00 IST** vs literal midnight | Product default 22:00 IST; add `00:10` second safety only if ops requires |

---

## Phased rollout recommendation

### Phase 0 — Discovery & sandbox proofs (1–2 weeks)

- Dump Cybrilla scheme payloads for known NFO ISINs (sandbox).
- Confirm order path: `POST /invest/orders` succeeds for NFO with only OMS flags (no extra NFO API on FP).
- Product/legal copy for NFO disclaimers.

### Phase 1 — Backend NFO classification + worker (2–3 weeks)

- Migration for `nfo_offers` (or columns).
- `run_nfo_scheduler.py`, Docker `nfo-scheduler`, mutex + chain-after-MF + 22:00 IST fallback.
- `nfo-lifecycle-sync` + `nfo-collection-assign-sync` (category slug **`nfo`**).
- Invest APIs: `/invest/nfo` and/or category-backed list.

### Phase 2 — Admin NFO console (1–2 weeks)

- `/dashboard/mutual-funds/nfo` — scheduler status, ingestion runs, offers table, manual job run.

### Phase 3 — Invest UX (2 weeks)

- Category **`nfo`** on home + collection page; badges on detail; missing returns last.

### Phase 4 — Admin curation (1 week)

- Featured NFO, manual dates, audit via existing catalog write patterns.

### Phase 5 — Enrichment (optional)

- SID ingestion port (Multiplus `SidMinAmountExtractor` parity).
- Notifications (“NFO closing in 3 days”) — outbox pattern per ADR-001.

---

## Appendix: Multiplus file index (NFO-adjacent)

| Topic | Path under Multiplus root |
|-------|---------------------------|
| Fund list + OMS filters | `backend/.../zahaan/fund/service/FundListService.java` |
| Investability SQL | `backend/.../zahaan/mf/service/MutualFundInvestabilityService.java` |
| OMS hydration | `backend/.../payment/service/MutualFundOmsSchemeHydrationService.java` |
| OMS catalog batch sync | `backend/.../zahaan/mf/service/MutualFundOmsCatalogSyncService.java` |
| OMS scheduler | `backend/.../zahaan/mf/scheduler/MutualFundOmsCatalogSyncScheduler.java` |
| FP client OMS paths | `backend/.../payment/fp/service/FintechPrimitivesClient.java` |
| SID “during NFO” parse | `backend/.../zahaan/officialmf/parser/SidMinAmountExtractor.java` |
| Inception from NAV | `backend/.../zahaan/fund/service/FundInceptionDateService.java` |
| Manual ingest API | `backend/.../zahaan/officialmf/controller/OfficialMfIngestionController.java` |
| Closed-ended name gate | `database/migrations/V002__baseline_schema_consolidated.sql` (`mf_scheme_qualifies_for_product_catalog`) |
| Returns sort (NFO-empty) | `webapp/src/utils/investBrowseReturnSort.js` |

---

*This document is a Zynd forward plan informed by Multiplus as-is behavior. Where Multiplus has no explicit NFO feature, sections are marked TBD and should be validated against Cybrilla sandbox data before build.*
