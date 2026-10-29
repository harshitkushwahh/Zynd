# Zynd zero-touch lookup (ZTO)  product spec & Multiplus reference

**Canonical doc for Zynd.** Multiplus remains a read-only implementation reference; behavioral differences called out below are **authoritative for Zynd**.

**Multiplus source (reference only):**  
`/Users/THUNDERFANG1/Desktop/MultiPlus Core/Main/multiplus`  
Runbooks: `readme/ZTO_KYC_FLOW_RUNBOOK.md`, `readme/zto-data-model.md`, `readme/KYC_ARCHITECTURE_MODEL.md` (§14.2, §15).

**Status in Zynd (today):** ZTO lookup APIs, consent storage, and review UI are **not implemented**. Post-lookup KYC patterns (DigiLocker, POA bank preverify, journey drafts) already exist  see [KYC_DIGILOCKER_FLOW.md](./KYC_DIGILOCKER_FLOW.md).

---

## 1. Zynd product summary

Zero-touch onboarding uses Cybrilla **Lookup APIs** to attempt **bank account** and **demographic** data for an investor whose **mobile is already OTP-verified at signup**. Data is **not trusted KYC**: it is fetched from third parties, shown for **explicit accept/decline**, stored **encrypted** until accept, then held in a **separate approved ZTO store** used only to **prefill wizard inputs**. Verification (DigiLocker, POA PAN/bank preverify, etc.) and writes to **KYC journey state / profile tables** follow today’s rules and require the user to click existing **Verify** actions.

Cybrilla notes (paraphrased): lookups are best-effort; accuracy is not validated; share fetched details with the investor and proceed only after approval.

---

## 2. Signup  dual consent (UI + backend)

### 2.1 UI

- Two **separate** checkboxes on signup, **not pre-checked** (Cybrilla go-live requirement).
- **Bank Account Lookup** consent and **Customer Data Lookup** consent  distinct labels; do not merge into one checkbox.
- Replace `<partner>` with the **Zynd brand name** in displayed text and in consent payloads sent to Cybrilla (Multiplus uses `Multiplus` via `ZeroTouchConstants.PARTNER_NAME` / `zeroTouchConsentCopy.js`).

**Cybrilla-approved templates (verbatim except `<partner>`):**

| Purpose | Template |
|---------|----------|
| Bank | `I allow <partner> to fetch my bank account details using my phone number via Cybrilla and its partners.` |
| Customer | `I allow <partner> to fetch my demographic details using my phone number and name from the credit bureau via Cybrilla and its partners.` |

**Example (Zynd):**  
`I allow Zynd to fetch my bank account details using my phone number via Cybrilla and its partners.`

Multiplus mirrors the same strings in:

- `backend/.../zerotouch/ZeroTouchConstants.java` (`CUSTOMER_CONSENT_TEMPLATE`, `BANK_CONSENT_TEMPLATE`)
- `webapp/.../zerotouch/zeroTouchConsentCopy.js`
- Signup UI: `webapp/src/views/auth/forms/AuthSignupNewStep.jsx` (checkboxes default **unchecked**)

**Product pairing (align with Multiplus `ztoConsentPair.js`):** smart onboarding is **all-or-nothing**  either **both** consents checked or **both** unchecked. Mixed state blocks Continue. If both unchecked, skip ZTO (manual KYC only).

### 2.2 Backend

- Persist **two rows** (or equivalent) in **`zto_consent_records`**, one per lookup type, including:
  - purpose: `ZERO_TOUCH_BANK_LOOKUP` / `ZERO_TOUCH_CUSTOMER_LOOKUP` (Multiplus purpose codes)
  - `text` (final string with `Zynd`, must match Cybrilla-approved template)
  - `mode`: `checkbox`
  - `collected_at`, client `ip_address`
  - link to user / signup session
- **Do not** call Cybrilla lookup APIs before both consents are stored and mobile OTP is verified.

### 2.3 Phone number

