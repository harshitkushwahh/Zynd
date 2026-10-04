"""Copy bundled AMC logos into the public asset directory the API serves.

The fund UI requests ``/invest/assets/public/amcs/{slug}.png``. Those files are
not the short names in ``assets/amc-logos/logos/``. Logo ingestion writes the
slug-named copies into local document storage, and that directory is not part
of the image. This publisher does the same copy at image build time from the
existing manifest, so every ``file:`` logo is present before the container starts.
"""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

LOCAL_FILE_PREFIX = "file:"
_BACKEND_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_MANIFEST = _BACKEND_ROOT / "assets" / "amc-logos" / "manifest.json"


def bundled_amc_logo_destination(manifest_path: Path | None = None) -> Path:
    backend_root = (manifest_path or _DEFAULT_MANIFEST).resolve().parents[2]
    repo_root = backend_root.parent
    raw_root = os.environ.get("DOCUMENTS_ROOT", "documents").strip() or "documents"
    documents_root = Path(raw_root)
    if not documents_root.is_absolute():
        documents_root = repo_root / documents_root
    bucket = os.environ.get("PUBLIC_ASSETS_BUCKET", "zynd-public-assets").strip() or "zynd-public-assets"
    return documents_root / bucket / "public" / "amcs"


def publish_bundled_amc_logos(
    *,
    manifest_path: Path | None = None,
    destination_dir: Path | None = None,
) -> list[Path]:
    manifest_path = (manifest_path or _DEFAULT_MANIFEST).resolve()
    destination_dir = destination_dir or bundled_amc_logo_destination(manifest_path)
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"AMC logo manifest must be an object: {manifest_path}")

    destination_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    missing: list[str] = []
    manifest_root = manifest_path.parent.resolve()

    for slug, source in payload.items():
        source_text = str(source).strip()
        if not source_text.startswith(LOCAL_FILE_PREFIX):
            continue
        relative = source_text.removeprefix(LOCAL_FILE_PREFIX).lstrip("/")
        source_path = (manifest_root / relative).resolve()
        if manifest_root not in source_path.parents and source_path != manifest_root:
            raise ValueError(f"Logo path escapes the manifest directory: {relative}")
        if not source_path.is_file():
            missing.append(f"{slug} -> {relative}")
            continue
        destination = destination_dir / f"{slug}{source_path.suffix.lower()}"
        shutil.copyfile(source_path, destination)
        written.append(destination)

    if missing:
        joined = ", ".join(missing)
        raise FileNotFoundError(f"Bundled AMC logos are missing from the image source: {joined}")
    if not written:
        raise FileNotFoundError(f"AMC logo manifest has no local files: {manifest_path}")
    return written


def main() -> None:
    written = publish_bundled_amc_logos()
    print(f"Published {len(written)} bundled AMC logos to {written[0].parent}")


if __name__ == "__main__":
    main()
