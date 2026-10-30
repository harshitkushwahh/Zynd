# Core HTTP orchestrator (Finprim / Cybrilla)

All outbound **Finprim MF** and **Cybrilla POA/KYC** HTTP traffic should flow through [`CybrillaHttpOrchestrator`](../../app/infrastructure/core/orchestrator.py) (`get_cybrilla_orchestrator()`).

## Channels

| Channel | Use |
|---------|-----|
| `finprim_mf` | Mutual fund OMS (`/api/om/*`, purchases, SIP, mandates) |
| `finprim_kyc` | Default Finprim REST (onboarding master data, legacy KYC) |
| `finprim_digilocker` | DigiLocker paths under `/v2/kyc_requests`, `/v2/identity_documents`, etc. |
| `finprim_kyc_tenant` | Separate KYC tenant OAuth when explicitly configured |
| `cybrilla_poa` | POA preverify, bank verify (`/poa/*`) |
| `cybrilla_poa_kyc_forms` | POA-hosted kyc_forms |

Runtime credentials come from [`integration_runtime.py`](../../app/application/integrations/integration_runtime.py).

## Layout

- [`app/infrastructure/core/`](../../app/infrastructure/core/)  orchestrator, tokens, errors, channels
- [`app/infrastructure/core/kyc/`](../../app/infrastructure/core/kyc/)  KYC/POA JSON helpers and domain clients
- [`app/infrastructure/core/mf/`](../../app/infrastructure/core/mf/)  MF OMS, investor, payment, mandate clients
- [`app/application/core/facade.py`](../../app/application/core/facade.py)  router-safe exports

Legacy import paths (`app.infrastructure.cybrilla.*`, `app.infrastructure.kyc.fp_clients`, `app.infrastructure.mf.fp_oms_client`) remain as shims.

Platform config/DB/redis live in [`app/core/`](../../app/core/)  not the HTTP orchestrator.

## API layer rule

`app/api/**` must not import `app.infrastructure.mf.fp_*` or `app.infrastructure.kyc.fp_clients` directly. Use application services or `app.application.core.facade`.

CI: [`zynd-validate-api-cybrilla-imports.py`](../../../.github/scripts/zynd-validate-api-cybrilla-imports.py) (repo root)

## Adding a new Finprim call

1. Prefer a method on the existing MF or KYC client module under `infrastructure/core/` that calls `get_cybrilla_orchestrator().request_json(...)` or `request_mf(...)`.
2. Do not open a new raw `httpx.AsyncClient` to Finprim/Cybrilla hosts from application or API code.
