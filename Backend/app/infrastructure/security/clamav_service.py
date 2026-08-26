from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from dataclasses import dataclass
from io import BytesIO

from app.core.config import Settings, get_settings

try:
    import pyclamd
except ImportError:  # pragma: no cover - exercised when pyclamd is missing
    pyclamd = None

logger = logging.getLogger(__name__)

EICAR_TEST_STRING = (
    b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
)


@dataclass(frozen=True, slots=True)
class ClamavScanResult:
    clean: bool
    signature: str | None = None
    error: str | None = None


def _parse_clamav_response(response: dict | None) -> ClamavScanResult:
    if response is None:
        return ClamavScanResult(clean=True)

    status, detail = next(iter(response.values()))
    if status == "OK":
        return ClamavScanResult(clean=True)
    if status == "FOUND":
        return ClamavScanResult(clean=False, signature=str(detail))
    if status == "ERROR":
        return ClamavScanResult(clean=False, error=str(detail))
    return ClamavScanResult(clean=False, error=f"Unexpected ClamAV status: {status}")


def _should_retry_with_file_scan(error: str | None) -> bool:
    if not error:
        return False
    normalized = error.lower()
    return "instream size limit exceeded" in normalized or "streammaxlength" in normalized


def _scan_file_path(client: object, path: str) -> ClamavScanResult:
    response = client.scan(path)
    return _parse_clamav_response(response)


def _scan_bytes_sync(content: bytes, settings: Settings) -> ClamavScanResult:
    if pyclamd is None:
        return ClamavScanResult(clean=False, error="pyclamd unavailable")

    if len(content) > settings.clamav_stream_max_length_bytes:
        return ClamavScanResult(
            clean=False,
            error="INSTREAM size limit exceeded",
        )

    try:
        client = pyclamd.ClamdNetworkSocket(
            settings.clamav_host,
            settings.clamav_port,
            timeout=settings.clamav_timeout_seconds,
        )
        response = client.scan_stream(BytesIO(content))
        result = _parse_clamav_response(response)
    except Exception as exc:
        logger.warning("ClamAV scan failed host=%s port=%s", settings.clamav_host, settings.clamav_port)
        result = ClamavScanResult(clean=False, error=str(exc))

    if (
        not result.clean
        and not result.signature
        and _should_retry_with_file_scan(result.error)
    ):
        try:
            with tempfile.NamedTemporaryFile(delete=False) as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            try:
                return _scan_file_path(client, tmp_path)
            finally:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    logger.warning("ClamAV temp scan file cleanup failed path=%s", tmp_path)
        except Exception as exc:
            logger.warning(
                "ClamAV file scan fallback failed host=%s port=%s",
                settings.clamav_host,
                settings.clamav_port,
            )
            return ClamavScanResult(clean=False, error=str(exc))

    return result


async def scan_bytes_for_malware(content: bytes, settings: Settings | None = None) -> ClamavScanResult:
    settings = settings or get_settings()
    if not settings.clamav_enabled:
        return ClamavScanResult(clean=True)

    result = await asyncio.to_thread(_scan_bytes_sync, content, settings)
    if result.clean or result.signature:
        return result

    if settings.clamav_fail_open:
        logger.warning("ClamAV unavailable; allowing upload because CLAMAV_FAIL_OPEN=true")
        return ClamavScanResult(clean=True)

    if settings.app_env == "development" and not result.signature:
        logger.warning(
            "ClamAV unavailable in development; allowing upload error=%s",
            result.error,
        )
        return ClamavScanResult(clean=True)

    return result
