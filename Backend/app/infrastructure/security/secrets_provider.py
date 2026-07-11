from __future__ import annotations

import json
from abc import ABC, abstractmethod

import httpx

from app.core.config import Settings, get_settings


class SecretsProvider(ABC):
    @abstractmethod
    def get_encryption_key(self, purpose: str, version: int) -> str:
        """Return a raw secret string for the given purpose and version."""


class LocalSecretsProvider(SecretsProvider):
    """Development/local secrets from environment variables."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()

    def _purpose_keys(self, purpose: str) -> dict[int, str]:
        if purpose == "mfa_totp":
            return self._settings.resolved_mfa_encryption_keys
        if purpose == "pii":
            return self._settings.resolved_pii_encryption_keys
        raise KeyError(f"Unknown encryption purpose: {purpose}")

    def get_encryption_key(self, purpose: str, version: int) -> str:
        keys = self._purpose_keys(purpose)
        if version not in keys:
            raise KeyError(f"No encryption key for purpose={purpose} version={version}")
        return keys[version]


class VaultSecretsProvider(SecretsProvider):
    """HashiCorp Vault KV v2 secrets provider."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()

    def get_encryption_key(self, purpose: str, version: int) -> str:
        if not self._settings.vault_addr:
            raise RuntimeError("VAULT_ADDR is required when SECRETS_PROVIDER=vault")
        if not self._settings.vault_token:
            raise RuntimeError("VAULT_TOKEN is required when SECRETS_PROVIDER=vault")

        mount = self._settings.vault_mount or "secret"
        path = f"{purpose}/v{version}"
        url = f"{self._settings.vault_addr.rstrip('/')}/v1/{mount}/data/{path}"
        headers = {"X-Vault-Token": self._settings.vault_token}
        with httpx.Client(timeout=10.0) as client:
            response = client.get(url, headers=headers)
            response.raise_for_status()
            payload = response.json()["data"]["data"]
        key = payload.get("key")
        if not key:
            raise KeyError(f"Vault secret missing 'key' for purpose={purpose} version={version}")
        return str(key)


class AwsSecretsProvider(SecretsProvider):
    """AWS Secrets Manager provider."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()

    def get_encryption_key(self, purpose: str, version: int) -> str:
        if not self._settings.aws_secrets_arn:
            raise RuntimeError("AWS_SECRETS_ARN is required when SECRETS_PROVIDER=aws")
        try:
            import boto3
        except ImportError as exc:
            raise RuntimeError("boto3 is required for AWS secrets provider") from exc

        client = boto3.client("secretsmanager", region_name=self._settings.aws_region or None)
        secret_id = f"{self._settings.aws_secrets_arn}:{purpose}:v{version}"
        response = client.get_secret_value(SecretId=secret_id)
        payload = json.loads(response["SecretString"])
        key = payload.get("key")
        if not key:
            raise KeyError(f"AWS secret missing 'key' for purpose={purpose} version={version}")
        return str(key)


def get_secrets_provider() -> SecretsProvider:
    settings = get_settings()
    if settings.secrets_provider == "vault":
        return VaultSecretsProvider(settings)
    if settings.secrets_provider == "aws":
        return AwsSecretsProvider(settings)
    return LocalSecretsProvider(settings)
