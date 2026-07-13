# MF Scheduler — phased build plan

Zynd mutual fund data runs as **cron workers** under `app/jobs/run_mf_scheduler.py`.
Each phase adds jobs, tables, and config gates. Earlier phases must succeed before later ones matter.

## Daily timeline (IST)

```text
20:00  cybrilla-scheme-ingest      Phase 15 — Cybrilla → Mongo staging
20:02  cybrilla-scheme-validate    Phase 15 — validate staged rows
20:05  cybrilla-scheme-promote     Phase 15 — Mongo → SQL (draft products)
20:15  catalog-lifecycle-sync      Phase 5 — DRAFT→ACTIVE promotion
21:00  amfi-nav-daily              Phase 1 — NAV overlay (ISIN match only)
22:00  nav-metrics-compute         Phase 2 — returns from NAV history
22:15  fund-classification-compute Phase 2 — cap/theme tags from scheme metadata
22:25  collection-assign-sync      Phase 2 — curated collection membership
23:30  composite-rank-compute      Phase 2 — category rankings

Monthly (1st):
  09:00  amfi-aum-monthly       Phase 3 — fund size
  10:00  amfi-ter-monthly       Phase 3 — expense ratio

Quarterly (15th Jan/Apr/Jul/Oct):
  11:30  amfi-aaum-quarterly    Phase 3 — average AUM (optional)

Every 2h:
       stale-run-cleanup        Phase 1 — ops

Daily (before scheme sync):
  18:30  nav-cold-start-backfill Phase 4 — historical NAV if below threshold
```

## Phase 0 — Foundation ✅

**Status:** Done

| Deliverable | Location |
|-------------|----------|
| Postgres schema (funds, NAV, products, categories) | `035_mf_foundation` |
| Config hub | `app/core/config.py` (`ZYND_MF_*`) |
| Scheduler daemon | `app/jobs/run_mf_scheduler.py` |
| Raw archive | Mongo `zynd_mf_raw.raw_ingestions` metadata + gzip object in `ZYND_MF_RAW_BUCKET` (local or S3/MinIO) |
| Docker worker | `docker-compose.yml` → `mf-scheduler` |

## Phase 1 — Core ingest ✅

**Status:** Done

| Job | Source | Output |
|-----|--------|--------|
| `cybrilla-scheme-sync` | FinPrim `/api/oms/fund_schemes` | `mutual_funds`, `fund_amcs`, `products` |
| `amfi-nav-daily` | AMFI `NAVAll.txt` | `scheme_navs` (existing ISINs only) |
| `stale-run-cleanup` | Internal | Failed stuck `ingestion_run_logs` |

**Rule:** Cybrilla creates schemes; AMFI never creates new `mutual_funds` rows.

**Run order:**
```bash
python -m app.jobs.run_mf_scheduler --job cybrilla-scheme-sync
python -m app.jobs.run_mf_scheduler --job amfi-nav-daily
```

## Phase 2 — Analytics pipeline

**Status:** Implemented in `036_mf_analytics`

| Job | Input | Output |
|-----|-------|--------|
| `nav-metrics-compute` | `scheme_navs` | `fund_nav_metrics` (1D→5Y returns) |
| `fund-classification-compute` | `mutual_funds` | `fund_derived_attributes` (cap/theme tags) |
| `collection-assign-sync` | metrics + derived attrs | `product_categories` for 6 collection slugs |
| `composite-rank-compute` | `fund_nav_metrics` + categories | `fund_composite_ranks` |

**Config:**
- `ZYND_MF_METRICS_ENABLED=true`
- `ZYND_MF_METRICS_BATCH_SIZE=50`

**Depends on:** Phase 1 NAV rows existing for touched funds.

## Phase 3 — Enrichment (monthly / quarterly)

**Status:** Implemented

