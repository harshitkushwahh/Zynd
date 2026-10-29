"""Backward-compatible shim  use ``app.infrastructure.core.kyc.fp_clients`` instead."""

from app.infrastructure.core.kyc import fp_clients as _impl

__all__ = [name for name in dir(_impl) if not name.startswith("__")]
globals().update({name: getattr(_impl, name) for name in __all__})
