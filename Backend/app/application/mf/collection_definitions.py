from __future__ import annotations

COLLECTION_SLUGS: tuple[str, ...] = (
    "high-return",
    "best-sip",
    "gold-silver",
    "large-cap",
    "mid-cap",
    "small-cap",
)

CAP_COLLECTION_BY_BUCKET: dict[str, str] = {
    "large-cap": "large-cap",
    "mid-cap": "mid-cap",
    "small-cap": "small-cap",
}
