# Compiled help-bot dataset summary

- **Training rows:** 52000
- **Manifest target:** 52000
- **Can answer (true / false):** 46646 / 5354
- **Paraphrase variants:** 2166
- **Hinglish-tagged questions/paraphrases (heuristic):** 27557
- **Curated Hinglish batches 060+061:** {'060': 1000, '061': 1000}
- **Unique context fields referenced:** 74

## Topics (row tag counts)

- `kyc`: 13931
- `payment`: 10018
- `account`: 8777
- `portfolio`: 7180
- `goals`: 5309
- `referrals`: 4082
- `family`: 3883

## Top context fields

- `kyc.overall_status`: 1268
- `payments.recent_orders`: 1049
- `account.email_verified`: 989
- `account.phone_verified`: 940
- `payments.sip_plans`: 935
- `referrals.signup_count`: 861
- `portfolio.holdings_count`: 860
- `referrals.kyc_verified_count`: 860
- `payments.sip_plans.status`: 855
- `portfolio.status`: 848
- `portfolio.current_value`: 841
- `portfolio.has_pending_orders`: 839
- `family_groups.groups`: 836
- `goals.goals`: 820
- `account.account_status`: 809
- `referrals.has_code`: 809
- `goals.goals.progress_pct`: 803
- `kyc.readiness_code`: 796
- `kyc.steps.bank`: 783
- `account.google_account_linked`: 777
- `portfolio.as_on`: 775
- `portfolio.total_return`: 774
- `referrals.first_investment_count`: 773
- `referrals.click_count`: 772
- `account.apple_account_linked`: 768

See also [coverage-report.md](../coverage-report.md).

## Fine-tune export

Chat JSONL (Phase 2 context-rich) is written under `exports/` by this script.
Use the same prompt shape as `export_help_bot_finetune_jsonl.py` for OpenAI-compatible fine-tunes.
Production help bot uses **retrieval + Groq** until a custom model is wired via `SUPPORT_LLM_*`.
