# Zynd platform capability matrix

Capability inventory for **Zynd** (Web, Distributor, Admin, Backend).  
**Out of scope for this doc:** loans, insurance, fixed deposits (UI placeholders only).  
**Updated:** 22 Oct 2026

---

## Summary

| Status | Capabilities |
|--------|--------------|
| ✅ Implemented | 13 |
| 🟡 Partial | 37 |
| ⬜ Missing | 45 |
| — N/a | 1 |

**Core vendors already in use:** **Cybrilla** (MF OMS, KYC, DigiLocker, eSign, payments), **ZTO** (zero-touch lookups), **Twilio** (SMS OTP, when active), email infra, hosting/VPS.

---

## How to read the table

| Column | Meaning |
|--------|---------|
| **Status** | What exists in Zynd today |
| **To complete / dependencies** | In-house work plus **third-party vendors** or ops/legal needed to reach full capability |
| **Notes** | Current implementation snapshot |

---

## Platform foundation

Detailed fix/plan (in-house vs third party, Cybrilla excluded): **[ZYND_PLATFORM_FOUNDATION_PLAN.md](./ZYND_PLATFORM_FOUNDATION_PLAN.md)**

| Capability | Status | To complete / dependencies | Notes |
|------------|--------|----------------------------|-------|
| Architecture and data model freeze | 🟡 partial | In-house (architecture/docs); optional **none** for v1 | Modular FastAPI backend, Web/Distributor/Admin; architecture docs in repo. |
| Event spine and taxonomy | 🟡 partial | In-house catalog + pipeline; optional **Kafka/SNS** or existing DB outbox | ADR-001 event publishing; no unified product event catalogue. |
| Consent service (compliant with DPDP) | 🟡 partial | In-house service; **AA consent** needs Account Aggregator vendor when AA ships | Consent keys, accept/revoke, ZTO consent records. |
| Audit log and rules registry | 🟡 partial | In-house append-only store + rules repo; no vendor required | Admin audit_logs, provider logs, MF pipeline audit. |
| Cloud, India residency and DR & LLM route | 🟡 partial | **Cloud vendor** (AWS/GCP/Azure India region), DR design; **LLM vendor** (OpenAI/Azure/Gemini) if agents expand | Deploy on VPS/cloud today. |
| Offline-first app foundation | ⬜ missing | In-house **React Native** app; **MDM vendor** (Scalefusion, Intune) for field devices | Investor/Distributor are web; no RN offline store. |
| App size optimisation | — n/a | N/A unless native apps ship | Web channel; native size targets not applicable. |
| Availability step and redundancy | 🟡 partial | **Cloud/hosting** HA, load balancer, DB replicas; **Cybrilla** SLA for MF rail | Health checks, background workers. |
| Environments, feature flags, release discipline | 🟡 partial | In-house CI/CD; optional **LaunchDarkly/Flagsmith** or env-based flags | Dev/staging/prod; limited feature flags. |
| Shared component library and design system | ✅ implemented | **None** — in-house | shadcn, shared copy, cross-app UI patterns. |

## Decision engines & personalization

| Capability | Status | To complete / dependencies | Notes |
|------------|--------|----------------------------|-------|
| Money Score | ⬜ missing | In-house scoring model; inputs from **MF (Cybrilla)**, optional **AA**, bank data | No composite money-health score. |
| WhatsApp Money Snapshot | ⬜ missing | **WhatsApp BSP** (Gupshup/Karix/etc.) + in-house templating; **Cybrilla** holdings API | No WA portfolio snapshot. |
| Next Right Step engine | ⬜ missing | In-house rules/ML; may use **LLM vendor** for copy; event spine in-house | No next-best-action engine. |
| Risk profiler rebuild | ✅ implemented | **None** for core; questionnaire in-house | Assessment, results, distributor/admin views. |
| MF recommendation and fitment engine | 🟡 partial | In-house engine; data from **Cybrilla** catalog/NAV; AMFI/SID where needed | Funds For You docs and invest flows. |
| Goal baskets and back-test engine | 🟡 partial | In-house; historical NAV from **Cybrilla**/internal cache | Family goals + invest; no back-test. |
| Goal definitions and journey | ✅ implemented | **None** — in-house | Family goals, targets, progress. |
| Owned calculators | 🟡 partial | In-house formulas; optional AMFI/Cybrilla min amounts | SIP/MF calculators in product. |
| Wellness Score (face scan) | ⬜ missing | **Third-party wellness API** (vendor TBD) + in-house UX; DPDP health consent | No wellness product. |
| Propensity scoring | ⬜ missing | In-house ML/analytics; needs **event spine** + optional **DWH** | No propensity models. |

## Mutual funds

