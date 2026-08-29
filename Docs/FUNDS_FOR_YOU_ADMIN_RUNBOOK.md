# Funds For You — Admin Runbook

Operational guide for configuring, publishing, and supporting the **Funds For You** recommendation engine in Zynd Admin.

---

## Where to go

**Admin → Recommendation engine → Funds For You** (`/dashboard/recommendations`)

Required permissions:

| Action | Permission |
| ------ | ---------- |
| View baskets, preview, readiness | `recommendations.read` |
| Create/edit baskets and fund pools | `recommendations.manage` |
| Publish configuration | `recommendations.publish` |

---

## Configure a tier (example: Moderate)

1. Open the **Funds For You** tab.
2. Select the **Moderate** tier tab.
3. Click **+** to create a basket (e.g. **Balanced Core**).
4. Use **Add fund** to search the investable MF catalog and build a pool of **at least 5 funds** (10–15 recommended for variety).
5. Reorder funds with arrow buttons; mark 1–2 as **Core** (anchor) if they should appear often.
6. Optionally set portfolio display name and objective in **Basket details**.
7. Repeat for additional baskets (e.g. **Growth Tilt**, **Income Focus**) to give the engine rotation options within the tier.
8. Paste a test user UUID in **Preview user** and confirm 5 funds + allocation chart render.
9. Review **Publish readiness** — all active baskets must show as **ready**.
10. Click **Publish** and confirm in the dialog. Note the new version number.

---

## Pre-publish checklist

- [ ] At least one active basket exists globally
- [ ] Every **active** basket has **≥ 5 investable funds** (lifecycle ACTIVE, purchasable, empanelled AMC)
- [ ] **Publish readiness** panel shows green “ready to publish”
- [ ] Preview checked for at least 2 sample user IDs on the target tier
- [ ] Stakeholder / compliance sign-off on fund lists (if required)

**Note:** Tiers with **no baskets** are allowed (investors on that tier see “Recommendations coming soon”). Tiers **with** baskets must have every active basket meeting the 5-fund minimum.

---

## After publish

1. Record version number and date in your ops log.
2. Verify in the **Web app** with a test user who has KYC + risk profile on the configured tier.
3. Watch **Runtime metrics** on the Funds For You panel for 24h:
   - Blocked vs eligible resolves
   - Snapshot hit rate (should rise as users reopen the popover)
   - Degraded resolves (fallback basket or snapshot rebuild)
4. Check **Audit log** on the same page for `Recommendation config published` events.

---

## Support playbook

### “Why does user X see fund Y?”

1. Look up `user_recommendation_snapshots` for `user_id`.
2. Note `basket_id`, `config_version`, and `fund_product_ids`.
3. Cross-check basket fund pool in Admin at publish time (audit log).
4. Confirm the user’s current `user_risk_profiles.tier` matches the snapshot tier.

### “User sees different funds after publish”

**Expected.** A publish bumps `config_version`, which invalidates snapshots. The user gets a new stable set on the next popover open.

### “User sees KYC / risk assessment / coming soon”

| Popover state | Cause |
| ------------- | ----- |
| Complete KYC | `user_kyc_status.overall_status != completed` |
| Take assessment | No `user_risk_profiles` row |
| Recommendations coming soon | No baskets for their tier |
| Recommendations unavailable | Baskets exist but none have 5 investable funds |

### “Publish button is disabled”

Open **Publish readiness** — resolve any **short pool** issues or create at least one active basket.

---

## API reference (ops)

| Endpoint | Purpose |
| -------- | ------- |
| `GET /admin/recommendations/publish-readiness` | Pre-publish validation |
| `POST /admin/recommendations/publish` | Bump published version (409 if not ready) |
| `GET /admin/recommendations/metrics` | In-process resolve counters |
| `GET /admin/recommendations/audit` | Basket + publish audit trail |
| `GET /admin/recommendations/preview` | Deterministic 5-fund preview |

Investor endpoint: `GET /invest/recommendations/funds-for-you`

---

## Logging

Backend emits structured logs on each resolve:

```
funds_for_you_resolved user_id=… tier=… eligible=… block_reason=… basket_id=… config_version=… snapshot_hit=… degraded=… duration_ms=…
```

Search application logs for `funds_for_you_resolved` when debugging production issues.
