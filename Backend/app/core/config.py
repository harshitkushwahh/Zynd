from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.encryption_keys import parse_versioned_keys

_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
_REPO_ROOT = _BACKEND_ROOT.parent


def _is_pem_content(value: str) -> bool:
    return "-----BEGIN" in value


def _read_pem_file(path: str) -> str:
    file_path = Path(path)
    if not file_path.is_absolute():
        file_path = _BACKEND_ROOT / path
    return file_path.read_text(encoding="utf-8")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "ZYND API"
    app_env: Literal["development", "staging", "production"] = "development"
    debug: bool = True
    database_echo: bool = False
    dev_otp: str = ""
    dev_skip_rate_limits: bool = False
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_prefix: str = "/api/v1"

    cors_origins: str = (
        "http://localhost:7777,http://localhost:8888,"
        "http://127.0.0.1:7777,http://127.0.0.1:8888"
    )

    database_url: str = "postgresql+asyncpg://zynd:zynd@localhost:5432/zynd"

    redis_url: str = "redis://localhost:6379/0"
    redis_session_db: int = 1
    redis_cache_db: int = 2
    redis_event_stream_db: int = 3

    secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_private_key_pem: str = ""
    jwt_public_key_pem: str = ""
    jwt_private_key_file: str = ""
    jwt_public_key_file: str = ""
    jwt_kid: str = "zynd-1"

    @model_validator(mode="after")
    def resolve_jwt_keys(self) -> "Settings":
        private_pem = self.jwt_private_key_pem.strip()
        if _is_pem_content(private_pem):
            object.__setattr__(self, "jwt_private_key_pem", private_pem)
        elif self.jwt_private_key_file:
            object.__setattr__(
                self,
                "jwt_private_key_pem",
                _read_pem_file(self.jwt_private_key_file),
            )
        elif private_pem:
            object.__setattr__(self, "jwt_private_key_pem", "")

        public_pem = self.jwt_public_key_pem.strip()
        if _is_pem_content(public_pem):
            object.__setattr__(self, "jwt_public_key_pem", public_pem)
        elif self.jwt_public_key_file:
            object.__setattr__(
                self,
                "jwt_public_key_pem",
                _read_pem_file(self.jwt_public_key_file),
            )
        elif public_pem:
            object.__setattr__(self, "jwt_public_key_pem", "")

        return self

    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    google_client_id: str = ""
    apple_client_id: str = ""
    turnstile_secret_key: str = ""

    lockout_max_attempts: int = 5
    lockout_duration_minutes: int = 15

    mfa_encryption_key: str = ""
    mfa_encryption_keys: str = ""
    pii_encryption_key: str = ""
    pii_encryption_keys: str = ""
    current_mfa_key_version: int = 1
    current_pii_key_version: int = 1
    secrets_provider: Literal["local", "vault", "aws"] = "local"
    vault_addr: str = ""
    vault_token: str = ""
    vault_mount: str = "secret"
    aws_secrets_arn: str = ""
    aws_region: str = ""
    max_concurrent_sessions: int = 3
    mfa_pending_ttl_seconds: int = 300
    oauth_link_ttl_seconds: int = 900
    step_up_ttl_seconds: int = 600
    account_deletion_grace_days: int = 30
    anonymized_email_domain: str = "zynd.invalid"
    deletion_executor_batch_size: int = 50
    deletion_executor_interval_seconds: int = 3600
    mongo_url: str = ""
    mongo_conn: str = ""
    mongo_db_name: str = "zynd_analytics"
    mongo_export_batch_size: int = 500
    mongo_mf_raw_db: str = "zynd_mf_raw"
    hibp_enabled: bool = True
    otp_send_limit_per_identifier: int = 5
    otp_send_limit_per_ip: int = 20
    otp_send_window_seconds: int = 3600

    sms_provider: Literal["", "stub"] = ""

    @property
    def resolved_mfa_encryption_key(self) -> str:
        keys = self.resolved_mfa_encryption_keys
        return keys[self.current_mfa_key_version]

    @property
    def resolved_mfa_encryption_keys(self) -> dict[int, str]:
        return parse_versioned_keys(
            self.mfa_encryption_keys,
            fallback=self.mfa_encryption_key or self.secret_key,
            env=self.app_env,
        )

    @property
    def resolved_pii_encryption_keys(self) -> dict[int, str]:
        return parse_versioned_keys(
            self.pii_encryption_keys,
            fallback=self.pii_encryption_key or self.mfa_encryption_key or self.secret_key,
            env=self.app_env,
        )

    frontend_url: str = "http://localhost:7777"
    admin_frontend_url: str = "http://localhost:8888"
    referral_min_first_investment_inr: int = 1000
    referral_qualification_hold_days: int = 30
    referral_min_engagement_investment_inr: int = 1000
    referral_aum_milestone_inr: int = 100_000
    webauthn_rp_name: str = "Zynd"
    webauthn_rp_id: str = ""
    webauthn_origins: str = ""
    refresh_cookie_name: str = "zynd_refresh_token"
    refresh_cookie_secure: bool = False
    refresh_cookie_samesite: str = "lax"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    email_from: str = ""

    brevo_api_key: str = ""
    brevo_smtp_key: str = ""
    brevo_smtp_login: str = ""
    brevo_from: str = ""

    documents_root: str = ""
    documents_max_bytes: int = 10 * 1024 * 1024
    documents_profile_image_max_bytes: int = 4 * 1024 * 1024
    documents_profile_image_min_dimension: int = 128
    documents_profile_image_max_dimension: int = 2048
    documents_profile_image_upload_limit: int = 10
    documents_profile_image_upload_window_seconds: int = 3600
    document_storage_provider: Literal["local", "s3"] = "local"
    documents_local_encrypt_pii: bool = True
    pii_documents_bucket: str = "zynd-pii-documents"
    public_assets_bucket: str = "zynd-public-assets"
    s3_endpoint_url: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_region: str = "us-east-1"
    s3_force_path_style: bool = True
    kms_key_id_pii: str = ""
    kms_key_id_public: str = ""
    documents_download_url_ttl_seconds: int = 300
    api_public_url: str = ""
    document_scan_dispatch_mode: Literal["sync", "async"] = "async"
    redis_document_worker_db: int = 4
    documents_scan_queue_key: str = "zynd:documents:scan"
    documents_scan_dead_letter_key: str = "zynd:documents:scan:dead"
    documents_scan_max_attempts: int = 5
    documents_scan_worker_block_seconds: int = 5
    notifications_unread_cache_enabled: bool = True
    notifications_unread_cache_ttl_seconds: int = 604800
    notifications_push_queue_key: str = "zynd:notifications:push"
    notifications_push_dead_letter_key: str = "zynd:notifications:push:dead"
    notifications_push_max_attempts: int = 5
    notifications_push_worker_block_seconds: int = 5
    notifications_retention_purge_batch_size: int = 500
    clamav_enabled: bool = False
    clamav_host: str = "localhost"
    clamav_port: int = 3310
    clamav_timeout_seconds: int = 30
    clamav_fail_open: bool = False
    documents_worm_s3_object_lock_enabled: bool = False
    documents_worm_retention_days: int = 0
    documents_cdn_base_url: str = ""
    documents_public_cache_max_age_seconds: int = 2_592_000

    # KYC integrations — use stub when keys are absent in development
    kyc_provider_mode: Literal["auto", "stub", "live"] = "auto"
    kyckart_base_url: str = ""
    kyckart_api_key: str = ""
    kyckart_bank_verification_path: str = "/api/bank/pennyLessV4"
    fp_poa_token_base_url: str = ""
    fp_poa_client_id: str = ""
    fp_poa_client_secret: str = ""
    fp_poa_base_url: str = "https://api.cybrilla.com"
    fp_poa_auth_tenant: str = "cybrillapoa"
    fp_base_url: str = ""
    fp_tenant: str = ""
    fp_client_id: str = ""
    fp_client_secret: str = ""
    fp_enabled: bool = False
    fp_token_cache_minutes: int = 25
    digilocker_fp_tenant: str = ""
    kyc_digilocker_callback_url: str = ""
    kyc_proof_callback_url: str = ""
    kyc_esign_callback_url: str = ""
    kyc_auto_kra_check_enabled: bool = True

    # Mutual fund ingestion — Cybrilla scheme sync + AMFI NAV overlay
    zynd_distributor_arn: str = ""
    zynd_distributor_euin: str = ""
    zynd_mf_ingestion_enabled: bool = True
    zynd_mf_scheme_sync_enabled: bool = True
    zynd_mf_scheme_sync_cron: str = "0 20 * * *"
    zynd_mf_scheme_sync_batch_size: int = 100
    zynd_mf_scheme_staging_enabled: bool = True
    zynd_mf_scheme_promote_auto: bool = False
    zynd_mf_scheme_staging_ingest_cron: str = "0 20 * * *"
    zynd_mf_scheme_staging_validate_cron: str = "2 20 * * *"
    zynd_mf_scheme_staging_promote_cron: str = "5 20 * * *"
    zynd_mf_nav_ingestion_enabled: bool = True
    zynd_mf_nav_cron: str = "0 21 * * *"
    zynd_mf_amfi_nav_url: str = "https://www.amfiindia.com/spages/NAVAll.txt"
    zynd_mf_fetch_timeout_seconds: int = 60
    zynd_mf_nav_batch_size: int = 500
    zynd_mf_nav_write_chunk_size: int = 50
    zynd_mf_min_nav_record_count: int = 5000
    zynd_mf_min_file_size_bytes: int = 512_000
    zynd_mf_nav_max_age_days: int = 1
    zynd_mf_nav_isin_match_only: bool = True
    zynd_mf_cold_start_backfill_enabled: bool = True
    zynd_mf_cold_start_backfill_threshold: int = 1000
    zynd_mf_cold_start_backfill_from_date: str = "2006-04-01"
    zynd_mf_cold_start_backfill_days_per_window: int = 90
    zynd_mf_cold_start_backfill_cron: str = "30 18 * * *"
    zynd_mf_cold_start_on_startup: bool = True
    zynd_mf_dependency_guard_enabled: bool = True
    zynd_mf_dependency_lookback_hours: int = 24
    zynd_mf_stale_run_cleanup_enabled: bool = True
    zynd_mf_stale_run_cleanup_cron: str = "0 */2 * * *"
    zynd_mf_stale_run_cleanup_threshold_hours: int = 3
    zynd_mf_aum_cron: str = "0 9 1 * *"
    zynd_mf_amfi_aum_url: str = "https://www.amfiindia.com/aum-data/aum-disclosure"
    zynd_mf_aum_ingestion_enabled: bool = False
    zynd_mf_ter_cron: str = "0 10 1 * *"
    zynd_mf_ter_ingestion_enabled: bool = False
    zynd_mf_ter_page_size: int = 500
    zynd_mf_ter_max_pages: int = 0
    zynd_mf_ter_financial_year: str = "2025-2026"
    zynd_mf_ter_month: str = ""
    zynd_mf_ter_tracker_url: str = ""
    zynd_mf_amfi_aum_scheme_wise_data_url: str = ""
    zynd_mf_aaum_enabled: bool = False
    zynd_mf_aaum_cron: str = "30 11 15 1,4,7,10 *"
    zynd_mf_aaum_str_type: str = "Categorywise"
    zynd_mf_aaum_fy_id: str = ""
    zynd_mf_aaum_period_id: str = ""
    zynd_mf_amfi_aaum_base_url: str = "https://www.amfiindia.com"
    zynd_mf_metrics_enabled: bool = True
    zynd_mf_metrics_cron: str = "0 22 * * *"
    zynd_mf_rank_cron: str = "30 23 * * *"
    zynd_mf_metrics_batch_size: int = 50
    zynd_mf_collections_enabled: bool = True
    zynd_mf_collection_top_n: int = 25
    zynd_mf_collection_best_sip_max_min_inr: int = 500
    zynd_mf_classification_cron: str = "15 22 * * *"
    zynd_mf_collection_assign_cron: str = "25 22 * * *"
    zynd_mf_raw_bucket: str = "zynd-mf-raw"
    zynd_mf_raw_archive_object_storage_enabled: bool = True
    zynd_mf_scheduler_tick_seconds: int = 60
    zynd_mf_catalog_lifecycle_enabled: bool = True
    zynd_mf_catalog_lifecycle_cron: str = "15 20 * * *"
    zynd_mf_amc_logo_ingest_enabled: bool = False
    zynd_mf_amc_logo_ingest_cron: str = "0 6 * * 1"
    zynd_mf_amc_logo_url_template: str = ""
    zynd_mf_amc_logo_manifest_url: str = ""
    zynd_mf_amc_logo_manifest_path: str = ""
    zynd_mf_catalog_health_gates_enabled: bool = True
    zynd_mf_nav_stale_days: int = 3
    zynd_mf_min_nav_rows: int = 50
    zynd_mf_invest_disclaimer: str = (
        "Mutual fund investments are subject to market risks. Read all scheme-related documents carefully. "
        "Past performance is not indicative of future returns."
    )
    zynd_mf_rules_enabled: bool = True
    zynd_mf_bulk_maker_checker_threshold: int = 25
    zynd_mf_invest_cache_enabled: bool = True
    zynd_mf_invest_cache_home_ttl_seconds: int = 600
    zynd_mf_invest_cache_category_ttl_seconds: int = 600
    zynd_mf_invest_cache_fund_ttl_seconds: int = 180
    zynd_mf_invest_cache_search_ttl_seconds: int = 300
    zynd_mf_invest_cache_config_ttl_seconds: int = 900
    zynd_mf_invest_cache_calc_ttl_seconds: int = 86400
    zynd_mf_amfi_scheme_master_enabled: bool = True
    zynd_mf_amfi_scheme_master_cron: str = "1 21 * * *"
    zynd_mf_return_calculator_enabled: bool = True
    zynd_mf_return_calculator_cron: str = "5 22 * * *"
    zynd_mf_amc_aum_rank_enabled: bool = True
    zynd_mf_amc_aum_rank_cron: str = "0 10 2 * *"
    zynd_mf_compliance_sync_enabled: bool = True
    zynd_mf_compliance_sync_cron: str = "30 20 * * 0"
    zynd_mf_compliance_sync_batch_size: int = 200
    zynd_mf_scheme_min_amounts_backfill_enabled: bool = True
    zynd_mf_scheme_min_amounts_backfill_cron: str = "15 21 * * *"
    zynd_mf_scheme_min_amounts_backfill_batch_size: int = 200
    zynd_mf_orders_enabled: bool = True
    zynd_mf_order_worker_tick_seconds: int = 30
    zynd_mf_order_worker_batch_size: int = 20
    zynd_mf_order_status_sync_enabled: bool = True
    zynd_mf_order_payment_gateway: str = "ondc"
    zynd_mf_cas_enabled: bool = False
    zynd_mf_central_base_url: str = ""
    zynd_mf_central_api_key: str = ""
    zynd_mf_cas_worker_tick_seconds: int = 60
    zynd_mf_cas_worker_batch_size: int = 10

    @property
    def resolved_mongo_url(self) -> str:
        return self.mongo_url.strip() or self.mongo_conn.strip()

    @property
    def resolved_fp_enabled(self) -> bool:
        if not self.fp_enabled:
            return False
        return bool(
            self.fp_base_url.strip()
            and self.fp_tenant.strip()
            and self.fp_client_id.strip()
            and self.fp_client_secret.strip()
        )

    @property
    def resolved_kyc_provider_live(self) -> bool:
        if self.kyc_provider_mode == "stub":
            return False
        if self.kyc_provider_mode == "live":
            return True
        return bool(
            self.kyckart_api_key.strip()
            and self.fp_client_id.strip()
            and self.fp_client_secret.strip()
        )

    @property
    def resolved_digilocker_fp_tenant(self) -> str:
        return self.digilocker_fp_tenant.strip() or self.fp_tenant.strip()

    @property
    def resolved_kyc_digilocker_callback_url(self) -> str:
        if self.kyc_digilocker_callback_url.strip():
            return self.kyc_digilocker_callback_url.rstrip("/")
        return f"{self.resolved_api_public_url}/kyc/public/digilocker-callback"

    @property
    def resolved_kyc_proof_callback_url(self) -> str:
        if self.kyc_proof_callback_url.strip():
            return self.kyc_proof_callback_url.rstrip("/")
        return f"{self.resolved_api_public_url}/kyc/public/proof-callback"

    @property
    def resolved_kyc_esign_callback_url(self) -> str:
        if self.kyc_esign_callback_url.strip():
            return self.kyc_esign_callback_url.rstrip("/")
        return f"{self.resolved_api_public_url}/kyc/public/esign-callback"

    @property
    def resolved_api_public_url(self) -> str:
        if self.api_public_url.strip():
            return self.api_public_url.rstrip("/")
        host = "127.0.0.1" if self.api_host in {"0.0.0.0", "::"} else self.api_host
        return f"http://{host}:{self.api_port}{self.api_prefix}"

    @property
    def resolved_documents_cdn_base_url(self) -> str:
        if self.documents_cdn_base_url.strip():
            return self.documents_cdn_base_url.rstrip("/")
        return ""

    @property
    def resolved_documents_root(self) -> Path:
        if self.documents_root.strip():
            path = Path(self.documents_root)
            if not path.is_absolute():
                path = _REPO_ROOT / path
            return path
        return _REPO_ROOT / "documents"

    @model_validator(mode="after")
    def resolve_brevo_smtp(self) -> "Settings":
        if not self.brevo_smtp_key:
            return self

        placeholder_hosts = {"", "smtp.yourprovider.com"}
        placeholder_users = {"", "..."}
        placeholder_passwords = {"", "..."}

        if self.smtp_host in placeholder_hosts:
            object.__setattr__(self, "smtp_host", "smtp-relay.brevo.com")

        if self.smtp_username in placeholder_users and self.brevo_smtp_login:
            object.__setattr__(self, "smtp_username", self.brevo_smtp_login)

        if self.smtp_password in placeholder_passwords:
            object.__setattr__(self, "smtp_password", self.brevo_smtp_key)

        if self.brevo_from and (
            not self.email_from or self.email_from == "security@zynd.co"
        ):
            object.__setattr__(self, "email_from", self.brevo_from)

        return self

    @model_validator(mode="after")
    def default_document_scan_mode_for_development(self) -> "Settings":
        import os

        if self.app_env != "development":
            return self

        # Local dev without the scan worker should scan synchronously on upload.
        if os.environ.get("DOCUMENT_SCAN_USE_WORKER_IN_DEV", "").lower() in {
            "1",
            "true",
            "yes",
        }:
            return self

        object.__setattr__(self, "document_scan_dispatch_mode", "sync")
        return self

    @model_validator(mode="after")
    def default_event_dispatch_for_development(self) -> "Settings":
        import os

        if self.app_env != "development":
            return self

        # Local dev should deliver OTP/signup/security email inline unless explicitly
        # testing the outbox + worker pipeline.
        if os.environ.get("EVENT_USE_WORKER_IN_DEV", "").lower() in {
            "1",
            "true",
            "yes",
        }:
            return self

        if self.event_dispatch_mode in {"outbox", "redis"}:
            object.__setattr__(self, "event_dispatch_mode", "sync")

        return self

    event_bus_adapter: Literal["redis", "kafka"] = "redis"
    event_stream_prefix: str = "zynd"
    event_dispatch_mode: Literal["sync", "outbox", "redis"] = "outbox"
    outbox_relay_batch_size: int = 100
    outbox_relay_max_attempts: int = 10
    outbox_relay_interval_seconds: int = 5

    fcm_enabled: bool = False
    firebase_project_id: str = ""
    firebase_service_account_json: str = ""
    firebase_service_account_file: str = ""

    @property
    def resolved_firebase_service_account_info(self) -> dict | None:
        import json

        raw_json = self.firebase_service_account_json.strip()
        if raw_json:
            try:
                return json.loads(raw_json)
            except json.JSONDecodeError:
                return None

        if self.firebase_service_account_file.strip():
            file_path = Path(self.firebase_service_account_file)
            if not file_path.is_absolute():
                file_path = _BACKEND_ROOT / file_path
            if file_path.is_file():
                try:
                    return json.loads(file_path.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    return None
        return None

    @property
    def fcm_configured(self) -> bool:
        return bool(
            self.fcm_enabled
            and self.firebase_project_id.strip()
            and self.resolved_firebase_service_account_info
        )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def resolved_webauthn_rp_id(self) -> str:
        if self.webauthn_rp_id.strip():
            return self.webauthn_rp_id.strip()
        from urllib.parse import urlparse

        hostname = urlparse(self.frontend_url).hostname
        return hostname or "localhost"

    @property
    def webauthn_origin_list(self) -> list[str]:
        if self.webauthn_origins.strip():
            return [origin.strip() for origin in self.webauthn_origins.split(",") if origin.strip()]
        origins = {self.frontend_url.rstrip("/"), self.admin_frontend_url.rstrip("/")}
        origins.update(self.cors_origin_list)
        return sorted(origin for origin in origins if origin)


@lru_cache
def get_settings() -> Settings:
    return Settings()
