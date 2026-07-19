from __future__ import annotations

import json
import logging
from pathlib import Path

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.application.mf.invest_catalog_invalidation import notify_invest_catalog_changed
from app.application.mf.public_asset_service import amc_logo_storage_key, build_public_asset_url
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import FundAmc, IngestionRunStatus
from app.infrastructure.storage.documents.factory import get_document_storage

logger = logging.getLogger(__name__)

LOCAL_FILE_PREFIX = "file:"


def _resolve_manifest_path(settings) -> Path | None:
    raw = settings.zynd_mf_amc_logo_manifest_path.strip()
    if not raw:
        return None
    path = Path(raw)
    if not path.is_absolute():
        backend_root = Path(__file__).resolve().parents[3]
        path = backend_root / path
    return path


async def _load_logo_manifest(
    client: httpx.AsyncClient,
    *,
    manifest_path: Path | None,
    manifest_url: str,
) -> tuple[dict[str, str], Path | None]:
    if manifest_path and manifest_path.is_file():
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            return {}, manifest_path.parent
        manifest = {str(key): str(value) for key, value in payload.items() if value}
        return manifest, manifest_path.parent

    if not manifest_url.strip():
        return {}, None

    response = await client.get(manifest_url)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        return {}, None
    return {str(key): str(value) for key, value in payload.items() if value}, None


async def _fetch_logo_bytes(
    client: httpx.AsyncClient,
    source_url: str,
    *,
    local_root: Path | None,
) -> tuple[bytes, str]:
    if source_url.startswith(LOCAL_FILE_PREFIX):
        if local_root is None:
            raise ValueError("Local logo path requires a filesystem manifest")
        relative = source_url.removeprefix(LOCAL_FILE_PREFIX).lstrip("/")
        file_path = (local_root / relative).resolve()
        if local_root.resolve() not in file_path.parents and file_path != local_root.resolve():
            raise ValueError(f"Logo path escapes manifest directory: {relative}")
        content = file_path.read_bytes()
        suffix = file_path.suffix.lower()
        if suffix == ".svg":
            content_type = "image/svg+xml"
        elif suffix in {".jpg", ".jpeg"}:
            content_type = "image/jpeg"
        else:
            content_type = "image/png"
        return content, content_type

    response = await client.get(source_url)
    response.raise_for_status()
    content_type = response.headers.get("content-type", "image/png")
    return response.content, content_type


def _resolve_source_url(amc: FundAmc, *, template: str, manifest: dict[str, str]) -> str | None:
    if amc.slug in manifest:
        return manifest[amc.slug]
    if amc.amc_code and amc.amc_code in manifest:
        return manifest[amc.amc_code]
    if template.strip():
        return template.format(slug=amc.slug, amc_code=amc.amc_code or "", name=amc.name)
    return None


async def run_amc_logo_ingestion(
    session: AsyncSession,
    *,
    triggered_by: str = "SCHEDULER",
) -> dict[str, int | str]:
    settings = get_settings()
    if not settings.zynd_mf_amc_logo_ingest_enabled:
        return {"skipped": 1, "reason": "amc_logo_ingest_disabled"}

    if (
        not settings.zynd_mf_amc_logo_url_template.strip()
        and not settings.zynd_mf_amc_logo_manifest_url.strip()
        and not settings.zynd_mf_amc_logo_manifest_path.strip()
    ):
        return {"skipped": 1, "reason": "logo_source_not_configured"}

    if await has_running_job(session, "amc-logo-ingest"):
        return {"skipped": 1, "reason": "already_running"}

    run = await begin_ingestion_run(session, job_name="amc-logo-ingest", triggered_by=triggered_by)
    processed = uploaded = skipped = failed = 0

    try:
        amcs = list(
            (
                await session.execute(
                    select(FundAmc).where(FundAmc.logo_url.is_(None)).order_by(FundAmc.id)
                )
            ).scalars()
        )
        storage = get_document_storage(settings)
        timeout = float(settings.zynd_mf_fetch_timeout_seconds)

        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            manifest_path = _resolve_manifest_path(settings)
            manifest, local_root = await _load_logo_manifest(
                client,
                manifest_path=manifest_path,
                manifest_url=settings.zynd_mf_amc_logo_manifest_url,
            )

            for amc in amcs:
                processed += 1
                source_url = _resolve_source_url(
                    amc,
                    template=settings.zynd_mf_amc_logo_url_template,
                    manifest=manifest,
                )
                if not source_url:
                    skipped += 1
                    continue

                try:
                    content, content_type = await _fetch_logo_bytes(
                        client,
                        source_url,
                        local_root=local_root,
                    )
                    if len(content) < 64:
                        skipped += 1
                        continue

                    extension = "png"
                    if "svg" in content_type:
                        extension = "svg"
                    elif "jpeg" in content_type or "jpg" in content_type:
                        extension = "jpg"

                    storage_key = amc_logo_storage_key(amc.slug, extension=extension)
                    storage.write_bytes(
                        bucket=settings.public_assets_bucket,
                        storage_key=storage_key,
                        content=content,
                        encrypt_at_rest=False,
                    )
                    amc.logo_url = f"storage:{storage_key}"
                    uploaded += 1
                except Exception as exc:
                    failed += 1
                    logger.warning("AMC logo ingest failed slug=%s url=%s error=%s", amc.slug, source_url, exc)

        status = IngestionRunStatus.succeeded if failed == 0 else IngestionRunStatus.partial
        await finish_ingestion_run(
            session,
            run,
            status=status,
            records_processed=processed,
            records_inserted=uploaded,
            records_skipped=skipped,
            metadata={"failed": failed, "manifest_entries": len(manifest)},
        )
        if uploaded:
            await notify_invest_catalog_changed(session)
        return {
            "processed": processed,
            "uploaded": uploaded,
            "skipped": skipped,
            "failed": failed,
            "run_uuid": str(run.run_uuid),
        }
    except Exception as exc:
        logger.exception("AMC logo ingestion failed")
        await finish_ingestion_run(
            session,
            run,
            status=IngestionRunStatus.failed,
            records_processed=processed,
            records_inserted=uploaded,
            records_skipped=skipped,
            error_message=str(exc),
        )
        raise