- Mobile is verified during signup OTP. **Do not** ask for mobile again on lookup create.
- Server resolves **verified phone** from auth/session and passes it to `POST /v2/bank_account_lookups` and `POST /v2/customer_data_lookups`.

---

## 3. End-to-end flow (Zynd)

```mermaid
sequenceDiagram
  participant User
  participant Web as Zynd Web
  participant API as Zynd Backend
  participant Cyb as Cybrilla Lookup APIs
  participant KYC as KYC wizard

  User->>Web: Signup  mobile OTP + dual ZTO checkboxes (unchecked by default)
  Web->>API: Record both consents (zto_consent_records)
  User->>Web: Tell us your name
  Web->>API: Start ZTO lookups (verified phone server-side; name from this step)
  API->>Cyb: POST /v2/bank_account_lookups (+ bank consent block)
  API->>API: Poll GET bank until terminal or timeout
  API->>Cyb: POST /v2/customer_data_lookups (name + phone + customer consent)
  API->>API: Poll GET customer until terminal or timeout
  API->>API: Encrypt + store raw fetch (zto_lookup_fetches); update registries
  User->>Web: Dashboard / onboarding gate
  Web->>User: Review dialog (lookup.png)  name, PAN, bank, IFSC, address, DOB
  alt User accepts
    User->>Web: Edit fields in dialog (optional) then Accept
    User->>API: Accept with final field values
    API->>API: Write zto_approved_profile (lookup snapshot + user-approved values per field)
  else User declines
    User->>API: Decline  discard pending fetch for journey purposes
  end
  User->>KYC: Wizard  inputs prefilled from zto_approved_profile (one-time UI seed)
  User->>KYC: Verify PAN / bank / address via existing partner flows
  KYC->>API: Journey state & KYC tables update only on verified paths (unchanged)
```

### 3.1 Step order

1. **Signup:** mobile OTP + terms + **both** ZTO consents (or neither → no ZTO).
2. **After “Tell us your name”:** backend starts lookups  **bank first**, then **customer** using the name from that step (not signup). No mobile re-collection.
3. **Dashboard onboarding gate** (same intent as Multiplus `ZeroTouchDashboardReviewGate`): if usable lookup data exists and user has not accepted/declined, block normal onboarding until the review dialog completes.
4. **KYC wizard:** read **`zto_approved_profile`** only for **initial input prefill**; verification and persistence unchanged.

### 3.2 Lookup orchestration (backend)

1. Require verified mobile + both consents + ZTO feature enabled.
2. **Bank lookup** → poll `GET /v2/bank_account_lookups/{id}` (interval/attempts configurable; Multiplus default **5 × 2000 ms**).
3. **Customer lookup** with `name` from “Tell us your name” + same verified phone → poll `GET /v2/customer_data_lookups/{id}`.
4. On terminal success: store encrypted payloads in **`zto_lookup_fetches`**; set phase **`REVIEW_PENDING`**.
5. On terminal failure: **`LOOKUPS_FAILED`**  retry path + manual KYC fallback (Multiplus: `flow/retry`).

**Usage limits (Cybrilla + registry):**

| Lookup | Limit |
|--------|--------|
| Bank | **Once per phone number** |
| Customer | **Once per phone + normalized name** |

Track in **`zto_phone_registry`** (and/or split bank/customer registry tables) to avoid duplicate Cybrilla calls and to reuse rows after internal purge per ops policy.

---

## 4. Review / confirmation dialog (Zynd UI)

### 4.1 Shell and assets

- Use Zynd **`BrandDialog`** pattern (`Web/src/components/ui/brand-dialog.tsx`), same family as e.g. `PortfolioActionConsentDialog`.
- Hero illustration: **`/lookup.png`** → file **`Web/public/lookup.png`**.  
  *(Asset expected by product; not present in repo at doc time  add before ship. Other onboarding art lives under `Web/public/`, e.g. `profile-details.png`, `kyc-glass.png`.)*

