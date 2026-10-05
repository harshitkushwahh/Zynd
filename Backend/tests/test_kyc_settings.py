from __future__ import annotations

from app.core.config import Settings


def test_kyc_provider_mode_maps_legacy_stub_to_disabled() -> None:
    settings = Settings(kyc_provider_mode="stub")
    assert settings.kyc_provider_mode == "disabled"


def test_development_respects_explicit_kyc_sandbox_false() -> None:
    settings = Settings(
        app_env="development",
        kyc_digilocker_sandbox=False,
        kyc_esign_sandbox=False,
    )
    assert settings.kyc_digilocker_sandbox is False
    assert settings.kyc_esign_sandbox is False
