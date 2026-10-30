# MF Central CAS — external funds on the dashboard

**Status:** Implemented. `ZYND_MF_CAS_ENABLED` stays false until `ZYND_MF_CENTRAL_AES_IV` is set.  
**Last updated:** 2026-10-22

**Vendor sources (local, not in git):**

- `~/Downloads/cas integration/CAS/MFC-CAS Integration Document.pdf`
- `~/Downloads/cas integration/CAS/REVISED MFC CAS COLLECTION.postman_collection.json`
- `~/Downloads/cas integration/CAS/Front-end Implementation Reference/` (iframe, popup, QR download)
- `~/Downloads/multiplus-uat.json` (UAT client credentials)

**Related Zynd docs:**

- [MF_SCHEDULER_PHASES.md](./MF_SCHEDULER_PHASES.md) — Phase 6 still describes the stub CAS worker

---

## Goal

An investor who already holds mutual funds outside Zynd can consent on MF Central, and those folios show up on the portfolio dashboard next to funds bought on Zynd.

MF Central does not give us a pull API. The investor proves the PAN and mobile with an OTP on MF Central’s page, downloads a QR image, and we exchange that image for the statement. Summary data is enough for the dashboard: scheme, folio, ISIN, units, NAV, market value, cost.

---

## What already exists

| Piece | Where | What it does today |
| --- | --- | --- |
| Stub client | `Backend/app/infrastructure/mf/mf_central_client.py` | `POST {base}/cas/request` and `GET {base}/cas/{id}` with an optional static bearer key. Those paths are not MF Central. |
| Import row | `mf_cas_imports` | PAN from KYC, mobile from the user, status pending → worker. |
| Holdings table | `mf_external_holdings` | Unique on `(user_id, isin, folio_number)`. |
| Worker | `run_mf_transaction_workers.py --cas` | Polls the stub URL and writes rows. |
| Portfolio merge | `portfolio_holdings_service._merge_external_holdings` | Adds rows with `source: "external"` into `GET /invest/portfolio/summary` and the holdings list. Skips a row when folio or ISIN is missing. Skips a row that is already a Zynd folio+ISIN. |
| Dashboard read | `Web` portfolio page and overview | Already render that summary. They do not label external rows. |
| Import button | `mf-dashboard-sidebar-data.ts` (`cas-import`), `mf-holdings-section.tsx` | Rendered and disabled. Copy says import is not enabled. |

`ZYND_MF_CAS_ENABLED` is false, so `POST /invest/cas/imports` returns 503.

---

## Vendor flow

UAT API host: `https://uatservices.mfcentral.com`  
UAT consent host: `https://mfc-cas-uat.mfcentral.com`

1. **OAuth.** `POST /oauth/token` as `application/x-www-form-urlencoded`. Basic auth is `client_id:client_secret`. Body is `username`, `password`, `grant_type=password`. Cache `access_token`. `expires_in` on the sample is 2,591,999 seconds (about 30 days). Refresh before expiry. Do not store the token in env.
2. **New CAS request.** Build the JSON below. Encrypt it. Sign the ciphertext. `POST /api/client/V1/newCasRequest` with headers `Authorization: Bearer <token>`, `ClientId`, and `Origin`.
3. **Decrypt the response.** Verify the response signature, decrypt, and keep `reqId`, `otpRef`, and `clientRefNo`.
4. **Open MF Central.** Encrypt a second payload with the URL key (different cipher, below) and open `{redirect_base}/api/auth/start?data=<urlencoded>`. The investor enters the OTP, picks Summary or Detailed, and downloads a QR PNG. We do not call MF Central during that step.
5. **Read the QR.** Prefer the `mfc-cas-download` postMessage (base64 PNG). If the browser saves the file instead, the investor uploads it.
6. **Validate.** `POST /api/client/V1/validateQRCode` with the same encrypt/sign/decrypt as step 2. Body fields are `reqId`, `clientRefNo`, and `qrCode` (base64, no data-URL prefix).
7. **Persist schemes** and the portfolio APIs already merge them.

`newCasRequest` JSON:

| Field | Rule |
| --- | --- |
| `clientRefNo` | Our `mf_cas_imports.id`. Must be unique per request. |
| `reqId` | `""` on create. |
| `pan` | 10-character PAN from KYC `pan_draft_json.panNumber`. |
| `pekrn` | `""`. |
| `email` / `mobile` | Exactly one. Send `mobile` as `+91…` from `user.phone`. Leave `email` as `""`. MF Central rejects both. |
| `fromDate` / `toDate` | `""` for a summary statement (dashboard). The PDF marks them required; the Postman collection says leave them blank unless the investor wants transactions. Summary is the dashboard path. |
| `redirectUrl` | `{FRONTEND_URL}{ZYND_MF_CAS_CALLBACK_PATH}`. Required even when we complete via postMessage. |