| Job | Source | Output | Match key |
|-----|--------|--------|-----------|
| `amfi-aum-monthly` | `portal.amfiindia.com/spages/am{mon}{year}repo.xls` (+ optional scheme-wise URL) | `scheme_aums` (`AMFI_MONTHLY`) | `scheme_code` |
| `amfi-ter-monthly` | AMFI `/api/populate-te-rdata-revised` (paginated JSON) + GitHub tracker fallback | `scheme_ter` | `scheme_name` (Regular plans) |
| `amfi-aaum-quarterly` | AMFI `/api/average-aum-schemewise` JSON | `scheme_aums` (`AMFI_AAUM`) | `AMFI_Code` → `scheme_code` |

**Config:**
- `ZYND_MF_AUM_INGESTION_ENABLED=true`
- `ZYND_MF_TER_INGESTION_ENABLED=true`
- `ZYND_MF_AAUM_ENABLED=true`
- `ZYND_MF_AMFI_AUM_SCHEME_WISE_DATA_URL` — optional fallback when monthly repo XLS is category-only
- `ZYND_MF_TER_PAGE_SIZE=500` — AMFI TER pagination (125 pages vs 6224 at size 10)

## Phase 4 — Ops & cold start

**Status:** Implemented

| Feature | Location |
|---------|----------|
| `nav-cold-start-backfill` | `nav_cold_start_backfill_service.py` — AMFI history windows when NAV depth is shallow |
| Admin job trigger | `POST /admin/mf/jobs/{name}/run` (`mf.jobs.run`) |
| Job dependency guard | `mf_job_runner_service.py` + `check_job_dependencies()` |
| Prometheus metrics | `GET /admin/mf/metrics` (`mf.jobs.read`) |

**Config:**
- `ZYND_MF_COLD_START_BACKFILL_ENABLED=true`
- `ZYND_MF_COLD_START_BACKFILL_THRESHOLD=1000`
- `ZYND_MF_COLD_START_BACKFILL_FROM_DATE=2006-04-01`
- `ZYND_MF_COLD_START_ON_STARTUP=true` — auto backfill when scheduler starts
- `ZYND_MF_DEPENDENCY_GUARD_ENABLED=true`
- `ZYND_MF_DEPENDENCY_LOOKBACK_HOURS=24`

**Admin API:**
```bash
GET  /admin/mf/jobs
GET  /admin/mf/ingestion-runs?job_name=amfi-nav-daily
GET  /admin/mf/metrics
POST /admin/mf/jobs/nav-cold-start-backfill/run?force=true
POST /admin/mf/jobs/amfi-nav-daily/run
```

## Phase 5 — Catalog lifecycle

**Status:** Implemented

| Feature | Location |
|---------|----------|
| Auto `DRAFT → ACTIVE` | `catalog_lifecycle_service.py` + job `catalog-lifecycle-sync` |
| AMC empanelment admin | `PATCH /admin/mf/amcs/{id}` (`mf.amcs.manage`) |
| AMC logo ingest | `amc_logo_ingestion_service.py` + job `amc-logo-ingest` |
| Invest-home API | `GET /invest/home`, `/invest/categories`, `/invest/funds`, `/invest/funds/{id}` |

**Promotion rule:** `fund_amcs.is_active = true` AND `mutual_funds.fp_oms_purchase_allowed = true` AND fund row active.

**Config:**
- `ZYND_MF_CATALOG_LIFECYCLE_ENABLED=true`
- `ZYND_MF_CATALOG_LIFECYCLE_CRON=15 20 * * *` (after scheme sync)
- `ZYND_MF_AMC_LOGO_INGEST_ENABLED=false` (enable when logo source configured)
- `ZYND_MF_AMC_LOGO_URL_TEMPLATE=https://example.com/logos/{slug}.png`
- `ZYND_MF_AMC_LOGO_MANIFEST_URL=` optional JSON slug→url map

**Ops flow:**
```bash
# 1. Sync schemes from Cybrilla
python -m app.jobs.run_mf_scheduler --job cybrilla-scheme-sync

# 2. Empanel AMCs via admin
PATCH /admin/mf/amcs/{id}  {"is_active": true}

# 3. Promote eligible products
python -m app.jobs.run_mf_scheduler --job catalog-lifecycle-sync
```

