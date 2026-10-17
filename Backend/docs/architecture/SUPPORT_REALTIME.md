# Support realtime (REST + WebSocket + webhooks)

## Frontends and REST routes

| Client | Path prefix | Auth |
|--------|-------------|------|
| Web Help chat | `/api/v1/support/conversations/*`, `/support/tickets/*` | Investor JWT |
| Support console | `/api/v1/support/console/*` | RBAC `support.tickets.*` |

Both apps use the same FastAPI backend (`env.apiUrl` / `@zynd/shared/api`).

## WebSocket

- URL: `ws(s)://{api}/api/v1/support/ws?token={access_token}`
- Client → server:
  - `{ "type": "subscribe", "conversation_id"?: "...", "ticket_id"?: "..." }`
  - `{ "type": "agent:typing", "ticket_id": "...", "typing": true|false }` (agents)
  - `{ "type": "agent:presence", "status": "online"|"away" }` (agents)
- Server → client:
  - `message:new`, `ticket:updated`, `agent:typing`, `agent:presence`, `conversation:locked`

Events are fan-out via Redis channel `support:realtime` (DB index `redis_event_stream_db`).

## REST (unchanged responsibilities)

- Bootstrap/history: `GET /support/conversations/current`
- Send message: `POST /support/conversations/messages`
- Attachments: `GET /support/messages/{message_id}/attachment`
- Agent console: `/support/console/tickets/*`

Polling remains a fallback when the WebSocket is disconnected.

## Webhooks

- Inbound: `POST /api/v1/webhooks/support-events` with `X-Zynd-Signature: sha256=...` (HMAC-SHA256 of body, secret `SUPPORT_WEBHOOK_SECRET`).
- Outbound: comma-separated `SUPPORT_WEBHOOK_URLS`, fired after commit for `ticket.escalated` and `ticket.resolved`.

## Config

- `SUPPORT_REALTIME_ENABLED` (default `true`)
- `SUPPORT_WEBHOOK_SECRET`, `SUPPORT_WEBHOOK_URLS`
- **Web / Support frontends:** `NEXT_PUBLIC_BACKEND_WS_ORIGIN=ws://127.0.0.1:8000` in `.env.local` when `NEXT_PUBLIC_API_URL` is `/api/v1` (Next HTTP proxy). Browsers open WS on port **8000**, not the Next dev server.

## Presence

- Bot threads: no online indicator in the Web UI.
- Human threads: `assignee_name`, `agent_presence` on `ConversationOut`; Redis TTL keys `support:presence:agent:{uuid}` updated by agent heartbeats over WS.
