"""Phase 3 — login geo-velocity checks."""

from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import httpx

from app.core.config import get_settings
from app.core.redis import get_redis

GEO_CACHE_TTL_SECONDS = 86_400
LAST_LOGIN_GEO_TTL_SECONDS = 7 * 86_400
MIN_ELAPSED_MINUTES = 8
IMPOSSIBLE_SPEED_KMH = 900


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _is_public_ip(ip: str | None) -> bool:
    if not ip:
        return False
    if ip in {"127.0.0.1", "::1"}:
        return False
    if ip.startswith("10.") or ip.startswith("192.168.") or ip.startswith("172."):
        return False
    return True


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius_km * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def _lookup_ip_geo(ip: str) -> dict[str, Any] | None:
    settings = get_settings()
    redis = await get_redis(settings.redis_cache_db)
    cache_key = f"ip_geo:{ip}"
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"http://ip-api.com/json/{ip}?fields=status,country,lat,lon")
            response.raise_for_status()
            payload = response.json()
    except Exception:
        return None

    if payload.get("status") != "success":
        return None

    geo = {
        "country": payload.get("country"),
        "lat": payload.get("lat"),
        "lon": payload.get("lon"),
    }
    await redis.setex(cache_key, GEO_CACHE_TTL_SECONDS, json.dumps(geo))
    return geo


async def evaluate_login_velocity(user_id: UUID, ip: str | None) -> dict[str, Any] | None:
    if not _is_public_ip(ip):
        return None

    geo = await _lookup_ip_geo(ip)  # type: ignore[arg-type]
    if not geo or geo.get("lat") is None or geo.get("lon") is None:
        return None

    settings = get_settings()
    redis = await get_redis(settings.redis_session_db)
    key = f"login_geo:{user_id}"
    raw_previous = await redis.get(key)
    current = {
        "ip": ip,
        "country": geo.get("country"),
        "lat": geo["lat"],
        "lon": geo["lon"],
        "at": _now().isoformat(),
    }
    await redis.setex(key, LAST_LOGIN_GEO_TTL_SECONDS, json.dumps(current))

    if not raw_previous:
        return None

    previous = json.loads(raw_previous)
    previous_at = datetime.fromisoformat(previous["at"])
    elapsed_minutes = max((_now() - previous_at).total_seconds() / 60, 0.01)
    distance_km = _haversine_km(
        float(previous["lat"]),
        float(previous["lon"]),
        float(current["lat"]),
        float(current["lon"]),
    )
    speed_kmh = distance_km / (elapsed_minutes / 60)

    if elapsed_minutes > MIN_ELAPSED_MINUTES or speed_kmh <= IMPOSSIBLE_SPEED_KMH:
        return None

    return {
        "distance_km": round(distance_km, 1),
        "elapsed_minutes": round(elapsed_minutes, 1),
        "speed_kmh": round(speed_kmh, 1),
        "previous_country": previous.get("country"),
        "current_country": current.get("country"),
        "previous_ip": previous.get("ip"),
        "current_ip": ip,
    }