Decrypted create response: `reqId`, `otpRef`, `userSubjectReference`, `clientRefNo`.

---

## Zynd request path

Replace the stub in `mf_central_client.py`. Do not keep calling `/cas/request`.

1. `POST /invest/cas/imports` (already gated on `ZYND_MF_CAS_ENABLED` and invest-eligible user).
2. Require PAN and mobile. Same errors as today (`pan_missing`, `mobile_missing`).
3. Insert `mf_cas_imports` as `PENDING` first, and use that id as `clientRefNo`.
4. Call `newCasRequest`. Store `reqId` on `external_request_id`. Store `otpRef` and `clientRefNo` in `metadata`, not in the API response to the browser.
5. Return `import_id`, `launch_url`, and `req_id`. `launch_url` is the consent URL from step 4.
6. Web opens that URL in a popup (`window.open`, about 500×700). Iframe is the fallback if the popup is blocked. Listen for `message` on the page.
7. Accept a message only when `event.origin` is in `ZYND_MF_CENTRAL_POST_MESSAGE_ORIGINS`.
   - `mfc-cas-download` → PNG base64. Send it to our validate endpoint. Do not ask the investor to upload again.
   - `mfc-cas-complete` with `status: success` → `reqId` and `type` (`summary` or `transactions`). If the download message already arrived, validate. If it did not, show a file input for the PNG.
   - `status: error` → show `message`, store `code` and `traceId` on the import row, mark `FAILED`.
8. `POST /invest/cas/imports/{import_id}/qr` with `{ "qr_code": "<base64>" }`. The server checks the row belongs to the current user and is still `PENDING` or `PROCESSING`.
9. `validateQRCode`, parse, replace that user’s external rows, mark `SUCCEEDED`, set `holdings_count` and `completed_at`.
10. Web refetches `GET /invest/portfolio/summary`, the holdings list, and `GET /invest/holdings/external`.

The CAS worker stops polling MF Central. There is no status URL to poll. The worker may mark `PENDING` rows older than a few hours as `FAILED` (`consent_expired`) so a half-finished import does not sit forever. `ZYND_MF_CAS_WORKER_TICK_SECONDS` and `ZYND_MF_CAS_WORKER_BATCH_SIZE` stay for that sweep only.

Callback page `{FRONTEND_URL}/dashboard/mutual-funds/cas/callback` only matters for the standalone redirect. Read `status`, `reqId`, and `type` from the query string and route the investor back to the mutual fund dashboard. Popup and iframe use postMessage and close themselves.

Set the dashboard page referrer policy to `origin`. MF Central uses `document.referrer` as the postMessage target. `no-referrer` drops the message unless `redirectUrl` is the same origin, which it is if `FRONTEND_URL` is the app origin.

UAT OTP, for testers only: `00` plus the last four characters of the PAN. Example PAN `ABCDE1234F` → OTP `001234`. MF Central’s own fixtures (mobile `9239874560`, email `test@kfintech.com`, and the PAN list in the PDF) are their data, not ours. A Zynd user still consents with the PAN and mobile on their Zynd profile, and MF Central UAT must know that pair.

---

## Parsing the statement

Summary shape (`data[].schemes[]`): `isin`, `schemeName`, `folio`, `closingBalance` or `availableUnits`, `nav`, `navDate` (`DD-MMM-YYYY`), `currentMktValue`, `costValue`, `gainLoss`, `amcName`, `isDemat`.

Detailed shape (`data[].dtSummary[]`): `isin`, `schemeName`, `folio`, `closingBalance`, `nav`, `lastNavDate`, `marketValue`, `costValue`, `amcName`.

Map into `mf_external_holdings`:

| Column | Source |
| --- | --- |
| `isin` | uppercased. Skip the scheme when missing. |
| `scheme_name` | `schemeName` |
| `folio_number` | `folio`. Skip when missing. The portfolio merge drops folio-less rows. |
| `units` | `closingBalance`, else `availableUnits` |
| `nav_value` | `nav` |
| `market_value_inr` | `currentMktValue`, else `marketValue` |
| `as_of_date` | `navDate` or `lastNavDate`, parsed from `DD-MMM-YYYY` |
| `amc_name` | `amcName` |
| `source` | `MF_CENTRAL` |
| `matched_fund_id` | `mutual_funds.isin_growth` lookup, same as today |
| `cost_value_inr` | `costValue`. New column. See portfolio math below. |

