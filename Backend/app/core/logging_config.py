"""Shared logging setup for API and background workers."""

from __future__ import annotations

import logging
import os


def configure_logging(*, level: str | None = None) -> None:
    resolved = (level or os.environ.get("LOG_LEVEL", "INFO")).upper()
    numeric = getattr(logging, resolved, logging.INFO)
    logging.basicConfig(
        level=numeric,
        format="%(levelname)s:%(name)s:%(message)s",
        force=True,
    )
    for logger_name in ("httpx", "httpcore", "hpack"):
        logging.getLogger(logger_name).setLevel(logging.WARNING)
