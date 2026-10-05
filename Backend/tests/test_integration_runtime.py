from __future__ import annotations

from unittest.mock import patch

from app.application.integrations.integration_config_service import _set_cached_integration_environment
from app.application.integrations.integration_runtime import (
    cybrilla_poa_kyc_uses_sandbox_partner_credentials,
    finprim_kyc_tenant_explicitly_configured,
    get_cybrilla_poa_kyc_runtime,
    get_finprim_digilocker_runtime,
    get_finprim_runtime,
    is_cybrilla_poa_kyc_live,
    profile_configured,
    resolve_integration_field,
)
from app.infrastructure.kyc.fp_clients import _fp_runtime, _use_kyc_tenant_runtime
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


def test_cybrilla_poa_kyc_runtime_remaps_s_finprim_when_live_client_on_test_mode() -> None:
    settings = _settings(
        app_env="development",
        kyc_digilocker_sandbox=True,
        kyc_esign_sandbox=True,
        fp_poa_token_base_url_test="https://s.finprim.com",
        fp_poa_base_url_test="https://s.finprim.com",
        fp_poa_auth_tenant_test="cybrillapoa",
        fp_poa_client_id_test="mfdptnr_multiplus_live_abc",
        fp_poa_client_secret_test="poa-test-secret",
        fp_poa_token_base_url="https://api.fintechprimitives.com",
        fp_poa_base_url="https://api.cybrilla.com",
    )

    with patch(
        "app.application.integrations.integration_runtime.get_settings",
        return_value=settings,
    ):
        runtime = get_cybrilla_poa_kyc_runtime()
        assert runtime.resolved_token_base_url == "https://api.fintechprimitives.com"
        assert runtime.base_url == "https://api.cybrilla.com"


def test_cybrilla_poa_kyc_runtime_test_id_without_secret_uses_live_pair() -> None:
    settings = _settings(
        app_env="development",
        kyc_digilocker_sandbox=True,
        kyc_esign_sandbox=True,
        fp_poa_client_id_test="mfdptnr_multiplus_test_64262ae246c847cc8ef6064ba3d4adbb",
        fp_poa_client_secret_test="",
        fp_poa_client_id="legacy-live-id",
        fp_poa_client_secret="legacy-live-secret",
        fp_poa_client_id_live="legacy-live-id",
        fp_poa_client_secret_live="legacy-live-secret",
        fp_poa_token_base_url="https://api.fintechprimitives.com",
        fp_poa_base_url="https://api.cybrilla.com",
    )

    with patch(
        "app.application.integrations.integration_runtime.get_settings",
        return_value=settings,
    ):
        runtime = get_cybrilla_poa_kyc_runtime()
        assert runtime.client_id == "legacy-live-id"
        assert runtime.client_secret == "legacy-live-secret"
        assert runtime.resolved_token_base_url == "https://api.fintechprimitives.com"


def test_cybrilla_poa_kyc_runtime_sandbox_test_client_uses_s_finprim_oauth() -> None:
    settings = _settings(
        app_env="development",
        kyc_digilocker_sandbox=True,
        kyc_esign_sandbox=True,
        fp_poa_client_id_test="mfdptnr_multiplus_test_64262ae246c847cc8ef6064ba3d4adbb",
        fp_poa_client_secret_test="secret",
        fp_poa_auth_tenant_test="cybrillapoa",
    )

    with patch(
        "app.application.integrations.integration_runtime.get_settings",
        return_value=settings,
    ):
        runtime = get_cybrilla_poa_kyc_runtime()
        assert runtime.resolved_token_base_url == "https://s.finprim.com"
        assert runtime.base_url == "https://api.cybrilla.com"
        assert runtime.resolved_api_tenant == "cybrillarta"


def test_kyc_tenant_runtime_not_used_when_only_digilocker_credentials_set() -> None:
    settings = _settings(
        kyc_digilocker_sandbox=True,
        kyc_tenant_token_base_url="https://api.fintechprimitives.com",
        kyc_tenant_base_url="https://s.finprim.com",
        kyc_tenant_client_id="",
        kyc_tenant_client_secret="",
        digilocker_fp_client_id="dl-id",
        digilocker_fp_client_secret="dl-secret",
    )

    with patch(
        "app.application.integrations.integration_runtime.get_settings",
        return_value=settings,
    ):
        assert finprim_kyc_tenant_explicitly_configured() is False
        assert _use_kyc_tenant_runtime("/v2/kyc_requests/kycr_abc") is False
        assert _use_kyc_tenant_runtime("/v2/esigns/es_abc") is False


def test_kyc_tenant_runtime_used_when_client_pair_configured() -> None:
    settings = _settings(
        kyc_digilocker_sandbox=True,
        kyc_tenant_client_id="tenant-id",
        kyc_tenant_client_secret="tenant-secret",
    )

    with patch(
        "app.application.integrations.integration_runtime.get_settings",
        return_value=settings,
    ):
        assert finprim_kyc_tenant_explicitly_configured() is True
        assert _use_kyc_tenant_runtime("/v2/kyc_requests/kycr_abc") is True


