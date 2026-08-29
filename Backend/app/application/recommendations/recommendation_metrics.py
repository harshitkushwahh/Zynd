from __future__ import annotations

import threading
from collections import defaultdict
from typing import Any

_lock = threading.Lock()
_resolve_total: dict[str, int] = defaultdict(int)
_block_reason_total: dict[str, int] = defaultdict(int)
_snapshot_hits = 0
_snapshot_misses = 0
_degraded_total = 0
_duration_ms_sum = 0.0
_duration_ms_count = 0


def record_resolve(
    *,
    eligible: bool,
    block_reason: str | None,
    snapshot_hit: bool,
    degraded: bool,
    duration_ms: float,
) -> None:
    global _snapshot_hits, _snapshot_misses, _degraded_total, _duration_ms_sum, _duration_ms_count

    with _lock:
        if eligible:
            _resolve_total["eligible"] += 1
        else:
            _resolve_total["blocked"] += 1
            if block_reason:
                _block_reason_total[block_reason] += 1

        if snapshot_hit:
            _snapshot_hits += 1
        elif eligible:
            _snapshot_misses += 1

        if degraded:
            _degraded_total += 1

        _duration_ms_sum += duration_ms
        _duration_ms_count += 1


def get_recommendation_metrics() -> dict[str, Any]:
    with _lock:
        snapshot_total = _snapshot_hits + _snapshot_misses
        snapshot_hit_rate = (
            round(_snapshot_hits / snapshot_total, 4) if snapshot_total else None
        )
        avg_duration_ms = (
            round(_duration_ms_sum / _duration_ms_count, 2) if _duration_ms_count else None
        )

        return {
            "resolve_total": dict(_resolve_total),
            "block_reason_total": dict(_block_reason_total),
            "snapshot_hits": _snapshot_hits,
            "snapshot_misses": _snapshot_misses,
            "snapshot_hit_rate": snapshot_hit_rate,
            "degraded_total": _degraded_total,
            "compute_duration_ms_avg": avg_duration_ms,
            "compute_count": _duration_ms_count,
        }


def reset_recommendation_metrics() -> None:
    global _snapshot_hits, _snapshot_misses, _degraded_total, _duration_ms_sum, _duration_ms_count

    with _lock:
        _resolve_total.clear()
        _block_reason_total.clear()
        _snapshot_hits = 0
        _snapshot_misses = 0
        _degraded_total = 0
        _duration_ms_sum = 0.0
        _duration_ms_count = 0
