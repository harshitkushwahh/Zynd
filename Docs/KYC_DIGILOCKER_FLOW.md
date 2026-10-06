# KYC DigiLocker, POA proof, and eSign (Zynd)

Zynd DIY KYC mirrors the Multiplus three-journey model: **Path A** (Finprim identity document at the **address** step for new-to-KYC only), **Path B** (Cybrilla POA `kyc_forms` — for on-hold and KRA update, **one** proof-details DigiLocker at the **address** step), and **Aadhaar eSign** after that proof completes.

**J2 (`fresh_kyc`)** uses **one** DigiLocker at address + Finprim eSign at Review — [KYC_ZYND_TEACHING_J2_SINGLE_DIGILOCKER.md](./KYC_ZYND_TEACHING_J2_SINGLE_DIGILOCKER.md). **J3** may use POA proof at Review; hybrid debugging: [KYC_DUAL_DIGILOCKER_HYBRID.md](./KYC_DUAL_DIGILOCKER_HYBRID.md).

## Journey modes (`kyc_flow_mode`)

| Mode | When | Path A (address-step DigiLocker) | Path B (Review POA proof) | eSign |
|------|------|----------------------------------|---------------------------|-------|
| `repeat_kra` | KRA short submit | No | No | No |
| `fresh_kyc` | New / unavailable KYC (J2) | Yes — identity document at **address** | **No** POA proof at Review | **Finprim** eSign |
| `kra_update` | On-hold / re-KYC / modify (J3) | **No** identity document | POA `proof_details.fetch_url` once, at the **address** step | POA eSign |

Bootstrap exposes `kycFlowMode`, `requiresAddressStepDigilocker` (alias `requiresPanStepDigilocker`), `requiresDigilocker` (Path A gate until `external_kyc_status === returned_success`), `poaKycFormId`, and `proofFetchUrl`.

## Path A — Finprim identity document

1. After PAN, the user reaches the **address** step (J2 and J3). The app calls `POST /api/v1/kyc/kyc-request/start` (investor) or `POST /api/v1/distributor/clients/{id}/kyc/kyc-request/start` (Mitra).
2. User completes DigiLocker at Finprim; partner **postback** hits `GET|POST /api/v1/kyc/public/digilocker-callback` (server-resolved URL from env, never from the browser).
3. API persists status and **302** redirects to `{KYC_DIGILOCKER_WEB_REDIRECT_ORIGIN}{KYC_DIGILOCKER_WEB_REDIRECT_PATH}` with `identity_document` and `status` query params (default Web path: `/dashboard/kyc`; Distributor local dev may point to `/dashboard/add-investor`).
4. **Hydrate** — `GET /api/v1/kyc/identity-document/{id}` maps Aadhaar into contact/personal drafts (pincode enrichment via pincode lookup). Address fields are prefilled; manual entry is not required when fetch succeeds.

### Env (see `Backend/.env.example`)

- `KYC_DIGILOCKER_CALLBACK_URL` / `DIGILOCKER_FP` — public API callback Finprim calls
- `KYC_DIGILOCKER_WEB_REDIRECT_ORIGIN`, `KYC_DIGILOCKER_WEB_REDIRECT_PATH`
- **`KYC_DIGILOCKER_SANDBOX`** — `true` uses **`https://s.finprim.com`** and **`DIGILOCKER_FP_*`** sandbox credentials (Multiplus parity). Does **not** reuse live `FP_CLIENT_*` on `api.fintechprimitives.com`. `false` uses production FinPrim + production DigiLocker.
- **`DIGILOCKER_FP_BASE_URL`**, **`DIGILOCKER_FP_TOKEN_BASE_URL`**, **`DIGILOCKER_FP_TENANT`**, **`DIGILOCKER_FP_CLIENT_ID`**, **`DIGILOCKER_FP_CLIENT_SECRET`**

## Path B — POA kyc_forms at Review

For **`kra_update` (J3)** with Path A complete, the Web runs the POA Review gate (`ensurePoaPartnerProofReadyForSubmit`), binds `kycf_*`, and may return **`proof_redirect`** when proof is incomplete. **`fresh_kyc` (J2)** skips POA forms at Review and submits via Finprim `kyc_request` + eSign (`submit_fresh_kyc_via_finprim`).

Review submit assumes POA lifecycle can run **before** final form submit:

| Route | Purpose |
|-------|---------|
| `GET /kyc/poa-form/config` | Feature flag `FP_POA_KYC_FORMS_FRESH_ENABLED` |
| `POST /kyc/poa-form/start` | Create POA form (`fresh` or `modify`) |
| `GET /kyc/poa-form/status` | `proofDetailsStatus`, `proofFetchUrl`, fields needed |
| `POST /kyc/poa-form/sync` | PATCH form from journey drafts |
| `POST /kyc/poa-form/retry-proof` | Modify journeys only |

Proof return: `GET|POST /api/v1/kyc/public/poa-proof-callback` (alias of `/public/proof-callback`) → 302 to Web with `poa_proof_return=1&kyc_form=&status=`.

Proof complete when `proof_details.status` is fetched/successful (not contact draft alone).

Env: `KYC_PROOF_CALLBACK_URL` (defaults to poa-proof-callback path on public API host).

## eSign

- Create/update kyc form includes `KYC_ESIGN_CALLBACK_URL`.
- Submit/continue may return `nextAction: esign_redirect` with provider URL; Web uses immediate `window.location.assign`.
- Callback: `/public/esign-callback` → Web `/dashboard/kyc?kyc_esign_return=1&…` (Cybrilla POA eSign URL only when POA credentials are configured)
- Env: `KYC_ESIGN_CALLBACK_URL`, optional `KYC_ESIGN_SANDBOX`

## Web UX entry

- Route `/dashboard/kyc` opens the KYC dialog; `dashboard-shell` resumes DigiLocker, POA proof, and eSign return query params.
- Review pipeline: `ensurePoaPartnerProofReadyForSubmit` → geolocation → `POST /kyc/form/submit` → Path B **proof_redirect** (if needed) or eSign redirect.

## Distributor add-investor

Same backend journey fields on client KYC bootstrap. Mitra flow starts Path A after PAN name confirm when `requires_pan_step_digilocker` is true; return URL should be configured for the Distributor app when testing redirects locally.

## Operational notes

- Finprim fetch must use the **same tenant** that created the identity document id.
- Callback URLs must be reachable on the **public API** host (`api_public_url`), not the Web dev server alone.
