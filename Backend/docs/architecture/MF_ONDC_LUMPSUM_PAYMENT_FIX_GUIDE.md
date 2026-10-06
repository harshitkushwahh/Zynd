# ONDC lumpsum payment — MultiPlus vs Zynd (fix guide)

**Symptom (Zynd):** User taps **Invest now** (or finishes OTP) → payment overlay shows *“Payment couldn’t be completed / link no longer valid”* (or order `CANCELLED` with `failure_code: payment_abandoned`) with no redirect to `token_url`.

**Goal:** Align Zynd with the Cybrilla ONDC sequence MultiPlus uses in sandbox/production, and eliminate false `payment_abandoned` on a fresh invest attempt.

**Gateway:** `ZYND_MF_ORDER_PAYMENT_GATEWAY=ondc` → PG `provider_name: "ONDC"`.

**MultiPlus reference (external):** `PaymentService.java`, `CustomerPaymentResource.java`, `FintechPrimitivesClient.java`, `FpPaymentPostbackResource.java` — not in the Zynd repo; use your MultiPlus monorepo for side-by-side code review.

**Shorter API map:** [MF_ONDC_LUMPSUM_PAYMENT_FLOW.md](./MF_ONDC_LUMPSUM_PAYMENT_FLOW.md)

**Full MultiPlus vs Zynd (lumpsum + SIP + credentials):** [MF_PAYMENTS_MASTER_LUMPSUM_SIP.md](./MF_PAYMENTS_MASTER_LUMPSUM_SIP.md)

---

## 1. Cybrilla / Finprim reference sequence (lumpsum + ONDC PG)

| Step | Purpose | Finprim / Cybrilla API | State after success |
|------|---------|------------------------|-------------------|
| A | Create purchase | `POST /v2/mf_purchases` (`gateway: "ondc"`, scheme, amount, MFIA, `user_ip`, ARN/EUIN) | `under_review` → `pending` |
| B | Wait for review | `GET /v2/mf_purchases/{id}` | `pending` |
| C | Consent | `PATCH /v2/mf_purchases` `{ id, consent: { email, mobile, isd_code } }` | `pending` |
| D | Create PG | `POST /api/pg/payments/netbanking` (`amc_order_ids`, `bank_account_id`, `method`, `provider_name: "ONDC"`, `payment_postback_url`) | Payment + `token_url` |
| E | Confirm | `PATCH /v2/mf_purchases` `{ id, state: "confirmed" }` | → `submitted` |
| F | Poll | `GET` purchase + `GET /api/pg/payments/{id}` | `submitted` + `token_url` |
| G | Pay | Browser `token_url` → `payment_postback_url` | success / failed |
| H | Post-payment | Poll | `PROCESSING` / `SUCCEEDED` in Zynd |

**D before E (ONDC):** Payment create then confirm. Confirm-first leaves purchases stuck in `pending` without a PG row.

**IDs before D:** `mf_purchases.old_id`, `bank_accounts.old_id`, whitelisted `payment_postback_url`.

---

## 2. MultiPlus vs Zynd (behaviour)

| Phase | MultiPlus | Zynd |
|-------|-----------|------|
| Create FP purchase | Early in payment flow (step A) | `submit_pending_order` on first `advance_order_for_payment` / worker |
| Consent | `POST .../mf/purchase/{id}/consent` | `_apply_purchase_consent` |
| OTP | Product gate (~5 min) before pay | (product-specific if added) |
| Pay | `POST .../pay` → netbanking (D) + async confirm (E) | `_create_checkout_payment` then `_confirm_purchase_after_payment_setup` |
| Abandon | No lumpsum abandon API | `POST .../abandon-payment` → `payment_abandoned` |

---

## 3. Zynd Cybrilla map (code)

