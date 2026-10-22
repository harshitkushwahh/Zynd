from datetime import datetime, timezone

from app.application.kyc.zto.constants import PROVIDER_TERMINAL_SUCCESS
from app.application.kyc.zto.normalize import (
    build_cybrilla_lookup_consent,
    format_lookup_consent_collected_at,
    normalize_lookup_consent_ip,
    normalize_lookup_phone,
)


def test_cybrilla_production_success_status_is_terminal_success() -> None:
    assert "successful" in PROVIDER_TERMINAL_SUCCESS


def test_normalize_lookup_phone_strips_country_code() -> None:
    assert normalize_lookup_phone("+919899293338") == "9899293338"
    assert normalize_lookup_phone("9899293338") == "9899293338"


def test_normalize_lookup_consent_ip_maps_loopback_v6() -> None:
    assert normalize_lookup_consent_ip("::1") == "127.0.0.1"
    assert normalize_lookup_consent_ip(None) == "127.0.0.1"
    assert normalize_lookup_consent_ip("203.0.113.7") == "203.0.113.7"


def test_format_lookup_consent_collected_at_drops_tz_and_microseconds() -> None:
    dt = datetime(2026, 10, 22, 8, 40, 43, 287371, tzinfo=timezone.utc)
    assert format_lookup_consent_collected_at(dt) == "2026-10-22T08:40:43"


def test_build_cybrilla_lookup_consent_matches_multiplus_shape() -> None:
    dt = datetime(2026, 10, 22, 8, 40, 43, tzinfo=timezone.utc)
    block = build_cybrilla_lookup_consent(
        text="I allow Zynd to fetch my bank account details using my phone number via Cybrilla and its partners.",
        mode="checkbox",
        collected_at=dt,
        ip_address="::1",
    )
    assert block == {
        "collected_at": "2026-10-22T08:40:43",
        "text": "I allow Zynd to fetch my bank account details using my phone number via Cybrilla and its partners.",
        "mode": "checkbox",
        "ip_address": "127.0.0.1",
    }