| Capability | Status | To complete / dependencies | Notes |
|------------|--------|----------------------------|-------|
| Mutual funds platform (P1 scope) | ✅ implemented | **Cybrilla** (OMS, payments, KYC tenant); in-house apps | Catalog, cart, lumpsum/SIP, mandates, portfolio, txn types. |
| Statements and consolidated holdings | ✅ implemented | **Cybrilla** + optional **MF Central** for external CAS | Holdings, CAS path, tax/report views. |
| Insta-redemption / liquid parking hook | ⬜ missing | **Cybrilla**/AMC liquid schemes; in-house UX; confirm insta-redemption eligibility with rail | No insta-redemption hook. |
| External holdings (MF Central CAS) | 🟡 partial | **MF Central** API credentials + in-house import/UI | Backend CAS worker; UX/creds incomplete. |
| NFO listing | ✅ implemented | **Cybrilla** + AMFI calendar; in-house NFO lifecycle | Scheduler, admin, invest category. |
| Cart / buy-all basket | ✅ implemented | **Cybrilla** orders; in-house cart | Cart and multi-fund checkout. |
| Lumpsum into same folio | ✅ implemented | **Cybrilla** OMS; in-house checkout | Purchases into existing folios. |
| Suitability gate and mismatch handling | 🟡 partial | In-house rules; **Cybrilla** may enforce some invest gates | Risk profile exists; weak mismatch gates. |
| Nudge, review and rebalance | ⬜ missing | In-house alerts; **Cybrilla** for switch/rebalance orders; optional **LLM** for copy | No rebalance engine. |
| A la carte fund selection | ✅ implemented | **Cybrilla** catalog sync; in-house UI | Browse, search, compare, detail. |
| Tax-season products | 🟡 partial | In-house packaging; **NPS/other rails** = new vendor or partner if offered | Tax views; no NPS/tax-season pack. |
| Digital gold | ⬜ missing | **Gold partner** (e.g. Augmont/MMTC-PAMP stack) + RBI/compliance review | Disabled nav only. |

## Enterprise & employer (IAP)

| Capability | Status | To complete / dependencies | Notes |
|------------|--------|----------------------------|-------|
| IAP digitisation | ⬜ missing | In-house product + **legal/compliance**; may need **Cybrilla** corporate accounts | No employer IAP module. |
| IAP separation controls | ⬜ missing | In-house controls + **legal/audit**; no single vendor | No IAP separation in product. |
| Employer proposal page and account setup | ⬜ missing | In-house B2B portal; optional **CRM** | No employer portal. |
| Payroll deduction | ⬜ missing | **HRMS/payroll vendor** APIs + in-house orchestration | No payroll rail. |
| Payroll and HRMS connectors | ⬜ missing | **Darwinbox/Keka/Zoho People** etc. per employer | No HRMS integrations. |
| Workforce index and HR dashboard | ⬜ missing | In-house dashboard; data from HRMS connectors | No employer HR dashboard. |
| Corporate SIP engine | ⬜ missing | In-house + **Cybrilla** corporate SIP if supported; employer billing | Retail SIP only. |
| Quarterly business review pack | ⬜ missing | In-house reporting; export/PDF | No QBR automation. |

## Branch, field & PM tools

| Capability | Status | To complete / dependencies | Notes |
|------------|--------|----------------------------|-------|
| Offline PM app | ⬜ missing | In-house RN/web offline layer; **MDM** for devices | Distributor is web only. |
| PM worklist and T+7 queue | 🟡 partial | In-house ops queues; **Cybrilla** order states | Txn requests; no T+7 queue. |
| Client 360 with copilot brief | 🟡 partial | In-house UI; **LLM vendor** for briefs; data from Cybrilla/KYC | Client detail in Distributor; no copilot. |
| Assisted cart | 🟡 partial | In-house; **Cybrilla** checkout | Quick transaction wizard. |
| Field activity tracking | ⬜ missing | In-house app; device GPS; optional **maps** SDK | No visit/geo tracking. |
| Branch scorecard and Monday pack | 🟡 partial | In-house reports; data warehouse optional | Branch charts/reports. |
| Reports module | 🟡 partial | In-house; **Cybrilla**/CAS for holdings | Investor + distributor reports. |
| Telecaller console | ⬜ missing | In-house console + **telephony vendor** (Exotel/Ozonetel) | No telecaller UI. |
| Training platform on Confluence | ⬜ missing | **Atlassian Confluence** (external LMS); not Zynd build | Not in product. |
| Fast assisted KYC (distributor) | 🟡 partial | **Cybrilla** KYC/DigiLocker/eSign + **ZTO**; in-house UX | ZTO + DigiLocker + eSign flows. |

