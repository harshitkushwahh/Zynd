# Auth session restore and Redis caches

## Web session model

| Layer | Purpose |
|-------|---------|
| HttpOnly refresh cookie (`zynd_refresh_token`, path `/api/v1/auth`) | Long-lived session; sent on `POST /auth/refresh` with `credentials: include` |
| In-memory access token | Short-lived JWT on API requests |
| `localStorage` `zynd:session-hint` | Client hint that a refresh cookie likely exists |
| `sessionStorage` `zynd:session-user` | Non-sensitive `AuthUser` snapshot for instant marketing nav while refresh runs |

Marketing nav uses **restore pending** when hint or retry state exists so logged-in users do not flash **Get Started** during slow refresh or transient network errors.

## Auth API hot paths

- `POST /auth/refresh`  DB session row + `get_user_public_profile` (Redis-backed)
- `GET /auth/me`  same public profile cache
- Most routes  `get_current_user` → `get_user_by_id_cached` (Redis-backed row, merged into SQLAlchemy session)

## Redis DB usage (cache DB index `redis_cache_db`)

| Key pattern | TTL (base + jitter) | Invalidation |
|-------------|---------------------|--------------|
| `auth:user_public:{user_id}` | 300s + 120s | Account/MFA/pin/profile/status mutations |
| `auth:user_row:{user_id}` | 60s + 30s | Same |
| `auth:fund_movement_policy` | 600s + 180s | Security config keys `fund.*` |
| `rbac:permissions:{user_id}` | 300s + 120s | Admin role assignment changes |
| `auth:profile_image_url:{user_id}` | 300s + 90s | Profile image document finalize |

Jitter spreads expiry times to reduce synchronized DB reloads.

Shared helpers: `app/application/shared/redis_json_cache.py`.

## Ops checks

1. After login, cookie present on Web origin under `/api/v1/auth`.
2. Reopen marketing home: one refresh, Dashboard (or skeleton), not Get Started.
3. `/auth/me` should not spam on idle landing; KYC debounces explicit refreshes.
