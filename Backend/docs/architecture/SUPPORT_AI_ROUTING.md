# Support AI routing

Hybrid routing assigns **priority**, **SLA deadlines**, **support agent assignees**, and **PM co-handling flags** using structured analytics plus LLM JSON (same stack as Help Bot).

## Flow

1. **Feature builder** (`support_intelligence_features.py`) loads transcript, behavior signals, customer context pack, agent load/presence/productivity, and distributor book / PM link.
2. **Router** (`support_intelligence_router.py`) calls the configured LLM when `SUPPORT_AI_ROUTING_ENABLED=true`; on failure uses **fallback scorer** (wait time, signals, backlog).
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

- `SUPPORT_AI_ROUTING_ENABLED`  use LLM routing (default true in dev)
- `SUPPORT_ROUTING_TIMEOUT_SECONDS`  routing LLM timeout (default 20)
- `SUPPORT_ROUTING_DEBOUNCE_SECONDS`  min interval between re-routes (default 300)
- `SUPPORT_ROUTING_REASSIGN_WHEN_AWAY`  reassign on high urgency if assignee not online (default true)
- **Groq (default):** `SUPPORT_LLM_PROVIDER=groq`, `GROQ_API_KEY`, `GROQ_MODEL` (default `openai/gpt-oss-120b`), `GROQ_BASE_URL`, `GROQ_TIMEOUT_SECONDS`
- **Optional local Ollama:** `SUPPORT_LLM_PROVIDER=ollama`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_TIMEOUT_SECONDS`

## Console API

Ticket payloads include:

- `routing`  latest insight (urgency, rationales, PM co-handling, source `ai` | `fallback`)
- `urgency_score`  queue sort key (backend list sorted urgency desc, then updated_at)
- `sla`  computed deadline snapshot (unchanged)

## Operations

Run migration `105_support_ai_routing` before deploying. If the LLM is down, routing continues via fallback; assignee selection uses weighted backlog and presence.

Production deploys (`.github/workflows/zynd-pipeline.yml`) verify **`GROQ_API_KEY`** on the server when `SUPPORT_LLM_PROVIDER=groq`. Set secrets only in `/opt/zynd/Backend/.env` (not committed). Legacy `Backend/scripts/ensure-ollama-production.sh` is for optional self-hosted Ollama, not used in CI.

### Reverse proxy timeouts

Help Bot `POST /support/conversations/messages` waits on the LLM (`GROQ_TIMEOUT_SECONDS` / `OLLAMA_TIMEOUT_SECONDS`, default **120**). If nginx/Apache in front of the API uses a **60s** read timeout, browsers see a failed send even when the API eventually escalates. Apply `Backend/scripts/nginx-zynd-api-timeouts.snippet` (or equivalent **180s** read timeout) on `/api/`.

### Help Bot latency

- Escalations from the bot use **fallback routing** during the HTTP request (no second LLM call); console debounce can run AI routing later.
- Groq requests use JSON `response_format`, capped tokens, and low/medium `reasoning_effort` per task.
