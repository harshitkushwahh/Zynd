from __future__ import annotations

import math
from typing import Any

import httpx

from app.application.kyc.errors import KycError

INDIA_LAT_RANGE = (6.0, 37.5)
INDIA_LON_RANGE = (68.0, 97.5)
MAX_REPORTED_ACCURACY_METERS = 5000.0
MAX_IP_GPS_DISTANCE_KM = 350.0


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius_km * math.asin(min(1.0, math.sqrt(a)))


def _is_private_ip(ip: str) -> bool:
    normalized = ip.strip().lower()
    if normalized in {"127.0.0.1", "::1", "localhost"}:
        return True
    if normalized.startswith("192.168.") or normalized.startswith("10."):
        return True
    if normalized.startswith("172."):
        parts = normalized.split(".")
        if len(parts) > 1 and parts[1].isdigit():
            second = int(parts[1])
            if 16 <= second <= 31:
                return True
    return False


async def lookup_ip_geolocation(ip: str | None) -> dict[str, Any] | None:
    if not ip or _is_private_ip(ip):
        return None

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            response = await client.get(
                f"http://ip-api.com/json/{ip}",
                params={"fields": "status,lat,lon,proxy,hosting,countryCode"},
            )
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError):
        return None

    if payload.get("status") != "success":
        return None
    return payload


def validate_kyc_geolocation(
    *,
    latitude: float,
    longitude: float,
    accuracy_meters: float | None = None,
    client_ip: str | None = None,
    ip_geo: dict[str, Any] | None = None,
) -> None:
    if not (-90.0 <= latitude <= 90.0 and -180.0 <= longitude <= 180.0):
        raise KycError("Location coordinates are invalid.", "location_invalid", 400)

    if not (INDIA_LAT_RANGE[0] <= latitude <= INDIA_LAT_RANGE[1] and INDIA_LON_RANGE[0] <= longitude <= INDIA_LON_RANGE[1]):
        raise KycError(
            "KYC eSign requires your current location in India.",
            "location_outside_india",
            400,
        )

    if accuracy_meters is not None and accuracy_meters > MAX_REPORTED_ACCURACY_METERS:
        raise KycError(
            "Could not confirm your precise location. Disable mock location and try again.",
            "location_inaccurate",
            400,
        )

    if ip_geo:
        if ip_geo.get("proxy") or ip_geo.get("hosting"):
            raise KycError(
                "Disable VPN, proxy, or location spoofing apps and try again.",
                "location_vpn_detected",
                400,
            )

        ip_lat = ip_geo.get("lat")
        ip_lon = ip_geo.get("lon")
        if isinstance(ip_lat, (int, float)) and isinstance(ip_lon, (int, float)):
            distance_km = _haversine_km(latitude, longitude, float(ip_lat), float(ip_lon))
            if distance_km > MAX_IP_GPS_DISTANCE_KM:
                raise KycError(
                    "Your device location does not match your network location. Disable VPN or fake GPS and try again.",
                    "location_spoof_detected",
                    400,
                )

        country_code = str(ip_geo.get("countryCode") or "").upper()
        if country_code and country_code != "IN":
            raise KycError(
                "KYC eSign requires an Indian network location. Disable VPN and try again.",
                "location_vpn_detected",
                400,
            )

    _ = client_ip
