from __future__ import annotations

from unittest.mock import patch

from app.application.integrations.integration_config_service import _set_cached_integration_environment
from app.application.integrations.integration_runtime import (
    get_finprim_runtime,
    profile_configured,
    resolve_integration_field,
)
from app.core.config import Settings


def _settings(**overrides: str | bool) -> Settings:
    return Settings(**overrides)


def test_resolve_integration_field_test_ignores_legacy() -> None:
    settings = _settings(
        fp_base_url="https://legacy.example",
        fp_base_url_test="https://test.example",
    )
    assert resolve_integration_field(settings, "fp_base_url", "test") == "https://test.example"
    assert resolve_integration_field(settings, "fp_base_url", "live") == "https://legacy.example"


def test_resolve_integration_field_test_empty_without_suffix() -> None:
    settings = _settings(fp_base_url="https://legacy.example")
    assert resolve_integration_field(settings, "fp_base_url", "test") == ""


def test_finprim_runtime_prefers_mode_specific_values() -> None:
    _set_cached_integration_environment("finprim", "live")
    settings = _settings(
        fp_base_url="https://legacy.example",
        fp_base_url_test="https://test.example",
        fp_base_url_live="https://live.example",
        fp_tenant_test="tenant-test",
        fp_tenant_live="tenant-live",
        fp_client_id_test="id-test",
        fp_client_id_live="id-live",
        fp_client_secret_test="secret-test",
        fp_client_secret_live="secret-live",
        fp_enabled=True,
    )

    with patch(
        "app.application.integrations.integration_runtime.get_settings",
        return_value=settings,
    ):
        runtime = get_finprim_runtime()
        assert runtime.environment == "live"
        assert runtime.base_url == "https://live.example"
        assert runtime.tenant == "tenant-live"
        assert profile_configured(settings, "finprim", "live")
        assert not profile_configured(settings, "finprim", "test")


def test_finprim_runtime_legacy_maps_to_live_only() -> None:
    _set_cached_integration_environment("finprim", "live")
    settings = _settings(
        fp_base_url="https://legacy.example",
        fp_tenant="legacy-tenant",
        fp_client_id="legacy-id",
        fp_client_secret="legacy-secret",
        fp_enabled=True,
    )

    with patch(
        "app.application.integrations.integration_runtime.get_settings",
        return_value=settings,
    ):
        runtime = get_finprim_runtime()
        assert runtime.base_url == "https://legacy.example"
        assert runtime.tenant == "legacy-tenant"
        assert profile_configured(settings, "finprim", "live")
        assert not profile_configured(settings, "finprim", "test")
