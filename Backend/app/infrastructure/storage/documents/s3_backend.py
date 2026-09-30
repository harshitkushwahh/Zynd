from __future__ import annotations

from datetime import datetime
from functools import lru_cache
from typing import Any

import boto3
from botocore.client import BaseClient
from botocore.exceptions import ClientError

from app.core.config import Settings, get_settings
from app.infrastructure.storage.documents.bucket_policy import is_pii_bucket, kms_key_for_bucket


@lru_cache
def _s3_client(
    endpoint_url: str,
    region_name: str,
    access_key_id: str,
    secret_access_key: str,
    force_path_style: bool,
) -> BaseClient:
    return boto3.client(
        "s3",
        endpoint_url=endpoint_url or None,
        region_name=region_name,
        aws_access_key_id=access_key_id or None,
        aws_secret_access_key=secret_access_key or None,
        config=boto3.session.Config(s3={"addressing_style": "path" if force_path_style else "auto"}),
    )


class S3DocumentStorageBackend:
    provider = "s3"

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._client = _s3_client(
            self._settings.s3_endpoint_url.strip(),
            self._settings.s3_region.strip(),
            self._settings.s3_access_key_id.strip(),
            self._settings.s3_secret_access_key.strip(),
            self._settings.s3_force_path_style,
        )

    def _put_extra_args(self, *, bucket: str) -> dict[str, Any]:
        kms_key = kms_key_for_bucket(bucket, self._settings)
        if kms_key:
            return {"ServerSideEncryption": "aws:kms", "SSEKMSKeyId": kms_key}
        if is_pii_bucket(bucket, self._settings):
            return {"ServerSideEncryption": "AES256"}
        return {"ServerSideEncryption": "AES256"}

    def write_bytes(
        self,
        *,
        bucket: str,
        storage_key: str,
        content: bytes,
        encrypt_at_rest: bool,
    ) -> None:
        _ = encrypt_at_rest
        extra_args = self._put_extra_args(bucket=bucket)
        if not is_pii_bucket(bucket, self._settings):
            extra_args["CacheControl"] = (
                f"public, max-age={self._settings.documents_public_cache_max_age_seconds}, immutable"
            )
        self._client.put_object(
            Bucket=bucket,
            Key=storage_key,
            Body=content,
            **extra_args,
        )

    def read_bytes(
        self,
        *,
        bucket: str,
        storage_key: str,
        decrypt_at_rest: bool,
    ) -> bytes:
        _ = decrypt_at_rest
        response = self._client.get_object(Bucket=bucket, Key=storage_key)
        body = response["Body"].read()
        return body

    def exists(self, *, bucket: str, storage_key: str) -> bool:
        try:
            self._client.head_object(Bucket=bucket, Key=storage_key)
            return True
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code")
            if error_code in {"404", "NoSuchKey", "NotFound"}:
                return False
            raise

    def generate_presigned_download_url(
        self,
        *,
        bucket: str,
        storage_key: str,
        expires_in: int,
        mime_type: str,
        filename: str,
    ) -> str:
        safe_filename = filename.replace('"', "")
        return self._client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": bucket,
                "Key": storage_key,
                "ResponseContentType": mime_type,
                "ResponseContentDisposition": f'inline; filename="{safe_filename}"',
            },
            ExpiresIn=expires_in,
        )

    def delete_object(self, *, bucket: str, storage_key: str, force: bool = False) -> None:
        _ = force
        self._client.delete_object(Bucket=bucket, Key=storage_key)

    def apply_worm_retention(
        self,
        *,
        bucket: str,
        storage_key: str,
        retain_until: datetime,
    ) -> None:
        self._client.put_object_retention(
            Bucket=bucket,
            Key=storage_key,
            Retention={
                "Mode": "COMPLIANCE",
                "RetainUntilDate": retain_until,
            },
        )

    def move_object(self, *, bucket: str, storage_key: str, dest_key: str) -> None:
        self._client.copy_object(
            Bucket=bucket,
            Key=dest_key,
            CopySource={"Bucket": bucket, "Key": storage_key},
        )
        self._client.delete_object(Bucket=bucket, Key=storage_key)
