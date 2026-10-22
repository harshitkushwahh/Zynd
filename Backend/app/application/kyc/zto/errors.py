from __future__ import annotations

from app.application.kyc.errors import KycError


class ZtoError(KycError):
    """Zero-Touch Lookup error — compatible with the KYC HTTP error handler."""