### 4.2 Fields shown (editable form)

The review step is a **confirmation form**, not read-only copy. Cybrilla requires that investors can **review and edit** fetched data before proceeding; Zynd implements that **in this dialog** (not only later in the KYC wizard).

Show only what Zynd needs for confirmation (not the full bureau JSON unless an edit control needs it):

| Field | Initial value in form | Lookup source |
|-------|----------------------|---------------|
| **Name** | “Tell us your name” (may compare to customer `data.name`) | User step + optional customer lookup |
| **PAN** | Customer lookup | Customer lookup |
| **Bank account number** | Bank lookup | Bank lookup |
| **IFSC** | Bank lookup | Bank lookup |
| **Address** | Customer lookup (primary / formatted line) | Customer lookup |
| **DOB** | Customer lookup | Customer lookup |

- All fields above are **inputs the user may change** before Accept.
- Do **not** surface Aadhaar, income slab, email lists, etc. in the default confirmation view unless product later expands edit mode.
- Validation on Accept: basic format checks (PAN, IFSC, DOB)  same spirit as KYC inputs; block Accept with inline errors if invalid.

### 4.3 Accept / decline behavior

- Primary **Accept** and secondary **Cancel / Decline**.
- **Modal must not dismiss** until the user explicitly accepts or declines: no backdrop close, no Escape, no header close (Multiplus: `ZeroTouchLookupReviewDialog` with `requireDecision={true}` sets `onClose` undefined on the modal shell).
- **Until accept:** raw lookup payloads stay in **`zto_lookup_fetches`**  **encrypted at rest** (industry-standard algorithms, e.g. AES); **not** copied to journey drafts or KYC profile tables.
- **On accept:** persist to **`zto_approved_profile`** (second layer, logically separate from encrypted fetch storage):
  - For **each** review field, store **what Cybrilla returned** (normalized from lookup) **and** **what the user submitted** on Accept.
  - If the user did not change a field, `*_approved` equals `*_from_lookup` and `*_edited` is false.
  - If the user changed a field, `*_approved` is the edited value and `*_edited` is true (audit + Cybrilla review).
  - **Wizard prefill** uses **`*_approved`** columns only  never re-applies raw lookup over user edits.
- **On decline:** do not write `zto_approved_profile`; user continues manual KYC. Pending encrypted fetch may be retained for audit per retention policy.

### 4.4 Accept payload (API contract sketch)

`POST …/zero-touch/review/accept` body carries final form values; backend merges with normalized lookup snapshot:

```json
{
  "name": "…",
  "pan": "…",
  "date_of_birth": "…",
  "bank_account_number": "…",
  "ifsc_code": "…",
  "address_line": "…"
}
```

Server derives `*_from_lookup` from decrypted `zto_lookup_fetches`, compares to body, sets `*_edited` flags, writes one **`zto_approved_profile`** row.

---

## 5. Prefill vs verification (Zynd  stricter than Multiplus default)

| Rule | Zynd behavior |
|------|----------------|
| Dialog accept | Writes **`zto_approved_profile` only**  **not** `kyc_journey_states` / KYC profile tables |
| Wizard inputs | **One-time prefill** from `zto_approved_profile` into PAN, bank, DOB, etc. |
| Step “verified” flags | **Unchanged**  lookup does **not** mark PAN/bank/address verified |
| User edits in review dialog | Stored in **`zto_approved_profile`** as `*_approved` + `*_edited`; wizard prefill uses **approved** values only |
| User edits prefilled value in KYC wizard | Journey/KYC stores **user-entered** data after verify/submit; **ZTO must not overwrite** later edits |
| Address | May show in review dialog; **verified address** still via **DigiLocker** (see [KYC_DIGILOCKER_FLOW.md](./KYC_DIGILOCKER_FLOW.md)) |
| KYC submit | Existing validators  partner bank verify, DigiLocker, etc.  remain mandatory |

