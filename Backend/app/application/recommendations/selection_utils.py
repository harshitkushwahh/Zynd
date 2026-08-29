from __future__ import annotations

import hashlib
import random


def stable_hash_int(seed: str) -> int:
    digest = hashlib.sha256(seed.encode()).digest()
    return int.from_bytes(digest[:8], "big")


def stable_index(seed: str, count: int) -> int:
    if count <= 0:
        raise ValueError("count must be positive")
    return stable_hash_int(seed) % count


def seeded_rng(seed: str) -> random.Random:
    return random.Random(stable_hash_int(seed))
