# ONDC lumpsum payment — Cybrilla / Finprim (Multiplus) vs Zynd

**Fix guide (MultiPlus comparison + P0/P1 checklist):** [MF_ONDC_LUMPSUM_PAYMENT_FIX_GUIDE.md](./MF_ONDC_LUMPSUM_PAYMENT_FIX_GUIDE.md)

**Master reference (lumpsum + SIP, tokens, MultiPlus REST vs Zynd):** [MF_PAYMENTS_MASTER_LUMPSUM_SIP.md](./MF_PAYMENTS_MASTER_LUMPSUM_SIP.md)

Use this doc to compare **Cybrilla’s expected OMS + PG sequence** (Finprim API / Multiplus tenant) with **what Zynd calls**, in what order, and which **Zynd HTTP APIs** the Web app hits.

Gateway mode: `ZYND_MF_ORDER_PAYMENT_GATEWAY=ondc` (PG `provider_name`: `ONDC`).

---

## 1. Cybrilla / Finprim reference sequence (lumpsum + ONDC PG)

Typical live flow for a **single purchase** after the investor is KYC-ready and MFIA exists:

| Step | Purpose | Finprim / Cybrilla API (tenant base URL) | Purchase / payment state after success |
|------|---------|-------------------------------------------|----------------------------------------|
| A | Create purchase | `POST /v2/mf_purchases` (`gateway: "ondc"`, scheme, amount, MFIA, `user_ip`, distributor ARN/EUIN if configured) | Often `under_review` → then `pending` |
| B | Wait for review | Poll `GET /v2/mf_purchases/{id}` | `pending` when ready for consent |
| C | Investor consent | `PATCH /v2/mf_purchases` body `{ id, consent: { email, mobile, isd_code } }` | Still `pending`; consent stored at partner |
| D | Create PG payment | `POST /api/pg/payments/netbanking` with `amc_order_ids` (numeric **old_id**), `bank_account_id` (numeric), `method` (`UPI` / `NETBANKING`), `provider_name: "ONDC"`, **`payment_postback_url`** | Payment row + `token_url` (UPI URI or redirect URL) |
| E | Confirm purchase | `PATCH /v2/mf_purchases` body `{ id, state: "confirmed" }` | Moves toward **`submitted`** |
| F | Poll purchase + payment | `GET /v2/mf_purchases/{id}`, `GET /api/pg/payments/{payment_id}` | `submitted` + valid `token_url` until investor pays |
| G | Investor pays at gateway | Browser opens `token_url`; partner redirects to **`payment_postback_url`** | Payment status → success / failed |
| H | Post-payment | Poll payment + purchase; FP states → `confirmed` / AMC processing / `successful` | Zynd maps to `PROCESSING` / `SUCCEEDED` |

**Order of D vs E:** For ONDC, Cybrilla expects **payment creation (D) then confirm (E)** so the purchase can reach **`submitted`** and expose a usable **`token_url`**. Confirm-before-payment leaves purchases stuck in **`pending`** with no PG row.

**IDs that must exist before step D:**

| Field | Source |
|-------|--------|
| `mf_purchases.old_id` (amc order id) | From create/poll purchase — stored as `mf_orders.fp_purchase_old_id` |
| `bank_accounts.old_id` | Synced investor bank — `investor_bank_accounts.external_old_id` |
| `payment_postback_url` | `ZYND_MF_PAYMENT_POSTBACK_URL` or per-order URL from `resolved_mf_payment_postback_url_for_order` |

**Common Cybrilla-side blockers (no PG call or no token_url):**

- Purchase still `under_review` (step B not finished).
- Consent not applied (step C skipped).
- Missing / invalid `bank_account_id` or `amc_order_ids`.
- `payment_postback_url` rejected (localhost not whitelisted in sandbox — use ngrok HTTPS in `.env`).
- Confirm never sent after payment create (step E).

Official API details: Finprim / Cybrilla partner docs for **MF Purchases v2** and **PG Payments (netbanking / ONDC)** on your tenant (`api.fintechprimitives.com` or sandbox host).

---

## 2. Zynd backend — Cybrilla calls (code map)

Implementation: `Backend/app/application/mf/mf_ondc_order_service.py`  
HTTP client: `Backend/app/infrastructure/mf/fp_oms_client.py`, `fp_payment_client.py`  
Terminal traces (dev): `[FINPRIM]` per HTTP call, `[MF-PAY]` for pipeline steps.