**Multiplus difference (reference):** after review save, Multiplus applies prefill to **journey drafts** and **`promoteToKycProfileTables`** after **KYC email OTP** (`ZeroTouchPromotionService`, lifecycle `on_hold` → `promoted_to_kyc`). Zynd **does not** use email OTP as the promotion gate for lookup data into profile tables. Email verification may remain part of contact/KYC steps independently; treat Multiplus-style email promotion as **optional future phase**, not Zynd v1.

**Multiplus alignment to keep:** `ZeroTouchVerificationGuard` semantics  lookup prefill never satisfies PAN/bank verified checks or full KYC submit.

---

## 6. Zynd data model (documentation only  no migrations here)

Logical tables (names may map to SQLAlchemy models when implemented):

### 6.1 `zto_consent_records`

- One row per consent type per user/event: bank vs customer.
- Columns: user id, purpose, full `text`, `mode`, `ip_address`, `collected_at`, optional signup correlation id.

### 6.2 `zto_lookup_fetches` (or `zto_bank_lookup_fetches` + `zto_customer_lookup_fetches`)

- Encrypted Cybrilla responses + metadata: `fp_lookup_id`, status, `source_ref_id`, phone, name (customer), timestamps.
- Lifecycle: **pending review** (encrypted) until accept/decline; not a source of truth for KYC.

### 6.3 `zto_phone_registry`

- Enforces **one bank lookup per phone** and **one customer lookup per phone + normalized name**.
- Supports reuse/cloning after DB purge (ops runbook  mirror Multiplus registry docs).

### 6.4 `zto_approved_profile`

One row per successful review Accept (per user / per ZTO attempt  product TBD if re-lookup allowed after decline).

**Purpose:** **Decrypted, user-accepted** snapshot for **UI prefill only**  **not** written into `kyc_journey_states` or KYC profile tables on accept.

**Per-field dual storage** (Cybrilla audit + “what did the user change?”):

| Column pattern | Meaning |
|----------------|---------|
| `{field}_from_lookup` | Normalized value Cybrilla returned (null if that field was not in lookup response) |
| `{field}_approved` | Value on the form when user clicked Accept |
| `{field}_edited` | `true` if `approved` ≠ `from_lookup` (after normalization); else `false` |

**Suggested columns** (one row, flat table):

- `user_id`, `accepted_at`, `bank_lookup_id`, `customer_lookup_id`
- **Name:** `name_from_lookup`, `name_approved`, `name_edited`
- **PAN:** `pan_from_lookup`, `pan_approved`, `pan_edited`
- **DOB:** `dob_from_lookup`, `dob_approved`, `dob_edited`
- **Bank:** `bank_account_from_lookup`, `bank_account_approved`, `bank_account_edited`
- **IFSC:** `ifsc_from_lookup`, `ifsc_approved`, `ifsc_edited`
- **Address:** `address_from_lookup`, `address_approved`, `address_edited` (single formatted line or JSON for line/state/pincode if split later)

**Normalization before compare:** trim, uppercase PAN/IFSC, consistent date format  so trivial casing does not mark `edited`.

**Consumers:**

- KYC wizard prefill reads `*_approved` only.
- Support / Cybrilla audit may read `*_from_lookup` vs `*_approved` without decrypting raw fetch blobs again.

---

## 7. Cybrilla Lookup APIs

Base path on Cybrilla API host (Zynd: dedicated `ZTO_*` OAuth tenant  see [CYBRILLA_HTTP_ORCHESTRATOR.md](../Backend/docs/architecture/CYBRILLA_HTTP_ORCHESTRATOR.md)).

| Operation | HTTP | Path |
|-----------|------|------|
| Create bank lookup | POST | `/v2/bank_account_lookups` |
| Poll bank | GET | `/v2/bank_account_lookups/{id}` |
| Create customer lookup | POST | `/v2/customer_data_lookups` |
| Poll customer | GET | `/v2/customer_data_lookups/{id}` |