**Invest API (authenticated user):**
```bash
GET /invest/home
GET /invest/funds?category=equity&sort=return_3y
GET /invest/funds/{product_id}
```

## Phase 6 — Transactions (not scheduler)

**Status:** Implemented

Cybrilla orders and MF Central CAS run as **separate workers** (`mf-order-worker`, `mf-cas-worker`), not in the nightly MF scheduler.

| Component | Location |
|-----------|----------|
| Order schema | `037_mf_transactions` — `mf_orders`, `mf_investment_accounts`, `mf_external_holdings` |
| Cybrilla OMS client | `fp_oms_client.py` — `POST /v2/mf_purchases`, MFIA create |
| Order API | `POST/GET /invest/orders` (KYC + fund-eligibility gated) |
| Order worker | `run_mf_transaction_workers.py --orders` |
| MF Central CAS | `mf_central_client.py` + `cas_import_service.py` |
| CAS worker | `run_mf_transaction_workers.py --cas` |

**Order flow:**
1. User `POST /invest/orders` → local row `PENDING`
2. Worker submits to Cybrilla when investor profile + MFIA are ready
3. Worker polls FP purchase state → `SUCCEEDED` triggers referral hook

**CAS flow:**
1. User `POST /invest/cas/imports` (KYC complete, PAN on file)
2. CAS worker fetches holdings → `mf_external_holdings` (ISIN match)
3. User `GET /invest/holdings/external`

**Config:**
- `ZYND_MF_ORDERS_ENABLED=true`
- `ZYND_MF_ORDER_WORKER_TICK_SECONDS=30`
- `ZYND_MF_CAS_ENABLED=false` (enable when MF Central credentials configured)
- `ZYND_MF_CENTRAL_BASE_URL=` / `ZYND_MF_CENTRAL_API_KEY=`

**API:**
```bash
POST /invest/orders               {"product_id":"...","amount_inr":5000,"idempotency_key":"..."}
GET  /invest/orders
GET  /invest/orders/{order_id}
POST /invest/cas/imports
GET  /invest/holdings/external
```

## Phase 7 — Admin catalog read console

**Status:** Implemented

Read-only admin APIs and Admin app UI for catalog inspection before Phase 8 write controls.

| Component | Location |
|-----------|----------|
| Catalog admin service | `catalog_admin_service.py` |
| Read indexes | `038_mf_admin_read_indexes` |
| Overview API | `GET /admin/mf/overview` (`mf.catalog.read`) |
| Categories API | `GET /admin/mf/categories` |
| Funds list/detail | `GET /admin/mf/funds`, `GET /admin/mf/funds/{id}` |
| NAV history | `GET /admin/mf/funds/{id}/navs` |
| Admin UI | `Admin/src/app/dashboard/mutual-funds` — tabs: Overview, Categories, Funds, AMCs, Operations |

**RBAC:** `mf.catalog.read` added to `operations` role and `super_admin`.

**Admin UI features:**
- Catalog overview stats
- Category table with fund/active counts
- Paginated fund list with search and lifecycle/category filters
- Fund detail drawer: catalog flags, returns, 90-day NAV sparkline + table
- AMC empanelment (existing `mf.amcs.*` permissions)
- Job trigger + ingestion run history (existing `mf.jobs.*` permissions)

**Ops:**
```bash
cd Backend && alembic upgrade head
cd Admin && npm run dev   # http://localhost:8888/dashboard/mutual-funds
```

## Phase 8 — Admin toggles, overrides & audit

**Status:** Implemented

Admin write controls with governance precedence enforced in invest API, order flow, and lifecycle sync.

| Component | Location |
|-----------|----------|
| Override schema | `039_mf_catalog_overrides` — `products.admin_*`, `fund_amcs.admin_kill_switch` |
| Governance rules | `catalog_governance_service.py` |
| Lifecycle respect | `catalog_lifecycle_service.py` skips FORCE_HIDE / kill-switch funds |
| Write service + audit | `catalog_admin_write_service.py` → `audit_logs` |
| Fund PATCH | `PATCH /admin/mf/funds/{id}` (`mf.catalog.manage`) |
| AMC PATCH (extended) | `PATCH /admin/mf/amcs/{id}` — `admin_kill_switch` + audit |

