# ZYND Support

Contact / support team console (tickets, users, audit). Uses the shared Zynd Backend auth stack.

## Run

```bash
# from repo root
npm install

# terminal 1 — backend (see Backend/README)
# terminal 2
cd Support && npm run dev
```

App: [http://localhost:9999](http://localhost:9999)

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `BACKEND_URL` | `http://localhost:8000` | **Server-only.** Next.js proxy target (API **origin**, no `/api/v1` suffix) |
| `NEXT_PUBLIC_API_URL` | `/api/v1` | Browser API base (same-origin proxy on Vercel) |
| `NEXT_PUBLIC_APP_ENV` | `development` | Shown in UI; use `production` on Vercel |

### Vercel (`support.zynd.shop`)

Browser calls `https://support.zynd.shop/api/v1/...`; the [API route](src/app/api/v1/[...path]/route.ts) forwards to `BACKEND_URL`.

**Required (Production → Environment variables):**

| Name | Example | Notes |
|------|---------|--------|
| `BACKEND_URL` | `https://api.zynd.shop` | Do **not** append `/api/v1`. Without this, the proxy defaults to `localhost:8000` and login returns **500**. |
| `NEXT_PUBLIC_APP_ENV` | `production` | |

`NEXT_PUBLIC_ZYND_WEB_URL` is for the investor **Web** app, not Support — it is unused here.

## Provisioning accounts

Super admins create Support users from **Admin → Team** (invitation or direct create) with role **Support Agent** or **Support Lead**. Invite links open `/accept-invite` on this app (port 9999).

Sign-in uses `x-zynd-client: support` and refresh cookie `zynd_support_refresh_token`.

### Development seed (Backend)

When `APP_ENV=development`, the API seeds two Support staff accounts on startup (same password as dev admin):

| Email | Role | Password |
|-------|------|----------|
| `support@zynd.com` | Support Agent | `Zynd@1234` |
| `support.lead@zynd.com` | Support Lead | `Zynd@1234` |

Manual seed (any environment, including production DB):

```bash
cd Backend
chmod +x scripts/run_support_seed.sh   # once
./scripts/run_support_seed.sh
```

Or: `cd Backend && source .venv/bin/activate && python -m app.jobs.run_dev_support_seed`

**Bluehost / SSH:** SSH into the host, `cd` to the deployed `Backend` folder (same machine that runs the API), ensure `.env` has `DATABASE_URL`, then run `./scripts/run_support_seed.sh`. The Support **frontend** (Vercel) only talks to the API; users live in Postgres via this Backend job.

On production (`APP_ENV=production`), startup does **not** auto-seed Support users—you must run the script above once (or create users from Admin → Team).

Ticket/user/audit panels show empty states until phase 2 support APIs ship.
