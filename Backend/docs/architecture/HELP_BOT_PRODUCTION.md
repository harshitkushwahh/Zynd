# Help Bot on production (Groq + corpus retrieval)

Production does **not** need Ollama or paid OpenAI fine-tuning. The bot uses:

1. **Groq** (`SUPPORT_LLM_PROVIDER=groq`, `GROQ_API_KEY`, `GROQ_MODEL`) for generation.
2. **On-disk training JSONL** under `data/help-bot-training/batch-*.jsonl` for retrieval few-shot (`training_loader.similar_training_examples`).

The Docker image includes the batch files when they are committed in git. At API startup the corpus is warmed into memory; deploy runs `scripts/verify_help_bot_production.py` after migrations.

## Server `.env`

```env
SUPPORT_LLM_PROVIDER=groq
GROQ_API_KEY=...
GROQ_MODEL=openai/gpt-oss-120b
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_TIMEOUT_SECONDS=120
```

Pipeline stage **[7b/15]** already fails deploy if `GROQ_API_KEY` is missing when provider is groq.

## Update server `.env` (Groq)

Deploy does **not** copy `Backend/.env`. Sync Help Bot vars from your laptop when SSH to the VPS works:

```bash
# From repo root  reads local Backend/.env (GROQ_* only), never prints secrets
Backend/scripts/ssh-push-help-bot-env.sh
```

Or on the server directly:

```bash
ssh root@50.6.205.51 'bash -s' < Backend/scripts/sync-help-bot-groq-env-on-vps.sh
```

**GitHub Actions:** run workflow **ZYND • Sync Help Bot env (VPS)** (`workflow_dispatch`). Requires `DEPLOY_SSH_KEY`; optionally set repo secret `GROQ_API_KEY` to push a new key (GitHub → Settings → Secrets).

If SSH times out from your network, use the GitHub workflow (runners can reach the VPS).

## Manual verify (SSH / compose)

```bash
cd /path/to/Backend
docker compose exec -T api python scripts/verify_help_bot_production.py
docker compose exec -T api python scripts/verify_help_bot_production.py --require-llm
```

## Customer API status

`GET /api/v1/support/help-bot/status` returns `training_rows` and `retrieval_ready` in addition to Groq/Ollama connectivity.

## Optional DB import

`scripts/import_help_bot_training_examples.py --all-batches` seeds `support_resolution_examples` for Postgres full-text retrieval. **Not required** for the JSONL path the bot uses today; use only if you want DB-backed `similar_resolutions` boosted with gold rows.
