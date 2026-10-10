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
| `BACKEND_URL` | `http://localhost:8000` | Next.js API proxy target |
| `NEXT_PUBLIC_API_URL` | `/api/v1` | Browser API base |

## Provisioning accounts

Super admins create Support users from **Admin → Team** (invitation or direct create) with role **Support Agent** or **Support Lead**. Invite links open `/accept-invite` on this app (port 9999).

Sign-in uses `x-zynd-client: support` and refresh cookie `zynd_support_refresh_token`.

### Development seed (Backend)

When `APP_ENV=development`, the API seeds two Support staff accounts on startup (same password as dev admin):

| Email | Role | Password |
|-------|------|----------|
| `support@zynd.com` | Support Agent | `Zynd@1234` |
| `support.lead@zynd.com` | Support Lead | `Zynd@1234` |

Manual seed: `cd Backend && python3 -m app.jobs.run_dev_support_seed`

Ticket/user/audit panels show empty states until phase 2 support APIs ship.
