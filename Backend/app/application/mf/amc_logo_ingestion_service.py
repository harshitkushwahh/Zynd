from __future__ import annotations

import logging

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mf.ingestion_run_service import begin_ingestion_run, finish_ingestion_run, has_running_job
from app.application.mf.public_asset_service import amc_logo_storage_key, build_public_asset_url
from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import FundAmc, IngestionRunStatus
from app.infrastructure.storage.documents.factory import get_document_storage

logger = logging.getLogger(__name__)


async def _load_logo_manifest(client: httpx.AsyncClient, manifest_url: str) -> dict[str, str]:
    if not manifest_url.strip():
        return {}
    response = await client.get(manifest_url)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        return {}
    return {str(key): str(value) for key, value in payload.items() if value}


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

    if not settings.zynd_mf_amc_logo_url_template.strip() and not settings.zynd_mf_amc_logo_manifest_url.strip():
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
            manifest = await _load_logo_manifest(client, settings.zynd_mf_amc_logo_manifest_url)

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
                    response = await client.get(source_url)
                    response.raise_for_status()
                    content = response.content
                    if len(content) < 128:
                        skipped += 1
                        continue

                    content_type = response.headers.get("content-type", "image/png")
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
                    amc.logo_url = build_public_asset_url(storage_key, settings)
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