| Cybrilla step | Zynd function | When it runs |
|---------------|---------------|--------------|
| A Submit purchase | `submit_pending_order` → `create_mf_purchase` | First `advance_order_for_payment` / worker when order is `PENDING` and MFIA ready |
| B Poll purchase | `get_mf_purchase` inside `advance_ondc_order` | Each advance / reconcile |
| C Consent | `_apply_purchase_consent` → `update_mf_purchase(consent=…)` | `fp_state == pending` and `metadata.ondc.consent_applied` false |
| D Netbanking PG | `_create_checkout_payment` / `_create_cart_checkout_payment` → `create_netbanking_payment` | After consent; sets `payment_created`, `fp_payment_id`, checkout `token_url` if returned |
| E Confirm | `_confirm_purchase` / `_confirm_purchase_after_payment_setup` | After `payment_created`; sets `purchase_confirmed` |
| F Refresh link | `_refresh_payment_link` → `get_payment` | `submitted` or after confirm; syncs `checkout.token_url` |
| G Postback | Browser → `ZYND_MF_PAYMENT_POSTBACK_URL` (Web route) | After investor completes / cancels at gateway |
| H Reconcile | `reconcile_order_payment` → `fetch_order_fp_truth` / `apply_order_fp_truth` | Every payment-status poll |

**Local ONDC flags** (`mf_orders.metadata.ondc`):

- `consent_applied`
- `payment_created`
- `fp_payment_id`
- `purchase_confirmed`
- `payment_success`
- `fp_payment_status` (from PG poll)

**Advance triggers:**

- MF worker: `run_mf_transaction_workers.py --orders` → `advance_ondc_orders` (every `ZYND_MF_ORDER_WORKER_TICK_SECONDS`).
- User-facing: `GET /invest/orders/{id}`, `GET /invest/orders/{id}/payment-status`, journey endpoint — all call `advance_order_for_payment` / `reconcile_order_payment` with `force=True` on payment-status.

---

## 3. Zynd platform APIs (Web app — Invest now)

Flow when the user clicks **Invest now** on a fund (`mf-invest-payment-card.tsx`):

| # | Method | Path | Purpose |
|---|--------|------|---------|
| 1 | `POST` | `/api/v1/invest/orders` | Create local checkout + order (`PENDING`). **Does not** call Cybrilla yet. |
| 2 | (overlay) | — | `openOrderPayment(order_id)` → `MfOrderPayView` |
| 3 | `GET` | `/api/v1/invest/orders/{order_id}/payment-status` | **Main poll**: reconcile + advance ONDC pipeline; returns `outcome`, `order`, `fp_payment_status`. |
| 4 | `GET` | `/api/v1/invest/orders/{order_id}` | Fallback fetch if reconcile throws; also advances order. |
| 5 | (browser) | `order.payment_url` (`checkout.token_url`) | Auto-open when `next_action === "pay_upi"` and URL present. |
| 6 | `POST` | `/api/v1/invest/orders/{order_id}/confirm-payment-return` | Optional explicit return sync (return route / postMessage). |
| 7 | `POST` | `/api/v1/invest/orders/{order_id}/abandon-payment` | User dismisses overlay after returning from gateway — sets **`CANCELLED` + `failure_code: payment_abandoned`**. |

**`next_action` (UI gating)** — `mf_order_service._derive_next_action`:

| Order status | `payment_url` | `next_action` | UI behaviour |
|--------------|---------------|---------------|--------------|
| `PENDING` | — | `wait_processing` | “Processing” — waiting for submit + ONDC advance |
| `PROCESSING` | — | `wait_review` | Under review at Cybrilla |
| `PAYMENT_PENDING` | set | `pay_upi` | Redirect / popup to gateway |
| `SUBMITTED` | set | `pay_upi` | Same |
| `SUBMITTED` | missing | `wait_payment_link` | Waiting for token URL |
| `CANCELLED` / `FAILED` | — | `failed` | Error dialog |

Invest now is **not** complete until step 3 has advanced through Cybrilla steps A–F and returned `pay_upi` with a URL.

---

## 4. Side-by-side checklist (compare with Multiplus)

Use Cybrilla dashboard / API logs for one `mfp_*` purchase and tick each row:

| # | Multiplus / Cybrilla expectation | Zynd implementation | Verify in logs / DB |
|---|----------------------------------|---------------------|---------------------|
| 1 | MFIA exists on tenant | `_ensure_fp_mfia` on submit | `mf_investment_accounts.fp_mfia_id` |
| 2 | `POST /v2/mf_purchases` | `submit_pending_order` | `mf_orders.fp_purchase_id`, `fp_state` |
| 3 | State reaches `pending` | Poll in `advance_ondc_order` | `GET` purchase state |
| 4 | Consent PATCH | `_apply_purchase_consent` | `metadata.ondc.consent_applied=true` |
| 5 | `POST /api/pg/payments/netbanking` | `_create_checkout_payment` | `[MF-PAY] netbanking_payment_created`, `fp_payment_id` |
| 6 | PATCH `state: confirmed` | `_confirm_purchase_after_payment_setup` | `[MF-PAY] purchase_confirmed_after_payment_setup` |
| 7 | Purchase `submitted` | Poll + `_apply_fp_state` | `fp_state=submitted`, status `SUBMITTED` |
| 8 | `token_url` on payment / checkout | `_refresh_payment_link` | `mf_checkouts.token_url`, API `payment_url` |
| 9 | Postback URL whitelisted | `.env` `ZYND_MF_PAYMENT_POSTBACK_URL` | Must match Web return route host |
| 10 | Bank `old_id` on PG request | `external_old_id` on selected bank | Error `bank_old_id_missing` if missing |

