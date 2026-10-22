from __future__ import annotations

from typing import Final

PARTNER_PLACEHOLDER: Final = "<partner>"

PURPOSE_BANK_LOOKUP: Final = "ZERO_TOUCH_BANK_LOOKUP"
PURPOSE_CUSTOMER_LOOKUP: Final = "ZERO_TOUCH_CUSTOMER_LOOKUP"

CONSENT_MODE_CHECKBOX: Final = "checkbox"

# Cybrilla-approved text — only `<partner>` may be substituted.
BANK_CONSENT_TEMPLATE: Final = (
    "I allow <partner> to fetch my bank account details using my phone number via Cybrilla and its partners."
)
CUSTOMER_CONSENT_TEMPLATE: Final = (
    "I allow <partner> to fetch my demographic details using my phone number and name "
    "from the credit bureau via Cybrilla and its partners."
)

LOOKUP_KIND_BANK: Final = "bank"
LOOKUP_KIND_CUSTOMER: Final = "customer"

CONSENT_TEMPLATE_BY_KIND: Final = {
    LOOKUP_KIND_BANK: BANK_CONSENT_TEMPLATE,
    LOOKUP_KIND_CUSTOMER: CUSTOMER_CONSENT_TEMPLATE,
}
PURPOSE_BY_KIND: Final = {
    LOOKUP_KIND_BANK: PURPOSE_BANK_LOOKUP,
    LOOKUP_KIND_CUSTOMER: PURPOSE_CUSTOMER_LOOKUP,
}

# Fetch statuses stored in zto_lookup_fetches.status
FETCH_PENDING: Final = "pending"
FETCH_SUCCESS: Final = "success"
FETCH_FAILED: Final = "failed"
FETCH_TIMEOUT: Final = "timeout"
FETCH_DUPLICATE: Final = "duplicate"

# Cybrilla lookup statuses
PROVIDER_TERMINAL_SUCCESS: Final = frozenset({"success", "completed"})
PROVIDER_TERMINAL_FAILURE: Final = frozenset({"failed", "failure", "not_found", "rejected", "expired"})


def consent_text(kind: str, partner_name: str) -> str:
    return CONSENT_TEMPLATE_BY_KIND[kind].replace(PARTNER_PLACEHOLDER, partner_name)
