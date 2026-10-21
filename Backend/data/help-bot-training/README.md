# Zynd Help Bot training corpus

Gold Q&A for **retrieval** (few-shot in prompts today) and **fine-tuning** (OpenAI-compatible chat JSONL export).  
Production inference uses **Groq + live context pack** (`SUPPORT_LLM_PROVIDER=groq`) plus **JSONL retrieval** shipped in the API Docker image (no Ollama on the server). See `docs/architecture/HELP_BOT_PRODUCTION.md`.

## Layout

| File | Purpose |
|------|---------|
| `schema.json` | Field definitions for each record |
| `manifest.json` | Batch progress (current target **52,000** examples) |
| `compiled/dataset-summary.json` | Last **compile** run: counts, Hinglish heuristic, topic mix |
| `exports/zynd-help-finetune-full.jsonl` | Full **52k** Phase 2 chat export (gitignored; regenerate via compile) |
| `batch-001.jsonl` | **Batch 1 — 100** questions (all product areas) |
| `batch-002.jsonl` | **Batch 2 — 100** (paraphrases, redeem/CAS edges, Hinglish) |
| `batch-003.jsonl` | **Batch 3 — 100** (consent OTP, reports, risk profile, STP/SWP) |
| `batch-004.jsonl` | **Batch 4 — 100** (order cancel, cart, typos/Hinglish) |
| `batch-005.jsonl` | **Batch 5 — 100** (escalation, tickets, agent handoff) |
| `batch-006.jsonl` | **Batch 6 — 100** (explore, cart, notifications, first invest) |
| `batch-007.jsonl` … | ~100 per batch until 1000 |

## Record shape (JSONL)

One JSON object per line. See `schema.json`. Important fields:

- `question` — customer wording (natural language)
- `topics` — scope topics: `kyc`, `payment`, `portfolio`, `family`, `goals`, `account`, `referrals`
- `can_answer` — whether the bot should answer from context (`true`) or escalate (`false`)
- `context_fields` — which context pack keys the answer must use (no invented facts)
- `solution` — approved answer pattern / template agents and the model should follow

## Batches (target 1000)

| Batch | Target count | Cumulative | Status |
|-------|--------------|------------|--------|
| 001 | 100 | 100 | **done** |
| 002 | 100 | 200 | **done** |
| 003 | 100 | 300 | **done** |
| 004 | 100 | 400 | **done** |
| 005 | 100 | 500 | **done** |
| 006 | 100 | 600 | **done** |
| 007 | 100 | 700 | **done** |
| 008 | 100 | 800 | **done** |
| 009 | 100 | 900 | **done** |
| 010 | 100 | 1000 | **done** (curated) |
| 011–039 | 1000 each | 30,000 | **done** (parametric Phase 1) |
| 040–059 | 1000 each | 50,000 | **done** (Hinglish + module templates) |
| 060 | 1000 | 51,000 | **done** (curated customer Hinglish — see `curated/`) |
| 061 | 1000 | 52,000 | **done** (MF modules + KYC + Settings, Hinglish) |

Each batch should mix:

- Straight questions per topic
- Paraphrases and typos (`paraphrases` array)
- Multi-topic combinations
- “No data in context” cases (`can_answer: false`)

## Regenerate a batch

```bash
cd Backend
python3 scripts/generate_help_bot_training_batch.py --batch 1
python3 scripts/generate_help_bot_training_batch.py --batch 2
python3 scripts/generate_help_bot_training_batch.py --batch 3
python3 scripts/generate_help_bot_training_batch.py --batch 4
python3 scripts/generate_help_bot_training_batch.py --batch 5
python3 scripts/generate_help_bot_training_batch.py --batch 6
python3 scripts/generate_help_bot_training_batch.py --batch 7
python3 scripts/generate_help_bot_training_batch.py --batch 8
python3 scripts/generate_help_bot_training_batch.py --batch 9
python3 scripts/generate_help_bot_training_batch.py --batch 10
```

### Scale corpus (Phase 1 — parametric)

Curated batches **001–010** stay as-is. Grow toward any target (default **30,000** rows) with
`batch-011.jsonl` … at **1000 lines per file**:

```bash
cd Backend
# Idempotent: only adds rows if below target
python3 scripts/generate_help_bot_corpus.py --target 30000 --batch-size 1000 --seed 42

# Grow to 50k — batches 040+ use Hinglish + module-screen templates (auto from row 30k+)
python3 scripts/generate_help_bot_corpus.py --target 50000 --batch-size 1000 --seed 42

# Plan only
python3 scripts/generate_help_bot_corpus.py --dry-run --target 50000

# Force Hinglish/module pool for all new rows
python3 scripts/generate_help_bot_corpus.py --target 50000 --focus hinglish --seed 42
python3 scripts/generate_help_bot_corpus.py --target 50000 --focus modules_only --seed 42
```

### Curated customer Hinglish (batch 060)

Realistic Roman Hindi / Hinglish from `curated/batch-060-entries.jsonl` (edit by hand, rebuild):

```bash
cd Backend
python3 scripts/build_curated_hinglish_batch_060.py
python3 scripts/_gen_curated_batch_061.py
python3 scripts/build_curated_batch.py --batch 61 --source curated/batch-061-entries.jsonl --count 1000 --slug-prefix mf --notes "MF + KYC + Settings Hinglish"
```

Templates and field paths live in `scripts/help_bot_corpus_templates.py`.

## Phase 0 — catalog, coverage, eval

| Artifact | Purpose |
|----------|---------|
| `field_catalog.json` | All context-pack dot paths + question hints |
| `coverage-report.json` / `.md` | % fields touched by training `context_fields` |
| `eval/eval-set.jsonl` | **250** held-out cases (not in train) |
| `eval/retrieval-report.json` | hit@k retrieval benchmark |

```bash
cd Backend
python3 scripts/help_bot_coverage_report.py
python3 scripts/generate_help_bot_eval_set.py --target 250
python3 scripts/eval_help_bot_retrieval.py --limit 3
python3 scripts/ci_help_bot_gates.py
```

Thresholds live in `manifest.json` → `eval` (`min_coverage_pct`, `min_retrieval_hit_at_3_pct`).

**CI:** Stage 2 runs `ci_help_bot_gates.py` on every pipeline (push/PR/schedule).

Catalog source of truth: `app/application/support/help_bot_field_catalog.py`.

## Compile corpus (stats + export + coverage)

One command refreshes field coverage, writes `compiled/dataset-summary.*`, and exports the full fine-tune JSONL:

```bash
cd Backend
python3 scripts/compile_help_bot_dataset.py
# Faster stats-only: --skip-export
# Smaller sample export: --max-export-rows 5000 --export-out /tmp/sample.jsonl
```

## Load into running bot (retrieval)

After adding or editing batches:

```bash
cd Backend
python3 scripts/import_help_bot_training_examples.py --all-batches --dry-run
python3 scripts/import_help_bot_training_examples.py --all-batches
# Or a single batch: --batch 60
```

Requires a one-time seed ticket (script creates or reuses `TRAIN-SEED`).

## Fine-tune (Phase 2 — context-rich export)

Synthetic packs mirror live `build_context_pack` slices. Each training row includes
**playbook + full masked JSON context + question**, and the assistant JSON is **grounded**
in that context (not field names only).

Factory: `app/application/support/synthetic_context_factory.py`

```bash
cd Backend

# Sample (curated batch 1)
python3 scripts/export_help_bot_finetune_jsonl.py --batches 1 --out /tmp/zynd-help-train.jsonl

# Full corpus (~52k rows — gitignored under exports/)
python3 scripts/compile_help_bot_dataset.py
# Or directly:
python3 scripts/export_help_bot_finetune_jsonl.py --batches all --out data/help-bot-training/exports/zynd-help-finetune-full.jsonl

# Include paraphrase variants + cap for dry runs
python3 scripts/export_help_bot_finetune_jsonl.py --batches all --include-paraphrases --max-rows 500 --out /tmp/sample.jsonl

# Legacy Phase 1 export (field names only)
python3 scripts/export_help_bot_finetune_jsonl.py --batches 1 --legacy --out /tmp/legacy.jsonl
```

Optional `--salt N` changes synthetic values while keeping rows deterministic per `id`.

After fine-tuning on your provider (OpenAI, Together, local MLX, etc.), point `SUPPORT_LLM_*` at that model. Production inference must still pass the **live** context pack (same prompt shape as export). Until then, Groq + retrieval over this corpus is the supported path.