| Step | Function | File |
|------|----------|------|
| A | `submit_pending_order` → `create_mf_purchase` | `mf_ondc_order_service.py` |
| C | `_apply_purchase_consent` | same |
| D | `_create_checkout_payment` → `create_netbanking_payment` | same + `fp_payment_client.py` |
| E | `_confirm_purchase_after_payment_setup` | same |
| F | `_refresh_payment_link` | same |
| H | `reconcile_order_payment` | `mf_lumpsum_reconciliation_service.py` |

**Advance:** `GET /invest/orders/{id}/payment-status` (`force=True`), MF worker `advance_ondc_orders`.

**Dev logs:** `[FINPRIM]` HTTP, `[MF-PAY]` steps (`ZYND_MF_WORKER_LOG_TO_TERMINAL=true`).

---

## 4. Zynd Web — Invest now

| # | API | Purpose |
|---|-----|---------|
| 1 | `POST /invest/orders` | Local `PENDING` only |
| 2 | Overlay | `openOrderPayment(order_id)` |
| 3 | `GET .../payment-status` | Advance A–F; `next_action`, `payment_url` |
| 7 | `POST .../abandon-payment` | **Explicit** user cancel after gateway return only |

---

## 5. False “link no longer valid” — causes & fixes

| Priority | Cause | Zynd fix (status) |
|----------|--------|-------------------|
| P0 | Stale `sessionStorage` redirect flags | `clearMfPaymentSessionBeforeNewInvest()` before `POST /orders`; `clearAllMfPaymentRedirectFlags()` in `beginMfOrderPaymentSession` — **implemented** |
| P0 | Reused dead `order_id` / overlay resume | Resume only when `wasMfPaymentRedirected(orderId)`; pay route uses `resumeAfterGatewayReturn: true` — **implemented** |
| P0 | `abandon-payment` too eager | Abandon only when dismiss after `returnedFromPayment && gatewayReturnHandled` — **unchanged (already)** |
| P1 | Reconcile sets `payment_abandoned` | Reconcile → `payment_not_completed`; `payment_abandoned` only from abandon API — **implemented** |
| P1 | Cybrilla pipeline never runs | Worker autostart + payment-status advance; watch `[FINPRIM]` — **ops** |
| P2 | Idempotency returns `CANCELLED` row | `409 idempotency_reused_terminal` — **implemented** |
| P2 | UI mislabel on fresh order | `isFreshInvestOrder` → show `failure_reason`, not abandoned copy — **implemented** |
| P3 | Invalid postback | HTTPS ngrok URL in sandbox — **env** |

---

## 6. Checklist (one purchase)

See section 6 in [MF_ONDC_LUMPSUM_PAYMENT_FLOW.md](./MF_ONDC_LUMPSUM_PAYMENT_FLOW.md) — tick MFIA, purchase, consent, netbanking, confirm, submitted, `token_url`, postback, bank `old_id`.

---

## 7. Environment

```env
ZYND_MF_ORDERS_ENABLED=true
ZYND_MF_ORDER_PAYMENT_GATEWAY=ondc
ZYND_MF_PAYMENT_POSTBACK_URL=https://<public-host>/dashboard/mutual-funds/orders/payment-return
ZYND_MF_WORKER_AUTOSTART=true
ZYND_MF_WORKER_LOG_TO_TERMINAL=true
ZYND_MF_FP_USER_IP_FALLBACK=<public-ipv4>
```

---

## 8. Debug (one Invest click)

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/invest/orders/{order_id}/payment-status" | jq .
```

**Pass:** new UUID, `failure_code` null for 30s; `[FINPRIM] POST /v2/mf_purchases`; then `payment_url` + `next_action: pay_upi`.

---

## 9. Summary

| Topic | MultiPlus | Zynd fix focus |
|-------|-----------|----------------|
| Pay + confirm | D sync, E async | D → E in `mf_ondc_order_service` |
| Cancel | No abandon API | Stop reconcile from writing `payment_abandoned` |
| Instant bad copy | N/A | Session clear + fresh-order messaging |

*Last updated after Zynd P0/P1/P2 engineering fixes listed in §5.*
