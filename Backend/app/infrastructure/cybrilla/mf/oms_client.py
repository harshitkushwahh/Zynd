"""Backward-compatible shim — use ``app.infrastructure.core.mf.oms_client`` instead."""

from app.infrastructure.core.mf import oms_client as _impl

__all__ = [name for name in dir(_impl) if not name.startswith("__")]
globals().update({name: getattr(_impl, name) for name in __all__})
