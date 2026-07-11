from __future__ import annotations

import json


def parse_versioned_keys(raw: str | None, *, fallback: str | None, env: str) -> dict[int, str]:
    if raw:
        loaded = json.loads(raw)
        if not isinstance(loaded, dict):
            raise ValueError("Versioned encryption keys must be a JSON object.")
        return {int(version): str(value) for version, value in loaded.items()}
    if fallback:
        return {1: fallback}
    if env == "production":
        raise RuntimeError("Encryption keys must be configured in production.")
    return {1: "development-only-key"}
