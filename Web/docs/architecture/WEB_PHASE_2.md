# Web Phase 2 — Navigation & routing

Completed checklist. Dashboard tabs now use real URLs; navigation config is a single source of truth.

## Done

| Item | Artifact |
|------|----------|
| Unified nav config | `src/features/dashboard/navigation/dashboard-routes.ts` |
| Pathname hook | `src/features/dashboard/navigation/use-dashboard-route.ts` |
| Portfolio overview page | `src/features/dashboard/pages/portfolio-overview-page.tsx` |
| Section placeholders | `src/features/dashboard/components/dashboard-section-placeholder.tsx` |
| Real routes | `/dashboard`, `/dashboard/fixed-deposits`, `/dashboard/mutual-funds`, `/dashboard/transactions` |
| URL-based nav | Sidebar, top nav, search use `Link` / `router.push(href)` |
| Removed client tab state | Deleted `dashboard-section-context.tsx` |
| Backward-compat re-exports | `dashboard-nav.ts`, `dashboard-top-nav.ts`, `dashboard-page-meta.ts` |

## Routes

| Section | URL |
|---------|-----|
| Portfolio Overview | `/dashboard` |
| Fixed Deposits | `/dashboard/fixed-deposits` |
| Mutual Funds | `/dashboard/mutual-funds` |
| Transactions | `/dashboard/transactions` |
| Settings | `/dashboard/settings?section=` (unchanged) |

## Import guidance

- **New dashboard nav items:** add to `DASHBOARD_ROUTES` in `dashboard-routes.ts`, then create an App Router page under `app/dashboard/`.
- **Active route detection:** use `useDashboardRoute()` or `resolveDashboardRoute(pathname)`.
- **Legacy imports:** `@/components/dashboard/dashboard-nav` still re-exports from features.

## Behavior notes

- Top tab bar is hidden on settings pages (breadcrumb owns that context).
- `/dashboard` matches only the portfolio overview — not nested dashboard paths.
- Search (⌘K) navigates to route `href`s.

## Next: Web Phase 4

Dashboard feature modules — overview, security alerts, MFA banner under `features/`.
