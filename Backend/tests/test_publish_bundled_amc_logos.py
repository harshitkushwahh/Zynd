import json
from pathlib import Path

import pytest

from app.application.mf.publish_bundled_amc_logos import (
    _DEFAULT_MANIFEST,
    publish_bundled_amc_logos,
)

_MANIFEST = _DEFAULT_MANIFEST


def test_committed_manifest_logo_files_exist():
    payload = json.loads(_MANIFEST.read_text(encoding="utf-8"))
    missing = []
    for slug, source in payload.items():
        source_text = str(source)
        if not source_text.startswith("file:"):
            continue
        relative = source_text.removeprefix("file:").lstrip("/")
        if not (_MANIFEST.parent / relative).is_file():
            missing.append(f"{slug} -> {relative}")
    assert missing == []


def test_publish_writes_every_manifest_logo_under_its_slug(tmp_path: Path):
    written = publish_bundled_amc_logos(destination_dir=tmp_path)
    payload = json.loads(_MANIFEST.read_text(encoding="utf-8"))
    expected = {
        f"{slug}{(_MANIFEST.parent / str(source).removeprefix('file:').lstrip('/')).suffix.lower()}"
        for slug, source in payload.items()
        if str(source).startswith("file:")
    }
    assert {path.name for path in written} == expected
    icici = tmp_path / "icici-mutual-fund.png"
    source = _MANIFEST.parent / "logos" / "icici_prudential.png"
    assert icici.read_bytes() == source.read_bytes()


def test_publish_fails_when_a_manifest_logo_is_missing(tmp_path: Path):
    manifest = tmp_path / "manifest.json"
    logos = tmp_path / "logos"
    logos.mkdir()
    (logos / "present.png").write_bytes(b"png")
    manifest.write_text(
        json.dumps(
            {
                "present-mutual-fund": "file:logos/present.png",
                "missing-mutual-fund": "file:logos/missing.png",
            }
        ),
        encoding="utf-8",
    )
    with pytest.raises(FileNotFoundError, match="missing-mutual-fund"):
        publish_bundled_amc_logos(manifest_path=manifest, destination_dir=tmp_path / "out")
