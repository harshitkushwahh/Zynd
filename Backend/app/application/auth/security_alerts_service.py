"""Security alert helpers — email/review side effects moved to event workers (Phase 2)."""

from __future__ import annotations

from app.infrastructure.persistence.models import Device


def _device_label(device: Device) -> str:
    parts = [part for part in (device.os, device.browser) if part]
    return " · ".join(parts) if parts else "Unknown device"