If any row **1–6** is missing in `[FINPRIM]` terminal output, the UI will stay on “processing” or fail before redirect — not necessarily “link no longer valid”.

---

## 5. Why “Payment couldn’t be completed / link no longer valid” appears

Copy keys: `paymentJourneyFailedTitle` + `orderPayAbandoned` (`Web/src/shared/config/copy.ts`).

The UI shows that **abandoned** text only when:

1. **`order.failure_code === "payment_abandoned"`** (usually **`status: CANCELLED`**), or  
2. The app thinks the user **returned from the gateway** (`sessionStorage` `mf-payment-redirected-{orderId}`) and reconcile outcome is **`failed`** / order is terminal.

So an **immediate** error on Invest now usually means one of:

| Cause | What to check |
|-------|----------------|
| **Re-opening a cancelled order** | Same `order_id` as a prior attempt (`payment_abandoned`). Admin: order journey / events. New Invest should create a **new** UUID order unless `idempotency_key` is reused. |
| **Stale payment overlay resume** | `sessionStorage` keys `mf-payment-redirected-*`, `mf-payment-last-order-id`. Hard refresh or clear site data; ensure overlay uses `beginMfOrderPaymentSession` on fresh Invest. |
| **`POST …/abandon-payment`** | Prior dismiss of payment dialog called abandon on this order. |
| **Payment-status `outcome: failed`** with cancelled + abandoned | `GET …/payment-status` response body right after Invest. |

It is **not** the generic message for `bank_old_id_missing`, `consent_contact_missing`, or FP 4xx — those typically show **`failure_reason`** from the partner unless the order was already marked abandoned.

**Debug commands (replace IDs):**

```bash
# API (with user token)
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/invest/orders/{order_id}/payment-status" | jq .

# DB
# mf_orders.status, failure_code, fp_state, metadata->ondc
# mf_checkouts.token_url, fp_payment_id
```

**Dev logging:** `./run.sh` with `ZYND_MF_WORKER_LOG_TO_TERMINAL=true` — watch `[FINPRIM]` and `[MF-PAY]` while clicking Invest now.

---

## 6. Environment variables (payment-specific)

| Variable | Role |
|----------|------|
| `ZYND_MF_ORDERS_ENABLED` | Gate `POST /invest/orders` |
| `ZYND_MF_ORDER_PAYMENT_GATEWAY` | `ondc` → PG provider `ONDC` |
| `ZYND_MF_PAYMENT_POSTBACK_URL` | Sent in PG create (must be acceptable to Cybrilla) |
| `FP_*` / Finprim runtime | OAuth + `x-tenant-id` for all `[FINPRIM]` calls |
| `ZYND_MF_WORKER_AUTOSTART` | Background ONDC advance if user is not polling |
| `ZYND_MF_FP_USER_IP_FALLBACK` | Public IP when client IP is private (required for some tenants) |

Example postback (local Web on 7777):

```env
ZYND_MF_PAYMENT_POSTBACK_URL=http://localhost:7777/dashboard/mutual-funds/orders/payment-return
```

---

## 7. Known gaps / differences to validate with Multiplus

1. **Submit timing** — Cybrilla submit (step A) happens on **first advance**, not on `POST /invest/orders`. Multiplus may create purchase earlier/later; Zynd always defers to advance/worker.  
2. **Review states** — While `under_review` / `review_completed`, Zynd does not create PG payment (`_REVIEW_STATES` guard).  
3. **Payment return route** — Postback lands on Web; overlay should resume with redirect session intact (`resumeAfterGatewayReturn` — see `mf-payment-overlay-context.tsx` / pay route host).  
4. **Cart checkout** — Same Cybrilla sequence via `_create_cart_checkout_payment` + batch confirm (`mf_ondc_order_service.advance_ondc_cart_checkout`).

---

## 8. File index

| Area | Path |
|------|------|
| ONDC pipeline | `app/application/mf/mf_ondc_order_service.py` |
| Payment reconcile | `app/application/mf/mf_lumpsum_reconciliation_service.py` |
| Payment advance on read | `app/application/mf/mf_payment_flow_service.py` |
| Invest API | `app/api/v1/invest/router.py` |
| FP OMS + PG HTTP | `app/infrastructure/mf/fp_oms_client.py`, `fp_payment_client.py` |
| FP state mapping | `app/application/mf/mf_fp_state.py` |
| Web pay UI | `Web/src/features/invest/components/mf-order-pay-view.tsx` |
| Web Invest CTA | `Web/src/features/invest/components/mf-invest-payment-card.tsx` |

---

*Last updated to match the ONDC “payment create → confirm → submitted → token_url” sequence implemented in `mf_ondc_order_service`.*
