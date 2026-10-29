# Existing folio nomination vs `folio_defaults` (Finprim / Cybrilla)

**Status:** Tracked — product + eng discovery (Oct 2025)  
**Related:** Settings nominees, Registered folios table, checkout nomination OTP

## Problem statement

Investors can buy MF on Zynd **without nominees**, get units allotted, and see a real AMC folio in **Registered folios** with **No nominee** (from `GET /v2/mf_folios`). If they **later add nominees in Settings**, we update investor **related parties** and **MFIA `folio_defaults`**, but the Registered folios row often **still shows No nominee** for that folio number.

Question: should Settings also update **nomination on folios already opened** (e.g. HDFC `44851151/97`)?

## What Zynd does today

| Step | API / code | Scope |
|------|------------|--------|
| Save nominees (after Zynd OTP) | `POST /kyc/settings/nominees` → `add_investor_nominee` | Investor profile |
| Create/update related parties | Finprim `/v2/related_parties` | Profile |
| Nominee template on MFIA | `patch_mfia_folio_defaults` → `PATCH /v2/mf_investment_accounts` with `folio_defaults.nominee1..3` | **MF investment account defaults** |
| Registered folios UI | `list_user_mf_folio_nominations` → `GET /v2/mf_folios` | **Per-AMC folio record at RTA/AMC** |

We **do not** call `PATCH /v2/mf_folios` (no client in `oms_client.py`). We only **read** folios.

Additional purchases **reuse** an existing folio when possible (`mf_folio_reuse_service.py` — same AMC / ISIN).

## What Finprim documents say

### 1. `folio_defaults` = new folio registration only

From [Open an investment account](https://docs.fintechprimitives.com/mf-transactions/investment-account/):

> When a **new folio is opened** as part of fresh purchase, the information … is taken from the **`folio_defaults`** hash. **There is no option to override** this information while placing an order.

Nomination workflow (Investor Profile APIs):

1. Create `investor_profile`
2. Create `related_party` (nominee)
3. Update **`mf_investment_accounts.folio_defaults`**
4. Place the order

If nominee fields are **missing** in `folio_defaults`, FP treats the investor as **not wishing to nominate** for orders that **create a new folio**.

### 2. New folio vs existing folio at checkout

From [One-time purchases](https://docs.fintechprimitives.com/mf-transactions/onetime-purchases/):

- **Nomination OTP/consent (step 3)** is required for **new folio creation** only.
- For **existing folio**, consent OTP goes to **folio-registered** mobile/email (`mf_folios`), not only MFIA defaults.

Zynd mirrors this in copy: new folios use saved nominees + checkout consent; additional buys into an existing folio keep **that folio’s AMC registration**.

### 3. `mf_folios` object

API reference lists:

- `GET /v2/mf_folios`
- **`Patch /v2/mf_folios`** (endpoint listed; **request body not present** in the public HTML export we reviewed — treat as **undocumented / confirm with Cybrilla**)

Folio object exposes `nominee1..3` as **objects** (name, dob, relationship, guardian, …) — this is **AMC/RTA-side** state, not `relp_*` IDs.

### 4. Order failures tied to folio nomination

From [Failure codes](https://docs.fintechprimitives.com/mf-transactions/failure-codes/):

| Code | Meaning |
|------|---------|
| `folio_nominee_opt_in_missing` | Nomination not declared for **the folio** — add nominees **or opt out** before another order |
| `nomination_declaration_missing` | Nomination opt-in/out missing for **folio associated with the order** |

These refer to **folio-level** declaration, not only MFIA defaults — relevant when continuing to transact on a folio that was opened without nomination.

### 5. Market infrastructure (outside FP API docs)

BSE circular (May 2025): **NFT (non-financial transaction)** facility for **add/modify/delete nominee on existing folios** at the exchange/RTA layer. Finprim may expose this via **`PATCH /v2/mf_folios`** or a separate NCT flow — **not implemented in Zynd**; confirm with **fpsupport@cybrilla.com**.

## Answer for the HDFC / first-buy scenario

| Action | Updates `folio_defaults`? | Updates `44851151/97` in `mf_folios`? |
|--------|-------------------------|----------------------------------------|
| First buy, no nominees at order time | Empty / opt-out at creation | Folio registered **without** nominee → **No nominee** in UI |
| Later: Settings add nominees | **Yes** | **No** (not via current Zynd code) |
| Next buy, **same** folio reused | Defaults irrelevant for nomination on that folio | Still AMC record unless folio nomination is updated |
| Next buy, **new** AMC (new folio) | **Yes** — nominees from defaults + new-folio checkout consent | New folio row reflects nomination chosen at creation |

So **`folio_defaults` is the correct Finprim knob for “what to use when opening the next folio”**, not a guaranteed **retroactive** update to folios already registered with **no nominee**.

## Open questions for Cybrilla

1. **`PATCH /v2/mf_folios`** — full schema, supported fields, AMC coverage (ONDC vs RTA), and whether nominee changes propagate to RTA asynchronously.
2. Is there a dedicated **nomination change / NCT** API vs MFIA `folio_defaults` PATCH?
3. Sandbox: after successful purchase without nominees, does PATCH folio nomination update `GET /v2/mf_folios` for the same `folio_number`?
4. Required **consent** for existing-folio nomination change (folio mobile OTP vs investor profile OTP vs video for opt-out).

## Engineering options (when product wants retroactive nomination)

**Option A — Status quo + clear UX**  
Keep Settings → `folio_defaults` only; Registered folios stays honest AMC read-back; copy already explains new vs existing folios.

**Option B — Existing folio nomination service (FP-dependent)**  
After Settings save (and OTP):

1. List active folios with units (`mf_folios` + holdings).
2. For each folio with `nominee*` empty, call **`PATCH /v2/mf_folios`** (once documented) or Cybrilla NCT wrapper.
3. Use **folio-registered** mobile/email for consent (may differ from Zynd account OTP).
4. Poll or refresh until `mf_folios` reflects change.

**Option C — Block / warn on repeat purchase**  
If `folio_nominee_opt_in_missing` is a risk, surface failure-code guidance when user has “no nominee” folios and tries to invest again on same folio.

## Suggested next steps

1. **Product:** Decide whether retroactive nomination on **first folio** is in scope for MVP or “new folios only” remains policy.
2. **Eng:** Email Cybrilla support with folio `44851151/97` sandbox repro + ask for PATCH `/v2/mf_folios` nomination spec.
3. **Eng:** Spike in sandbox: Settings save → compare `mf_folios` before/after (expect no change today).
4. **Eng:** If PATCH exists, add `update_mf_folio_nomination` to `oms_client.py` and a job triggered post–Settings save (with folio-level OTP gate).

## References

- Finprim investment account / folio defaults: https://docs.fintechprimitives.com/mf-transactions/investment-account/
- Finprim one-time purchases (new vs existing folio consent): https://docs.fintechprimitives.com/mf-transactions/onetime-purchases/
- Finprim nomination compliance notes: https://docs.fintechprimitives.com/compliance/changes/revised-nomination-structure-to-reduce-unclaimed-assets/
- Finprim failure codes: https://docs.fintechprimitives.com/mf-transactions/failure-codes/
- Zynd: `mf_folio_defaults_service.py`, `mf_folio_nomination_service.py`, `investor_settings_service.add_investor_nominee`
