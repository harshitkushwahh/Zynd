# J2 (new-to-KYC) — one DigiLocker (MultiPlus parity)

Audience: Zynd engineers.

**Rule:** `fresh_kyc` (J2) = **one** Finprim DigiLocker at the **address** step + **Finprim eSign** at Review. **No** Cybrilla `proof_details` / “Link KRA KYC form” at Review.

**J3** (`kra_update`) still uses Cybrilla POA `kycf_*` + proof DigiLocker at Review. See [KYC_DIGILOCKER_FLOW.md](./KYC_DIGILOCKER_FLOW.md).

Hybrid debugging (wrong journey mode, stale `kycf_*`): [KYC_DUAL_DIGILOCKER_HYBRID.md](./KYC_DUAL_DIGILOCKER_HYBRID.md) — **not** the J2 product spec.

## Implementation map (Zynd)

| Concern | Location |
|---------|----------|
| `should_use_poa_partner_form` | `Backend/app/application/kyc/kyc_flow_mode.py` |
| Web POA Review gate skip for J2 | `Web/src/features/kyc/lib/kyc-poa-review-pipeline.ts`, `kyc-flow-mode.ts` |
| No `kycf_*` provision after address for J2 | `provision_poa_kyc_form_after_path_a` in `poa_kyc_form_service.py` |
| J2 Review submit | `submit_fresh_kyc_via_finprim` in `finprim_fresh_kyc_service.py` |
| J3 Review submit | `submit_kyc_form` POA branch in `kyc_form_service.py` |

## Quick test

1. PAN readiness → `fresh_kyc` / `kyc_unavailable`.
2. Complete address DigiLocker once (`iddoc_*`).
3. Review submit → **no** “Link KRA KYC form”; **Finprim eSign** redirect (when configured).
4. Network: **no** `/poa-form/start` or `proof_details.fetch_url` for J2.