**Governance precedence:**
1. Admin `FORCE_HIDE` / AMC kill switch
2. Admin `FORCE_SHOW` (display only)
3. Cybrilla OMS flags
4. AMC empanelment
5. `mutual_funds.is_active`
6. `catalog-lifecycle-sync`

**RBAC:** `mf.catalog.manage` on `operations` and `super_admin`.

**Audit events:** `mf_fund_catalog_updated`, `mf_amc_catalog_updated` (before/after JSON in metadata).

**Admin UI:** fund enable/disable, visibility/investability overrides, AMC kill switch with required reason modal.

**API:**
```bash
PATCH /admin/mf/funds/{id}   {"is_active":false,"admin_visibility":"FORCE_HIDE","reason":"..."}
PATCH /admin/mf/amcs/{id}    {"admin_kill_switch":true,"reason":"..."}
```

## Phase 9 — Category curation & per-category sort order

**Status:** Implemented

Admin controls fund order within categories and featured placement on invest home.

| Component | Location |
|-----------|----------|
| Display schema | `040_mf_display_order` — category + `product_categories` curation columns |
| Curation service | `category_curation_service.py` |
| Sort helpers | `catalog_display_service.py` |
| Invest API sort | `invest_home_service.py` — curated order when category filter set; featured carousel |
| Admin curation API | `GET/PATCH /admin/mf/categories/{id}`, `GET .../{slug}/funds`, `PUT .../{slug}/order` |
| Bulk AMC add | `POST /admin/mf/categories/{slug}/funds/bulk-amc` |
| Admin UI | `CategoryCurationPanel` — reorder, featured star/rank, bulk AMC add |

**Public sort (per category):** `is_featured DESC → featured_rank → display_order → composite_rank → name`

**Featured home:** funds with `is_featured=true` (within effective dates) across visible categories.

**Audit:** `mf_category_catalog_updated` on category PATCH and curation mutations.

**API:**
```bash
PUT  /admin/mf/categories/equity/order  {"items":[{"product_id":"...","display_order":10,"is_featured":true,"featured_rank":1}]}
POST /admin/mf/categories/equity/funds/bulk-amc  {"amc_id":3}
```

## Phase 10 — Catalog health & data quality gates

**Status:** Implemented

Production display gates and ops health dashboard for catalog trustworthiness.

| Component | Location |
|-----------|----------|
| Health service | `catalog_health_service.py` |
| Public stale NAV gate | `invest_health_sql_clause()` in `catalog_governance_service.py` |
| Admin health API | `GET /admin/mf/catalog/health`, `GET /admin/mf/catalog/health/issues` |
| Admin UI | `CatalogHealthPanel` — counters + drill-down |
| Fund badges | `health_flags` on admin fund list/detail |

**Config:**
- `ZYND_MF_CATALOG_HEALTH_GATES_ENABLED=true`
- `ZYND_MF_NAV_STALE_DAYS=3`
- `ZYND_MF_MIN_NAV_ROWS=50`

**Checks:**
| Check | Severity | Public effect |
|-------|----------|---------------|
| Stale NAV (ACTIVE fund) | critical | Hidden unless `FORCE_SHOW` |
| Shallow NAV history | warning | Badge only |
| Missing 3Y metrics | warning | Badge only |
| Force-show not purchasable | warning | Badge only |
| Orphan product | critical | Ops alert |
| Empanelled AMC, 0 active funds | warning | Ops alert |

## Phase 11 — Public invest UX

**Status:** Implemented

End-user mutual fund browse, detail, order placement, and external holdings on the Web app.

