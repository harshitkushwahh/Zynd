# Help bot training coverage report

- Training rows: **52000**
- Catalog fields: **68**
- Covered fields: **68** (100.0%)

## Rows by topic

- `account`: 8777
- `family`: 3883
- `goals`: 5309
- `kyc`: 13931
- `payment`: 10018
- `portfolio`: 7180
- `referrals`: 4082

## Missing catalog fields

_None — full field coverage._

## Top field hits

- `kyc.overall_status`: 1268
- `payments.recent_orders`: 1050
- `account.email_verified`: 989
- `account.phone_verified`: 940
- `payments.sip_plans`: 938
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
- `account.mfa_enrolled`: 768
- `payments.sip_plans.next_installment_date`: 767
- `family_groups.groups.status`: 767
- `kyc.pan_verification_status`: 766
- `kyc.status_last_updated_at`: 766

## Unknown context_field refs (not in catalog)

- `kyc.steps`: 39
- `payments.last_sip_failure`: 18
- `payments.last_sip_debit`: 2
- `payments.last_sip_failure.created_at`: 1