## Partners & distribution (Mitra)

| Capability | Status | To complete / dependencies | Notes |
|------------|--------|----------------------------|-------|
| Mitra platform and payout engine | 🟡 partial | In-house; payout execution may need **bank file/NEFT** ops or payment vendor | Distributor portal, commissions UI. |
| Plus Points ledger and milestone engine | ⬜ missing | In-house ledger; no vendor | Referrals only; no points ledger. |
| MF SDK - embeddable journey | ⬜ missing | In-house SDK/WebView; **Cybrilla** behind API; partner **API keys** | No embeddable SDK. |
| Referral node partner app | 🟡 partial | In-house; optional separate white-label app | Referral QR/codes. |
| Partner portal and dealer wallet | 🟡 partial | In-house portal; **wallet/settlement vendor** if prepaid float required | Distributor portal; no wallet. |

## AI agents & automation

| Capability | Status | To complete / dependencies | Notes |
|------------|--------|----------------------------|-------|
| Agent gateway, registry and model gateway | ⬜ missing | In-house gateway; **LLM vendors** (OpenAI/Azure/etc.); optional **Langfuse** for observability | No agent gateway. |
| Agent evaluations and quality console | ⬜ missing | In-house + **LLM vendor**; optional eval tools | No eval console. |
| Agents wave 1 | 🟡 partial | **LLM vendor**; in-house routing (see HELP_BOT docs) | Help bot + support AI routing. |
| Agents wave 2 | ⬜ missing | In-house + **LLM vendor** per use case | Not started. |
| Agents wave 3 | ⬜ missing | In-house + **LLM vendor** | Not started. |

## Data, analytics & insights

| Capability | Status | To complete / dependencies | Notes |
|------------|--------|----------------------------|-------|
| Data warehouse and marts | ⬜ missing | **DWH vendor** (BigQuery/Snowflake/Redshift) + ETL in-house | Ops DB only. |
| Identity and household resolution | 🟡 partial | In-house graph; optional **AA** for external identity signals | Users, family groups. |
| Signal derivation layer | ⬜ missing | In-house stream processing; **DWH** or Kafka optional | No signal layer. |
| Management MIS and operating scorecard | 🟡 partial | In-house BI; optional **Metabase/Looker** | Admin dashboards. |
| PMF measurement suite | ⬜ missing | **Product analytics** (Mixpanel/Amplitude/PostHog) + in-house | No PMF suite. |
| CAC, ARPU and attribution | ⬜ missing | **Marketing analytics** (GA4, AppsFlyer) + in-house | No in-product attribution. |
| Household graph | 🟡 partial | In-house; **AA** for external accounts optional | Family groups. |
| Insight sources programme | ⬜ missing | Mix of vendors per source (**AA**, MF Central, SMS parser) | Not started. |
| On-device SMS parser | ⬜ missing | In-house mobile module; **on-device only** (privacy); no cloud vendor | Not started. |
| Segmentation into the worklist | ⬜ missing | In-house rules; needs event/CDP data | Not started. |
| Partner and employer insight products | ⬜ missing | In-house packaging; employer/AA data vendors | Not started. |
| Data governance | 🟡 partial | In-house policies; optional **collibra**-class GRC vendor | RBAC, docs. |
| Data quality and reconciliation | 🟡 partial | In-house jobs; **Cybrilla** as source of truth for orders | MF order truth audit job. |
| Insight-to-action mapping | ⬜ missing | In-house; ties to engagement + Next Right Step | Not started. |
| Investor analytics and data room | ⬜ missing | In-house secure room; storage **S3-compatible** | Not started. |

## Integrations & external rails

| Capability | Status | To complete / dependencies | Notes |
|------------|--------|----------------------------|-------|
| KYC orchestration | ✅ implemented | **Cybrilla** (DigiLocker, eSign, KYC requests) + **ZTO** API | Full KYC journey + ZTO + assisted. |
| MF & payments rail (Cybrilla) | ✅ implemented | **Cybrilla** (contract, sandbox/prod keys) — critical vendor | Primary MF/KYC/payments integration. |
| Account Aggregator | ⬜ missing | **AA vendor/FIU** (Setu, Finvu, OneMoney, etc.) + RBI AA framework | No AA in codebase. |
| Payments - PG, UPI Autopay, NACH | ✅ implemented | **Cybrilla**/ONDC payment rails; bank/NACH via provider | Lumpsum/SIP, mandates. |
| SMS (DLT) and WhatsApp messaging | 🟡 partial | **Twilio** or Indian **DLT SMS** (MSG91, Gupshup); **WhatsApp BSP** for WA | SMS OTP; email. |
| CRM | 🟡 partial | In-house or **HubSpot/Zoho** if external CRM desired | Support tickets, client records. |
| CDP / orchestration layer | ⬜ missing | **MoEngage/Clevertap/Segment** or in-house event hub | No CDP. |
| Telephony and voice | 🟡 partial | **Exotel/Ozonetel/Twilio Voice** for calls/IVR | Support realtime chat. |
| Analytics and marketing measurement | 🟡 partial | **GA4/PostHog** + in-house event tagging | Marketing site. |
| Partner rail health and fallbacks | 🟡 partial | In-house monitoring; **Cybrilla** status; optional **PagerDuty** | Cybrilla error handling. |
| Vendor management module | ⬜ missing | In-house registry; ops process | Not in product. |
| Enterprise systems | ⬜ missing | Per integration (**SAP/Oracle/HRMS**) — vendor-specific | Not in product. |

