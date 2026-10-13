"""Mask folio consent contacts for API responses."""

from __future__ import annotations

import re


def mask_mf_consent_email(email: str) -> str:
    local, _, domain = email.partition("@")
    if not domain:
        return email
    if len(local) <= 2:
        masked_local = local[0] + "•••"
    else:
        masked_local = local[0] + "•••" + local[-1]
    return f"{masked_local}@{domain}"


def mask_mf_consent_mobile(mobile: str) -> str:
    digits = re.sub(r"\D", "", mobile)
    if len(digits) < 4:
        return mobile
    return f"+91 •••• ••{digits[-4:]}"
