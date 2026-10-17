# Support AI routing

Hybrid routing assigns **priority**, **SLA deadlines**, **support agent assignees**, and **PM co-handling flags** using structured analytics plus Ollama JSON (same stack as Help Bot).

## Flow

1. **Feature builder** (`support_intelligence_features.py`) loads transcript, behavior signals, customer context pack, agent load/presence/productivity, and distributor book / PM link.
2. **Router** (`support_intelligence_router.py`) calls Ollama when `SUPPORT_AI_ROUTING_ENABLED=true`; on failure uses **fallback scorer** (wait time, signals, backlog).
3. Results persist on `support_tickets.routing_metadata` and append `support_ticket_routing_events` for analytics.

## Triggers

| Trigger | When |
|---------|------|
| `escalation` / `ensure_ticket` | Human ticket created or escalated (forced refresh) |
| `customer_message` | New customer message while handler is human |
| `ticket_detail` | Console ticket detail, unassigned only, debounced |

Console **ticket list** does not re-run routing (sort uses persisted `routing_metadata`). Open a ticket or wait for debounced triggers to refresh scores.

Debounce: `SUPPORT_ROUTING_DEBOUNCE_SECONDS` (default 300).

## PM co-handling

- Does **not** set `assignee_id` to the Mitra/PM user.
- When the investor is in the distributor book, `routing_metadata.pm_co_handling` includes Mitra id/name/client id and `notify` vs `consult`.
- Escalation adds an **internal** system note for agents when PM co-handling is recommended.

## Config

- `SUPPORT_AI_ROUTING_ENABLED` — use Ollama (default true in dev)
- `SUPPORT_ROUTING_TIMEOUT_SECONDS` — Ollama timeout for routing (default 20)
- `SUPPORT_ROUTING_DEBOUNCE_SECONDS` — min interval between re-routes (default 300)
- `SUPPORT_ROUTING_REASSIGN_WHEN_AWAY` — reassign on high urgency if assignee not online (default true)
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL` — shared with Help Bot

## Console API

Ticket payloads include:

- `routing` — latest insight (urgency, rationales, PM co-handling, source `ai` | `fallback`)
- `urgency_score` — queue sort key (backend list sorted urgency desc, then updated_at)
- `sla` — computed deadline snapshot (unchanged)

## Operations

Run migration `105_support_ai_routing` before deploying. If Ollama is down, routing continues via fallback; assignee selection uses weighted backlog and presence.

Production deploys (`.github/workflows/zynd-pipeline.yml`) start the **`ollama`** Compose service and run `Backend/scripts/ensure-ollama-production.sh` before recreating the API. Server `Backend/.env` should define `OLLAMA_MODEL`; deploy sets `OLLAMA_BASE_URL=http://ollama:11434`. The VPS needs enough RAM plus swap for the chosen model (default `qwen3.5:4b`).

### Reverse proxy timeouts

Help Bot `POST /support/conversations/messages` waits on Ollama (`OLLAMA_TIMEOUT_SECONDS`, default **120**). If nginx/Apache in front of the API uses a **60s** read timeout, browsers see a failed send even when the API eventually escalates. Apply `Backend/scripts/nginx-zynd-api-timeouts.snippet` (or equivalent **180s** read timeout) on `/api/`.

### Help Bot latency

- Escalations from the bot use **fallback routing** during the HTTP request (no second Ollama call); console debounce can run AI routing later.
- Ollama chat uses capped context, `num_predict`, and `keep_alive: 30m` to reduce cold/slow runs on small VPS hosts.
