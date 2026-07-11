from __future__ import annotations

import pytest

from app.application.kyc.errors import KycError
from app.application.kyc.geolocation_service import validate_kyc_geolocation


def test_validate_kyc_geolocation_accepts_valid_india_coords() -> None:
    validate_kyc_geolocation(latitude=28.6139, longitude=77.2090, accuracy_meters=50.0)


def test_validate_kyc_geolocation_rejects_missing_accuracy_when_too_low() -> None:
    with pytest.raises(KycError) as exc:
        validate_kyc_geolocation(latitude=28.6139, longitude=77.2090, accuracy_meters=9000.0)
    assert exc.value.code == "location_inaccurate"


def test_validate_kyc_geolocation_rejects_outside_india() -> None:
    with pytest.raises(KycError) as exc:
        validate_kyc_geolocation(latitude=40.7128, longitude=-74.0060)
    assert exc.value.code == "location_outside_india"


def test_validate_kyc_geolocation_rejects_vpn_or_proxy() -> None:
    with pytest.raises(KycError) as exc:
        validate_kyc_geolocation(
            latitude=28.6139,
            longitude=77.2090,
            ip_geo={"lat": 28.61, "lon": 77.21, "proxy": True, "hosting": False, "countryCode": "IN"},
        )
    assert exc.value.code == "location_vpn_detected"


def test_validate_kyc_geolocation_rejects_ip_gps_mismatch() -> None:
    with pytest.raises(KycError) as exc:
        validate_kyc_geolocation(
            latitude=28.6139,
            longitude=77.2090,
            ip_geo={"lat": 12.9716, "lon": 77.5946, "proxy": False, "hosting": False, "countryCode": "IN"},
        )
    assert exc.value.code == "location_spoof_detected"
