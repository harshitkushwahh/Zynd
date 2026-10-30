# Held-out eval set (Phase 0)

`eval-set.jsonl` is **never** merged into `batch-*.jsonl` training files.

Each row includes:

- `question`  prefixed with `EVAL ` to avoid train collision
- `topics`, `context_fields`  expected scope
- `expected_can_answer`  gold refusal vs answer
- `rubric`  human or LLM-judge scoring notes
- `answer_must_contain`  optional substring checks for automated tests

## Regenerate

```bash
cd Backend
python3 scripts/generate_help_bot_eval_set.py --target 250
```

## Retrieval score (hit@3)

```bash
python3 scripts/eval_help_bot_retrieval.py --limit 3
```

Writes `eval/retrieval-report.json`. Re-run after adding training batches.

## Policy regression (answer + escalation, no LLM)

`policy-regression.jsonl` simulates real chat turns (including failed/completed payments and follow-ups like “why?”). CI runs:

```bash
cd Backend
python3 scripts/eval_help_bot_policy.py
```

Cases assert:

- A **customer reply** exists when account data supports it (no bogus “can’t confirm” + ticket).
- **No escalation** when a grounded reply is available (even if the mock LLM sets `needs_agent`).
- **Plain-language “why failed”** beats bullet dumps of raw failure codes.

Add a row when fixing a production Help Bot regression; keep `manifest.json` → `eval.policy_regression_count` in sync.
