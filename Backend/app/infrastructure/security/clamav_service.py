from __future__ import annotations

import asyncio
import logging
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
    except Exception as exc:
        logger.warning("ClamAV scan failed host=%s port=%s", settings.clamav_host, settings.clamav_port)
        return ClamavScanResult(clean=False, error=str(exc))

    if response is None:
        return ClamavScanResult(clean=True)

    status, signature = next(iter(response.values()))
    if status == "OK":
        return ClamavScanResult(clean=True)
    if status == "FOUND":
        return ClamavScanResult(clean=False, signature=str(signature))
    return ClamavScanResult(clean=False, error=f"Unexpected ClamAV status: {status}")


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

    return result