| Component | Location |
|-----------|----------|
| Invest NAV API | `GET /invest/funds/{product_id}/navs` |
| Invest config API | `GET /invest/config` — ARN, EUIN, disclaimer |
| Extended fund schemas | `InvestFundSummaryResponse` — min SIP, SEBI category, health badges |
| Invest service | `invest_home_service.py` — `list_invest_fund_navs`, `get_invest_config_payload` |
| Web API client | `Web/src/features/invest/api/invest-api.ts` |
| Web UI | `MutualFundsCatalogPanel` — home, category, detail, orders, holdings |

**Web screens:**
- **Browse home** — category chips, featured carousel, total fund count
- **Category list** — admin-curated sort (Phase 9), paginated fund cards
- **Fund card** — AMC logo, 3Y return, min SIP, SEBI category, health badges
- **Fund detail** — NAV chart, TER, AUM, returns grid, disclaimer, lumpsum CTA
- **Orders** — list from Phase 6 API
- **External holdings** — CAS import CTA + holdings list

**Config:**
- `ZYND_MF_INVEST_DISCLAIMER` — scheme disclaimer text
- Reuses `ZYND_DISTRIBUTOR_ARN`, `ZYND_DISTRIBUTOR_EUIN`, `ZYND_MF_ORDERS_ENABLED`, `ZYND_MF_CAS_ENABLED`

**Exit criteria:**
- Browse → detail → place lumpsum order end-to-end
- Empty/error states when catalog health blocks funds (404 on hidden funds)
- Mobile-responsive fund card grid

---

## Phase 12 — Product content & compliance layer

**Status:** Implemented

Marketing and compliance content editable in admin, merged into the public invest API.

| Component | Location |
|-----------|----------|
| Content schema | `041_mf_product_content` — `product_display_content`, `amc_display_content`, `mf_compliance_settings` |
| Content service | `product_content_service.py` |
| Admin content API | `GET/PATCH /admin/mf/funds/{id}/content`, `GET/PATCH /admin/mf/amcs/{id}/content` |
| Compliance API | `GET/PATCH /admin/mf/compliance` |
| Invest API merge | Fund detail `content` block + list `display` fields; config uses DB overrides |
| Admin UI | Content tab, fund drawer content panel, AMC content drawer |
| RBAC | `mf.content.manage` on `operations` + `super_admin` |

**Product fields:** tagline, hero_badge, risk_label, benchmark, fund manager, per-fund disclaimer, SEO slug/meta

**AMC fields:** marketing_name, description, website_url

**Compliance:** Global disclaimer + ARN/EUIN (DB override with env fallback)

**Audit:** `mf_product_content_updated`, `mf_amc_content_updated`, `mf_compliance_settings_updated`

**Exit criteria:**
- Disclaimer + ARN visible on fund detail (admin-editable)
- SEO slug stored for future public fund pages
- Fund cards show tagline, hero badge, and custom risk label

---

## Phase 13 — Rules engine, bulk ops & maker-checker

**Status:** Implemented

Scale catalog operations to 1000+ schemes with rules, CSV bulk import, and maker-checker gates.

| Component | Location |
|-----------|----------|
| Rules schema | `042_mf_catalog_rules` — `mf_catalog_rules`, `mf_catalog_rule_runs`, `mf_bulk_catalog_jobs` |
| Rules service | `catalog_rules_service.py` — evaluate, preview, apply |
| Bulk service | `catalog_bulk_service.py` — CSV parse, preview, job execution |
| Maker-checker | `AdminActionType.mf_catalog_bulk_apply`, `mf_catalog_rules_apply` |
| Admin API | `GET/POST/PATCH /admin/mf/rules`, `POST .../preview`, `POST .../apply` |
| Bulk API | `POST /admin/mf/funds/bulk`, `.../bulk/preview`, `GET .../bulk/jobs` |
| Admin UI | `CatalogRulesPanel`, `BulkImportPanel` |

**Rule conditions (AND):** `amc_empanelled`, `fp_purchasable`, `fund_active`, `lifecycle_status`, `admin_visibility`, `amc_id`, `category_id`

**Rule actions:** `set_lifecycle_status`, `set_fund_active`, `set_admin_visibility`, `set_admin_investability`, `add_to_category`

