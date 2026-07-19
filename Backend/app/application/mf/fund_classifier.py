from __future__ import annotations

CAP_BUCKETS = frozenset({"large-cap", "mid-cap", "small-cap"})
THEME_TAGS = frozenset({"gold", "silver"})
CLASSIFICATION_VERSION = 1

_CAP_EXCLUSIONS = (
    "large & mid",
    "large and mid",
    "flexi cap",
    "flexi-cap",
    "multi cap",
    "multicap",
    "multi-cap",
)


def _normalized_text(*parts: str | None) -> str:
    return " ".join(part.strip().lower() for part in parts if part).strip()


def classify_cap_bucket(*, scheme_name: str, sebi_category: str | None) -> str | None:
    text = _normalized_text(scheme_name, sebi_category)
    if not text:
        return None
    if any(marker in text for marker in _CAP_EXCLUSIONS):
        return None
    if "small cap" in text or "smallcap" in text or "small-cap" in text:
        return "small-cap"
    if "mid cap" in text or "midcap" in text or "mid-cap" in text:
        return "mid-cap"
    if "large cap" in text or "largecap" in text or "large-cap" in text:
        return "large-cap"
    return None


def classify_theme_tags(*, scheme_name: str, sebi_category: str | None) -> list[str]:
    text = _normalized_text(scheme_name, sebi_category)
    if not text:
        return []
    tags: list[str] = []
    if "gold" in text or "precious metal" in text:
        tags.append("gold")
    if "silver" in text:
        tags.append("silver")
    return tags


def matches_gold_silver_collection(*, scheme_name: str, sebi_category: str | None, theme_tags: list[str]) -> bool:
    if "gold" in theme_tags or "silver" in theme_tags:
        return True
    text = _normalized_text(scheme_name, sebi_category)
    if not text:
        return False
    return any(
        marker in text
        for marker in (
            "gold fund",
            "gold etf",
            "silver etf",
            "precious metals",
            "precious metal",
        )
    )