On success, delete all `MF_CENTRAL` rows for that user, then insert the new set. Today’s delete is only `cas_import_id = this import`, so a second import would leave the previous folios in place and the unique key would collide.

Do not store the QR, the `bank` object, account numbers, or the raw statement in `metadata` or logs. The summary payload includes bank account, IFSC, investor email, and mobile. Keep `reqId`, `clientRefNo`, scheme count, and `type` only.

Demat rows (`isDemat = Y`) are still holdings. Store them. The UI can show a Demat tag later. Do not drop them in v1 unless product asks.

---

## Dashboard

Once rows exist, `GET /invest/portfolio/summary` and the holdings endpoint already include them in `current_value_inr`, allocation, and the holdings list. Two fixes are required before turning the button on:

1. **Return math.** `current_value_inr` includes external market value. `invested_inr` ignores external rows (`source != "external"`). A successful import would inflate total return. Add `cost_value_inr` and add that cost into `invested_inr`. Gain is market value minus cost. Day change can stay on our NAV history via the existing ISIN lookup.
2. **Label.** The portfolio table does not read `source`. Show an “Outside Zynd” badge when `source == "external"`. Zynd folios stay unmarked. The same badge belongs on the overview holdings card if that card lists line items.

Enable the sidebar tool `cas-import` and the holdings-section button when `cas_enabled` is true on the invest home payload (`invest_home_service` already returns that flag). Point the tool at the mutual fund dashboard and start the popup from there. Remove the disabled state and the “not enabled” message in that case.

External rows stay non-redeemable on Zynd. The merge currently copies units into `redeemable_units`. Set redeemable units and redeemable amount to 0 for `source: "external"` so redeem and switch actions do not target a folio we do not service.

---

## Crypto

Two ciphers. Both are AES-256-CBC and PKCS7. Do not call `/api/test/encrypt`, `/api/test/generateSignature`, or `/api/test/decrypt`. Those exist so the Postman collection can avoid local crypto.

**API bodies** (`newCasRequest`, `validateQRCode`):

- Key = first 32 bytes of SHA-256(shared encryption key).
- IV = the constant MF Central issued for this client. It is **not** in `multiplus-uat.json` and **not** in the CAS PDF (the PDF says “IV provided by MFC” and points at section 3.3 of the main API guide). Leave `ZYND_MF_CENTRAL_AES_IV` empty until that value is confirmed. Do not guess it.
- Output is base64. The Postman sample ciphertext is base64url (`-` and `_`). The PDF sample is standard base64 of the hex ciphertext. First UAT call should compare our ciphertext to one `POST /api/test/encrypt` response for the same JSON, then lock the dialect. Production code still encrypts locally.

**Signatures:**

- The live request body in the collection is a detached JWS: `base64url(header)..base64url(signature)` with an empty payload slot.
- The sample header decodes to `alg=RS256`, a `kid`, and `b64: false` (RFC 7797, raw payload).
- Sign the encrypted request string with the Multiplus private JWK. `kid` on that key is `3f2789fe-0c99-4d67-84dd-507eb189fdff`. The kid inside the Postman sample (`86951e6e-…`) is another client. Do not copy it.
- The PDF’s `jwt.sign({ data: encryptedText })` example produces a normal JWT, which does not match the collection. Follow the collection’s detached form, and confirm with one UAT round-trip.
- Verify the response JWS with the public JWK before decrypting.

**Consent URL** (step 4 only):

- Key = the 32-byte URL key used as raw bytes. Do not hash it.
- IV = random 16 bytes per launch.
- Payload: `reqId`, `otpRef`, `token` (empty string), `pan`, `email`, `mobile`, `clientRefNo`, `redirectUrl`. `reqId` goes out as a string.
- Wire format: `hex(iv) + ":" + hex(ciphertext)`, then `encodeURIComponent`.
- URL: `{ZYND_MF_CENTRAL_REDIRECT_BASE_URL}/api/auth/start?data={encoded}`.

Request header `Origin` for UAT: `https://uatapp.mfcentral.com`. The collection spells the create-request header `Otigin` and sends `https://app.mfcentral.com` on validate. We send the correct header name `Origin` and one configurable value for both calls.

---

## Env

Non-secret values below are the ones to set for UAT. Secret values are copied from `~/Downloads/multiplus-uat.json` into `Backend/.env` only. `.env` is gitignored. This doc and `.env.example` do not contain them.