**Bulk CSV:** `isin, action, category, position, reason` — actions: disable, enable, force_hide, force_show, auto_visibility, add_category, set_order

**Config:**
- `ZYND_MF_RULES_ENABLED=true`
- `ZYND_MF_BULK_MAKER_CHECKER_THRESHOLD=25`

**RBAC:**
- `mf.rules.manage` — rule CRUD + preview
- `mf.catalog.publish` — apply rules + bulk mutations
- `catalog_publisher` role — publish + approve maker-checker

**Exit criteria:**
- Dry-run preview before apply
- Bulk CSV jobs with status tracking
- Large/risky bulk ops and high-impact rule apply require maker-checker approval

---

## Phase 14 — Production scale (cache, search, observability)

**Status:** Implemented

Redis-backed invest catalog cache, Postgres full-text search, and extended Prometheus metrics for production traffic.

| Component | Location |
|-----------|----------|
| Cache layer | `invest_catalog_cache.py` — generation-based Redis keys (`invest:catalog:gen`), hit/miss counters |
| Cached reads | `invest_cached_read_service.py` — wraps home, categories, funds, detail, config, search |
| Search vectors | `043_mf_invest_search_cache` — `products.invest_search_vector` (TSVECTOR + GIN) |
| Search service | `invest_search_service.py` — `search_invest_funds()`, `refresh_product_search_vectors()` |
| Invalidation | `invest_catalog_invalidation.py` — bumps cache gen; optional search vector rebuild |
| Metrics | `catalog_metrics_service.py` + extended `mf_scheduler_metrics.py` |
| Invest API | `GET /invest/search?q=` + cached `/home`, `/categories`, `/funds`, `/funds/{id}`, `/config` |
| Web UI | Search bar on mutual funds browse home (`mutual-funds-catalog-panel.tsx`) |

**Cache invalidation triggers:** scheme sync ( + search refresh), lifecycle sync, composite rank, admin catalog/content/category writes, rules apply, bulk execute.

**Config:**
- `ZYND_MF_INVEST_CACHE_ENABLED=true`
- `ZYND_MF_INVEST_CACHE_HOME_TTL_SECONDS=600`
- `ZYND_MF_INVEST_CACHE_CATEGORY_TTL_SECONDS=600`
- `ZYND_MF_INVEST_CACHE_FUND_TTL_SECONDS=180`
- `ZYND_MF_INVEST_CACHE_SEARCH_TTL_SECONDS=300`
- `ZYND_MF_INVEST_CACHE_CONFIG_TTL_SECONDS=900`

**Prometheus gauges/counters:**
- `zynd_mf_active_products`, `zynd_mf_total_products`, `zynd_mf_stale_nav_funds`
- `zynd_mf_orders_24h`, `zynd_mf_nav_job_last_success/failed`
- `zynd_mf_invest_cache_hits/misses/hit_rate`, `zynd_mf_zero_active_funds_alert`

**Exit criteria:**
- Invest browse endpoints served from Redis with generation invalidation on catalog mutations
- Full-text fund search by name, ISIN, AMC with ILIKE fallback
- Ops dashboard can alert on zero active funds, stale NAV count, cache hit rate

---

## Phase 15 — Mongo scheme staging & promote pipeline

**Status:** Implemented

Cybrilla scheme ingest is staged in Mongo before any SQL catalog writes. Bad batches can be rejected; valid batches are promoted to `mutual_funds` + `products` (draft).

| Component | Location |
|-----------|----------|
| Normalizer | `scheme_row_normalizer.py` |
| Mongo store | `scheme_staging_store.py` — `scheme_ingest_batches`, `scheme_staging_rows` |
| Ingest job | `scheme_staging_ingest_service.py` → `cybrilla-scheme-ingest` |
| Validate job | `scheme_staging_validate_service.py` → `cybrilla-scheme-validate` |
| Promote job | `scheme_staging_promote_service.py` → `cybrilla-scheme-promote` |
| SQL upsert | `scheme_sql_upsert_service.py` |
| Admin API | `GET /admin/mf/staging/batches`, approve/reject/promote |
| Admin UI | `SchemeStagingPanel` |

