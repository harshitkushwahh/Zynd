# Investor profile (Cybrilla v2) — foundation

## Purpose

Store Cybrilla **investor profile** objects (`invp_*`) and linked v2 resources locally so MF orders and payments can be added without redesigning KYC.

KYC onboarding continues to use **POA pre-verifications** and **kyc_forms**. On **KYC completion**, local investor profile drafts are seeded from the journey; Cybrilla `invp_*` provisioning remains deferred until payment/MF sync.

## Tables

| Table | Cybrilla v2 resource | Notes |
|-------|---------------------|--------|
| `investor_profiles` | Investor profile | One row per user; `external_profile_id` = `invp_*` when active |
| `investor_bank_accounts` | `/v2/bank_accounts` | Multiple allowed; seeded from KYC bank draft |
| `investor_addresses` | `/v2/addresses` | Residential address from KYC contact draft |
| `investor_email_addresses` | `/v2/email_addresses` | From Zynd user email |
| `investor_phone_numbers` | `/v2/phone_numbers` | From Zynd user phone |
| `investor_related_parties` | `/v2/related_parties` | Nominees from KYC nominee draft (`party_relationship` column) |

## Lifecycle

```
KYC complete
        │
        ▼
on_kyc_completed() → seed_investor_drafts_from_kyc()
  → investor_profiles.status = pending
  → child rows = draft (bank, address, email, phone, nominees)
        │
        ▼
First payment / MF order attempt (future)
        │
        ▼
ensure_pending_investor_profile_for_payment()
        │
        ▼
(Future) provision_investor_profile job
  → POST Cybrilla investor profile + child objects
  → status = active, store invp_*, bac_*, etc.
        │
        ▼
MF / payment APIs use external IDs
```

## Integration point (when payments land)

Call from payment or MF order service **before** hitting Cybrilla transaction APIs:

```python
from app.application.investor.investor_profile_service import (
    ensure_pending_investor_profile_for_payment,
)

profile = await ensure_pending_investor_profile_for_payment(db, user_id=user.id)
if profile.status != InvestorProfileStatus.active:
    await enqueue_provision_investor_profile(user_id=user.id)  # future worker
```

## Sync status on child rows

| Status | Meaning |
|--------|---------|
| `draft` | Copied from KYC/user data locally |
| `pending_create` | Queued for Cybrilla POST |
| `active` | `external_*_id` set |
| `failed` | Cybrilla create/update failed |

## What is NOT in scope yet

- Cybrilla `POST /v2/investor_profiles` client (profile creation API — confirm exact endpoint with Cybrilla docs)
- Payment or MF order modules
- Multiple bank UI in settings (schema supports multiple rows)

## Code (seeding)

- `app/application/investor/investor_profile_seed_service.py`
- `app/application/kyc/kyc_completion_service.py`

## Migration

`025_investor_profile_foundation.py`

## Code

- Models: `app/infrastructure/persistence/investor_models.py`
- Repository: `app/infrastructure/persistence/repositories/investor_profile_repository.py`
- Service stub: `app/application/investor/investor_profile_service.py`
