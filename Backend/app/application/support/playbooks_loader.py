from __future__ import annotations

from functools import lru_cache
from pathlib import Path

_PLAYBOOK_DIR = Path(__file__).resolve().parent / "playbooks"


@lru_cache(maxsize=1)
def _load_all() -> dict[str, str]:
    loaded: dict[str, str] = {}
    for path in _PLAYBOOK_DIR.glob("*.md"):
        loaded[path.stem] = path.read_text(encoding="utf-8").strip()
    return loaded


def playbooks_for(topics: tuple[str, ...] | list[str]) -> str:
    library = _load_all()
    parts = [library[topic] for topic in topics if topic in library]
    if not parts:
        parts = list(library.values())
    return "\n\n".join(parts)