**Pipeline:**
```text
Cybrilla API → Mongo staging → validate → (approve) → promote → PostgreSQL (draft products)
```

**Config:**
- `ZYND_MF_SCHEME_STAGING_ENABLED=true`
- `ZYND_MF_SCHEME_PROMOTE_AUTO=false` (manual approve in admin by default)
- `MONGO_URL` or `MONGO_CONN` required when staging enabled

**Cron (when staging enabled):**
- `20:00` ingest · `20:02` validate · `20:05` promote (skips if pending approval)

**Legacy:** Set `ZYND_MF_SCHEME_STAGING_ENABLED=false` to use direct `cybrilla-scheme-sync` → SQL.

---

## Phase 16 — Enrichment (scheme master, calculator, compliance)

**Status:** Implemented

| Job | Source | Output |
|-----|--------|--------|
| `amfi-scheme-master-sync` | AMFI `NAVAll.txt` | `amfi_scheme_master` |
| `amfi-fund-bridge` | Master + scheme names | `mutual_funds.scheme_code`, AMC split |
| `return-calculator-snapshot` | `scheme_navs` | `fund_return_calculator_snapshots` |
| `amc-aum-rank-compute` | `scheme_aums` | `amc_aum_rankings` |
| `scheme-compliance-sync` | Cybrilla detail + tax templates | `scheme_compliance_facts` |
| `scheme-min-amounts-backfill` | Cybrilla `/fund_schemes/{isin}` | `mutual_funds.min_sip_amount`, `min_lumpsum_amount`, `investment_constraints` |

**Invest API:**
```bash
GET /invest/funds/{product_id}/return-calculator?amount_inr=1000&mode=lumpsum
```

Fund detail includes `compliance`, `fund_house`, `amc_aum_rank`.

**Config:**
- `ZYND_MF_AMFI_SCHEME_MASTER_ENABLED=true`
- `ZYND_MF_RETURN_CALCULATOR_ENABLED=true`
- `ZYND_MF_AMC_AUM_RANK_ENABLED=true`
- `ZYND_MF_COMPLIANCE_SYNC_ENABLED=true`
- `ZYND_MF_SCHEME_MIN_AMOUNTS_BACKFILL_ENABLED=true`
- `ZYND_MF_SCHEME_MIN_AMOUNTS_BACKFILL_BATCH_SIZE=200`
- `ZYND_MF_INVEST_CACHE_CALC_TTL_SECONDS=86400`

**First-run sequence:**
```bash
python -m app.jobs.run_mf_scheduler --job amfi-scheme-master-sync
python -m app.jobs.run_mf_scheduler --job amfi-fund-bridge
python -m app.jobs.run_mf_scheduler --job amfi-nav-daily
python -m app.jobs.run_mf_scheduler --job nav-cold-start-backfill
python -m app.jobs.run_mf_scheduler --job nav-metrics-compute
python -m app.jobs.run_mf_scheduler --job return-calculator-snapshot
python -m app.jobs.run_mf_scheduler --job scheme-compliance-sync
python -m app.jobs.run_mf_scheduler --job amfi-aum-monthly
python -m app.jobs.run_mf_scheduler --job amfi-ter-monthly
python -m app.jobs.run_mf_scheduler --job scheme-min-amounts-backfill
python -m app.jobs.run_mf_scheduler --job amc-aum-rank-compute
```

---

## Job reference

```bash
# List registered jobs
python -m app.jobs.run_mf_scheduler --list-jobs

# Run one job
python -m app.jobs.run_mf_scheduler --job nav-metrics-compute

# Daemon (production)
python -m app.jobs.run_mf_scheduler --schedule
```

## Source-of-truth reminder

| Data | Owner |
|------|-------|
| Scheme master, OMS flags | Cybrilla (ARN tenant) |
| Daily NAV | AMFI (matched by ISIN) |
| Returns / ranks | Zynd compute |
| AUM / TER | AMFI monthly files |
| Catalog visibility | Zynd admin + lifecycle rules |