**Create payloads (conceptual):**

- `source_ref_id`  Zynd correlation uuid
- `phone_number`  verified mobile (server-side)
- Customer only: `name`  from “Tell us your name”
- `consent`: `{ collected_at, text, mode: "checkbox", ip_address }`  must match stored `zto_consent_records` for that lookup type

**Polling:** no partner webhooks; backend polls until `status` is terminal or attempts exhaust. Surface loading UX between name step and dashboard gate.

**Statuses:** handle in-progress vs `success` / failure per Cybrilla object; do not treat lookup success as KYC verification.

---

## 8. Obligations, limitations & go-live (Cybrilla)

### 8.1 Partner obligations

- Store lookup PII with **industry-standard strong encryption** (e.g. RSA, AES).
- Obtain **sponsor AMC approval**; if sponsorship is withdrawn, Cybrilla may disable Lookup API access.
- Fetch data **only** for investors initiating **MF transaction or MF KYC**  no other use.
- **Do not** resell lookup data.
- **Do not** store lookup data on **foreign servers**.
- **Do not** invoke lookups without **verified phone number**.
- **Do not** invoke lookups without **explicit one-time consent** per lookup type.
- Use **Cybrilla-approved consent text** without alteration (only `<partner>` → Zynd).
- **Bank:** at most **once per phone number**.
- **Customer:** at most **once per phone + name** combination.
- Allow investors to **review and edit** fetched data before proceeding.
- **No** robots/crawlers/automated bulk invocation.
- No guaranteed SLAs or data quality from Cybrilla.
- Cybrilla may **audit** implementation; full cooperation required.

### 8.2 Go-live checklist

**Commercial / legal (before production keys):**

- [ ] Get approval from a **sponsor AMC** with which Cybrilla has signed an agreement for facilitating this sponsorship.
- [ ] Sign a **Lookup offering agreement / addendum** with Cybrilla.

**Cybrilla implementation review & sign-off:**

- [ ] Lookup APIs are **not** called before collecting **explicit** investor consents.
- [ ] Explicit investor consents are obtained **separately** for **Bank Account Lookup** and **Customer Data Lookup**.
- [ ] **Cybrilla pre-approved text** is used as consent text (only `<partner>` → Zynd).
- [ ] **Checkboxes** are provided for investors to opt in; checkboxes are **not checked by default**.
- [ ] The app (or any digital asset) **verifies the investor’s phone number** before invoking lookup APIs.
- [ ] Data fetched is used **only** for **mutual fund transaction processing** in the **UI workflow** (MF KYC / invest path  not marketing, scoring, or unrelated features).
- [ ] Investors can **review and edit** fetched data  implemented in the **BrandDialog** review form (§4.2); edits persisted in **`zto_approved_profile`** with **`_from_lookup` / `_approved` / `_edited`** per field (§6.4).

**Zynd engineering evidence for audit (suggested):**

- [ ] Signup UI screenshot + API logs showing dual consent rows before any `POST /v2/*_lookups`.
- [ ] Sample `zto_consent_records` + Cybrilla create payload consent blocks match byte-for-byte (partner name aside).
- [ ] Review dialog recording: user edit → Accept → row shows `*_edited = true` and approved values differ from lookup.
- [ ] No journey/KYC profile writes on Accept without subsequent **Verify** flows.

---

## 9. Environment & backend sketch (Zynd)

| Variable | Purpose |
|----------|---------|
| `ZTO_ENABLED` | Master switch |
| `ZTO_MODE` | `sandbox` vs `production` |
| `ZTO_API_BASE_URL` | Cybrilla lookup host |
| `ZTO_TOKEN_*` | OAuth for lookup tenant |
| `ZTO_POLL_INTERVAL_MS`, `ZTO_MAX_POLL_ATTEMPTS` | Server polling |