## Client channels & engagement

| Capability | Status | To complete / dependencies | Notes |
|------------|--------|----------------------------|-------|
| UI/UX declutter | 🟡 partial | In-house design/engineering | Ongoing Web UX. |
| Now and Story surfaces | ⬜ missing | In-house CMS/content; optional **CDN** for media | No Stories feed. |
| Self-serve onboarding wrapper | ✅ implemented | **Cybrilla** + **ZTO** + in-house Web | Auth, ZTO, KYC bootstrap. |
| Engagement engine | 🟡 partial | **FCM/APNs** (push); **email** (SendGrid/SES); optional **CDP** | Push/email mostly transactional. |
| Monthly money letter | ⬜ missing | In-house templates; **email vendor**; data Cybrilla/portfolio | No scheduled letter. |
| Voice, missed-call and IVR | ⬜ missing | **Telephony vendor** (Exotel/Ozonetel) + in-house call flows | No IVR. |
| Video consult with co-browse | ⬜ missing | **Agora/Daily.co/Zoom SDK** + in-house scheduling | No video co-browse. |
| WhatsApp chatbot and chat support | 🟡 partial | **LLM vendor** for bot; **WhatsApp BSP** for WA channel | In-app help bot + support. |

## Security & compliance

| Capability | Status | To complete / dependencies | Notes |
|------------|--------|----------------------------|-------|
| Conduct rules in the product | 🟡 partial | In-house rules engine + **legal/compliance** sign-off | Compliance copy, consent gates. |

---

## Third-party & vendor index (by domain)

| Domain | Typical vendors / partners | Zynd today |
|--------|---------------------------|------------|
| MF invest & orders | Cybrilla (OMS, mandates, redemptions) | ✅ Integrated |
| KYC / identity | Cybrilla KYC tenant, DigiLocker, eSign | ✅ Integrated |
| Zero-touch onboarding | ZTO (Cybrilla POA) | ✅ Integrated |
| External MF holdings | MF Central | 🟡 Backend worker; prod credentials/UX |
| Payments | Cybrilla / ONDC payment flows, banks, NACH | ✅ Integrated |
| SMS OTP | Twilio, MSG91, Gupshup (DLT registered) | 🟡 Twilio (ops-dependent) |
| WhatsApp | Meta BSP (Gupshup, Karix, Interakt, …) | ⬜ Not integrated |
| Account Aggregator | Setu, Finvu, OneMoney, CAMSFinServ AA, … | ⬜ Not integrated |
| Push notifications | FCM, APNs | 🟡 If enabled in mobile/web push path |
| Email | SendGrid, AWS SES, Resend, … | 🟡 Infrastructure |
| Help / support AI | OpenAI / Azure OpenAI / similar LLM | 🟡 Help bot routing |
| Telephony / IVR | Exotel, Ozonetel, Twilio Voice | ⬜ Not integrated |
| Video / co-browse | Agora, Daily.co, Zoom SDK | ⬜ Not integrated |
| Product analytics | PostHog, Mixpanel, Amplitude, GA4 | 🟡 Partial / marketing |
| CDP / engagement | MoEngage, Clevertap, Segment | ⬜ Not integrated |
| Data warehouse | BigQuery, Snowflake, Redshift | ⬜ Not in repo |
| HRMS / payroll | Darwinbox, Keka, Zoho People | ⬜ Enterprise only |
| Digital gold | Augmont, MMTC-PAMP partners | ⬜ Not integrated |
| Field MDM | Scalefusion, Microsoft Intune | ⬜ Offline PM app not built |
| Cloud / DR | AWS, GCP, Azure (India regions) | 🟡 Ops choice |

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ implemented | Live in Zynd with meaningful surface |
| 🟡 partial | Started; vendor or in-house gaps remain |
| ⬜ missing | Not built (or placeholder only) |
| — n/a | Not applicable to current Zynd channel |