def test_sandbox_digilocker_with_live_poa_client_does_not_require_sandbox_form_urls() -> None:
    settings = _settings(
        app_env="development",
        kyc_digilocker_sandbox=True,
        kyc_esign_sandbox=True,
        fp_poa_client_id="mfdptnr_multiplus_live_abc",
        fp_poa_client_secret="live-secret",
    )

    with patch(
        "app.application.integrations.integration_runtime.get_settings",
        return_value=settings,
    ):
        assert cybrilla_poa_kyc_uses_sandbox_partner_credentials() is False


def test_sandbox_poa_test_client_requires_sandbox_form_urls() -> None:
    settings = _settings(
        app_env="development",
        kyc_digilocker_sandbox=True,
        kyc_esign_sandbox=True,
        fp_poa_client_id_test="mfdptnr_multiplus_test_64262ae246c847cc8ef6064ba3d4adbb",
        fp_poa_client_secret_test="secret",
    )

    with patch(
        "app.application.integrations.integration_runtime.get_settings",
        return_value=settings,
    ):
        assert cybrilla_poa_kyc_uses_sandbox_partner_credentials() is True


def test_cybrilla_poa_kyc_runtime_sandbox_dev_reuses_unsuffixed_poa_when_test_unset() -> None:
    settings = _settings(
        app_env="development",
        kyc_digilocker_sandbox=True,
        kyc_esign_sandbox=True,
        fp_poa_client_id="legacy-poa-id",
        fp_poa_client_secret="legacy-poa-secret",
        fp_poa_base_url="https://api.cybrilla.com",
        fp_poa_token_base_url="https://api.fintechprimitives.com",
    )

    with patch(
        "app.application.integrations.integration_runtime.get_settings",
        return_value=settings,
    ):
        runtime = get_cybrilla_poa_kyc_runtime()
        assert runtime.environment == "test"
        assert runtime.client_id == "legacy-poa-id"
        assert runtime.client_secret == "legacy-poa-secret"
        assert is_cybrilla_poa_kyc_live()


def test_digilocker_live_ignores_sandbox_client_id_uses_fp_live() -> None:
    _set_cached_integration_environment("finprim", "live")
    settings = _settings(
        fp_enabled=True,
        kyc_digilocker_sandbox=False,
        digilocker_fp_base_url="https://api.fintechprimitives.com",
        digilocker_fp_token_base_url="https://api.fintechprimitives.com",
        digilocker_fp_tenant="multiplus",
        digilocker_fp_client_id="sandbox-only-id",
        digilocker_fp_client_secret="sandbox-only-secret",
        fp_client_id_live="live-fp-id",
        fp_client_secret_live="live-fp-secret",
        fp_tenant_live="tenant-live",
        fp_base_url_live="https://api.fintechprimitives.com",
    )

    with patch(
        "app.application.integrations.integration_runtime.get_settings",
        return_value=settings,
    ):
        runtime = get_finprim_digilocker_runtime()
        assert runtime.environment == "live"
        assert runtime.client_id == "live-fp-id"
        assert runtime.client_secret == "live-fp-secret"


def test_kyc_signature_files_route_uses_digilocker_host() -> None:
    settings = _settings(
        fp_enabled=True,
        kyc_digilocker_sandbox=True,
        digilocker_fp_base_url="https://s.finprim.com",
        digilocker_fp_token_base_url="https://s.finprim.com",
        digilocker_fp_tenant="multiplus",
        digilocker_fp_client_id="dl-id",
        digilocker_fp_client_secret="dl-secret",
        kyc_tenant_client_id="",
        kyc_tenant_client_secret="",
    )

    with patch(
        "app.application.integrations.integration_runtime.get_settings",
        return_value=settings,
    ):
        assert _use_kyc_tenant_runtime("/files") is False
        base, tenant = _fp_runtime(use_poa=False, path="/files")
        assert base == "https://s.finprim.com"
        assert tenant == "multiplus"


def test_cybrilla_poa_kyc_runtime_sandbox_prod_requires_test_creds() -> None:
    settings = _settings(
        app_env="production",
        kyc_digilocker_sandbox=True,
        kyc_esign_sandbox=True,
        fp_poa_client_id="legacy-poa-id",
        fp_poa_client_secret="legacy-poa-secret",
        fp_poa_base_url="https://api.cybrilla.com",
        fp_poa_token_base_url="https://api.fintechprimitives.com",
    )

    with patch(
        "app.application.integrations.integration_runtime.get_settings",
        return_value=settings,
    ):
        runtime = get_cybrilla_poa_kyc_runtime()
        assert runtime.environment == "test"
        assert runtime.client_id == ""
        assert not is_cybrilla_poa_kyc_live()


def test_cybrilla_poa_kyc_runtime_dev_falls_back_to_legacy_poa_vars_when_not_sandbox() -> None:
    _set_cached_integration_environment("cybrilla", "test")
    settings = _settings(
        app_env="development",
        kyc_digilocker_sandbox=False,
        kyc_esign_sandbox=False,
        fp_poa_client_id="legacy-poa-id",
        fp_poa_client_secret="legacy-poa-secret",
        fp_poa_base_url="https://s.finprim.com",
        fp_poa_token_base_url="https://s.finprim.com",
    )

    with patch(
        "app.application.integrations.integration_runtime.get_settings",
        return_value=settings,
    ):
        runtime = get_cybrilla_poa_kyc_runtime()
        assert runtime.environment == "test"
        assert runtime.client_id == "legacy-poa-id"
        assert runtime.client_secret == "legacy-poa-secret"
        assert is_cybrilla_poa_kyc_live()