Auth: HttpOnly session/JWT per [AUTH_SESSION_AND_CACHE.md](../Backend/docs/architecture/AUTH_SESSION_AND_CACHE.md). Compliance guard: lookups only when mobile OTP verified and phone matches session.

Suggested API surface (Zynd naming TBD): flow start after name step, flow status, review data, accept/decline, lookup audit (metadata only). Do not copy Multiplus Java controller paths verbatim.

---

## 10. Multiplus reference (what to read, not copy)

| Topic | Multiplus path |
|-------|----------------|
| Consent constants | `kyc/zerotouch/ZeroTouchConstants.java` |
| Flow orchestration | `kyc/zerotouch/flow/ZeroTouchFlowService.java` |
| Cybrilla clients | `kyc/zerotouch/client/CustomerLookupClient.java`, `BankLookupClient.java` |
| Review dialog (UX reference) | `webapp/.../zerotouch/ZeroTouchLookupReviewDialog.jsx` |
| Dashboard gate | `webapp/.../zerotouch/ZeroTouchDashboardReviewGate.jsx` |
| Verification guard | `kyc/zerotouch/ZeroTouchVerificationGuard.java` |
| Email promotion (not Zynd v1) | `ZeroTouchPromotionService`, `ZeroTouchKycPrefillService.promoteToKycProfileTables` |

**Do not copy verbatim:** Quarkus/Panache structure, `multiplusAccountNo`, Multiplus MUI components, encrypted column layout without Zynd KMS review, request-thread polling at scale without worker queue.

---

## 11. Recommended Zynd delivery phases

| Phase | Focus |
|-------|--------|
| A  Legal & contract | AMC sponsor, Cybrilla addendum, consent copy sign-off (`Zynd` partner string) |
| B  Backend slice | Consent records, registries, encrypted fetches, Cybrilla client + poll, accept → `zto_approved_profile` |
| C  Web | Signup checkboxes, post-name lookup trigger, `BrandDialog` review with `lookup.png`, non-dismissible accept/decline |
| D  KYC integration | Prefill helpers only; wire verification guard into existing submit paths |
| E  Pilot & audit | Sandbox mobiles (409 on duplicate phone), go-live checklist, ops audit endpoint |

---

## 12. Risks & open questions

| Item | Notes |
|------|--------|
| False “verified” steps | Central guard on KYC status + submit (Multiplus `ZeroTouchVerificationGuard` pattern). |
| Duplicate Cybrilla phones | QA numbers stick; registry + fresh mobiles. |
| User edits vs ZTO | Prefill is ephemeral UI seed; journey is source of truth after edit/verify. |
| Mitra add-investor | [ZYND_MITRA_INVESTOR_ONBOARDING.md](./ZYND_MITRA_INVESTOR_ONBOARDING.md)  product/legal before ZTO on behalf of investors. |
| Email OTP promotion | **Out of scope for Zynd v1** per §5; revisit only if product wants Multiplus parity. |

---

## 13. Related Zynd docs

- [KYC_DIGILOCKER_FLOW.md](./KYC_DIGILOCKER_FLOW.md)  verified identity/address after prefill
- [KYC_ZYND_TEACHING_J2_SINGLE_DIGILOCKER.md](./KYC_ZYND_TEACHING_J2_SINGLE_DIGILOCKER.md)
- [ZYND_MITRA_INVESTOR_ONBOARDING.md](./ZYND_MITRA_INVESTOR_ONBOARDING.md)
- [Backend/docs/architecture/CYBRILLA_HTTP_ORCHESTRATOR.md](../Backend/docs/architecture/CYBRILLA_HTTP_ORCHESTRATOR.md)
- [Backend/docs/architecture/MF_PAYMENTS_MASTER_LUMPSUM_SIP.md](../Backend/docs/architecture/MF_PAYMENTS_MASTER_LUMPSUM_SIP.md)  `ZTO_*` credential naming

---

*Planning document. Implementation should follow Zynd service boundaries and RBAC when adding routes.*