`ZYND_MF_CAS_ENABLED` stays `false` until `ZYND_MF_CENTRAL_AES_IV` is filled and one UAT create + validate round-trip succeeds. Turning it on with an empty IV makes every import fail.

```bash
# UAT hosts and app callback. Safe to commit in .env.example.
ZYND_MF_CAS_ENABLED=false
ZYND_MF_CENTRAL_BASE_URL=https://uatservices.mfcentral.com
ZYND_MF_CENTRAL_REDIRECT_BASE_URL=https://mfc-cas-uat.mfcentral.com
ZYND_MF_CENTRAL_ORIGIN=https://uatapp.mfcentral.com
ZYND_MF_CENTRAL_POST_MESSAGE_ORIGINS=https://mfc-cas-uat.mfcentral.com
ZYND_MF_CAS_CALLBACK_PATH=/dashboard/mutual-funds/cas/callback

# Identity. Client id value in the UAT file is the string multiplus.
ZYND_MF_CENTRAL_CLIENT_ID=multiplus
ZYND_MF_CENTRAL_CLIENT_SECRET=        # JSON ClientSecret
ZYND_MF_CENTRAL_USERNAME=             # JSON UserName
ZYND_MF_CENTRAL_PASSWORD=             # JSON Password

# API cipher. JSON EncryptionDecryptionKey.
ZYND_MF_CENTRAL_ENCRYPTION_KEY=
# Not in the UAT file or the CAS PDF. Blocked until MFC sends it.
ZYND_MF_CENTRAL_AES_IV=

# JWK files, gitignored, next to .env or outside the repo.
# PrivateKey is a JWK set: {"keys":[{kty,kid,n,e,d,p,q,...}]}.
# PublicKey is one JWK: {kty,kid,n,e,use}.
ZYND_MF_CENTRAL_PRIVATE_KEY_FILE=
ZYND_MF_CENTRAL_PUBLIC_KEY_FILE=

# 32-byte URL key from PDF page 1 and the Postman "BUILD URL" key header.
# Copy that header value into .env. Do not hash it.
ZYND_MF_CENTRAL_URL_ENCRYPTION_KEY=

# Retired. Leave empty. OAuth replaces the static bearer key.
ZYND_MF_CENTRAL_API_KEY=

ZYND_MF_CAS_WORKER_TICK_SECONDS=60
ZYND_MF_CAS_WORKER_BATCH_SIZE=10
```

`FRONTEND_URL` is already the web origin (`http://localhost:7777` in dev). `redirectUrl` is `FRONTEND_URL + ZYND_MF_CAS_CALLBACK_PATH`.

Production later swaps the three hosts (`uatservices`, `mfc-cas-uat`, `uatapp`) for the production hosts MF Central issues, and replaces the UAT secret file. The iframe guide’s `https://cas-oauth.mfcentral.com` and the compatibility note’s `https://cas.mfcentral.com` are not the UAT consent host. UAT postMessage origin is `https://mfc-cas-uat.mfcentral.com`. Add another origin to `ZYND_MF_CENTRAL_POST_MESSAGE_ORIGINS` only after a captured message shows it.

`config.py` today has `zynd_mf_central_base_url` and `zynd_mf_central_api_key` only. Add the names above next to those fields. Keep the worker tick settings.

---

## Implementation order

1. Settings and a local crypto module with unit tests: key derivation, URL-key encrypt (known IV), detached JWS sign/verify with a throwaway RSA key. No network.
2. Parser tests for one summary payload and one detailed payload from the PDF, including `DD-MMM-YYYY` and a missing ISIN.
3. `mf_central_client`: token cache, `newCasRequest`, launch URL, `validateQRCode`.
4. Migration: `cost_value_inr` on `mf_external_holdings`.
5. Service: create import, validate QR, replace the user’s external rows, strip bank data.
6. Portfolio: add external cost into invested, zero redeemable units on external rows.
7. Web: popup, origin check, download message, upload fallback, enable the sidebar tool and holdings button, “Outside Zynd” badge.
8. One manual UAT pass with a PAN MF Central recognises. Confirm ciphertext dialect and JWS shape on that pass before setting `ZYND_MF_CAS_ENABLED=true` for the team.

---

## Out of scope for this pass

- Detailed transaction history (`dtTransaction`) and a transactions screen.
- Android `DownloadListener` and iOS `WKScriptMessageHandler`. The web app is the dashboard. Mobile webviews can be added when those apps embed this flow.
- Letting the investor redeem or start a SIP on an external folio.
- Using `/api/test/*` from application code.
