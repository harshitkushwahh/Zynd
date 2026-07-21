from __future__ import annotations

import csv
import io
import re
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_audit
from app.application.risk_profile.errors import RiskProfileError
from app.application.risk_profile.question_service import _validate_options
from app.infrastructure.persistence.models import AuditEventType, User
from app.infrastructure.persistence.risk_profile_models import RiskQuestion, RiskQuestionCategory, RiskQuestionOption

CSV_COLUMNS = (
    "category_slug",
    "question_prompt",
    "option_1",
    "option_1_score",
    "option_2",
    "option_2_score",
    "option_3",
    "option_3_score",
    "option_4",
    "option_4_score",
    "help_text",
    "sort_order",
)

_SLUG_PATTERN = re.compile(r"^[a-z][a-z0-9_]{1,62}$")


def _parse_csv_rows(csv_text: str) -> list[dict[str, str]]:
    cleaned = csv_text.strip()
    if not cleaned:
        raise RiskProfileError("csv_empty", "CSV payload is empty.")

    reader = csv.DictReader(io.StringIO(cleaned))
    if not reader.fieldnames:
        raise RiskProfileError("csv_invalid", "CSV must include a header row.")

    normalized_headers = {header.strip().lower(): header for header in reader.fieldnames if header}
    missing = [column for column in CSV_COLUMNS if column not in normalized_headers]
    if missing:
        raise RiskProfileError(
            "csv_invalid_columns",
            f"Missing required CSV columns: {', '.join(missing)}.",
        )

    rows: list[dict[str, str]] = []
    for line_number, raw_row in enumerate(reader, start=2):
        if not any((value or "").strip() for value in raw_row.values()):
            continue
        row = {
            column: (raw_row.get(normalized_headers[column]) or "").strip()
            for column in CSV_COLUMNS
        }
        row["_line"] = str(line_number)
        rows.append(row)

    if not rows:
        raise RiskProfileError("csv_empty", "CSV contains no data rows.")
    return rows


def _row_to_question_payload(row: dict[str, str]) -> dict[str, Any]:
    line = row["_line"]
    category_slug = row["category_slug"].strip().lower()
    if not _SLUG_PATTERN.match(category_slug):
        raise RiskProfileError(
            "invalid_category_slug",
            f"Line {line}: invalid category_slug '{category_slug}'.",
        )

    prompt = row["question_prompt"].strip()
    if not prompt:
        raise RiskProfileError("invalid_question_prompt", f"Line {line}: question_prompt is required.")

    options: list[dict[str, Any]] = []
    for index in range(1, 5):
        label = row[f"option_{index}"].strip()
        score_raw = row[f"option_{index}_score"].strip()
        if not label and not score_raw:
            continue
        if not label or not score_raw:
            raise RiskProfileError(
                "invalid_option",
                f"Line {line}: option_{index} requires both label and score.",
            )
        try:
            score_value = int(score_raw)
        except ValueError as exc:
            raise RiskProfileError(
                "invalid_option_score",
                f"Line {line}: option_{index}_score must be an integer.",
            ) from exc
        options.append({"label": label, "score_value": score_value, "sort_order": index - 1})

    _validate_options(options)

    sort_order = 0
    if row["sort_order"]:
        try:
            sort_order = int(row["sort_order"])
        except ValueError as exc:
            raise RiskProfileError("invalid_sort_order", f"Line {line}: sort_order must be an integer.") from exc

    return {
        "line": line,
        "category_slug": category_slug,
        "prompt": prompt,
        "help_text": row["help_text"].strip() or None,
        "sort_order": sort_order,
        "options": options,
    }


async def _category_by_slug(db: AsyncSession) -> dict[str, RiskQuestionCategory]:
    result = await db.execute(select(RiskQuestionCategory))
    return {row.slug: row for row in result.scalars().all()}


async def preview_bulk_questions(db: AsyncSession, *, csv_text: str) -> dict[str, Any]:
    rows = _parse_csv_rows(csv_text)
    categories = await _category_by_slug(db)
    parsed_rows: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    for row in rows:
        try:
            payload = _row_to_question_payload(row)
            category_exists = payload["category_slug"] in categories
            if not category_exists:
                errors.append(
                    {
                        "line": payload["line"],
                        "code": "category_not_found",
                        "message": (
                            f"Line {payload['line']}: category '{payload['category_slug']}' does not exist. "
                            "Create it in Categories before importing."
                        ),
                    }
                )
                continue
            parsed_rows.append(
                {
                    **payload,
                    "category_exists": True,
                    "status": "ready",
                }
            )
        except RiskProfileError as exc:
            errors.append({"line": row["_line"], "code": exc.code, "message": exc.message})

    return {
        "row_count": len(rows),
        "valid_count": len(parsed_rows),
        "error_count": len(errors),
        "rows": parsed_rows,
        "errors": errors,
        "ready": len(errors) == 0 and len(parsed_rows) > 0,
    }


async def submit_bulk_questions(
    db: AsyncSession,
    *,
    csv_text: str,
    create_missing_categories: bool,
    default_category_weight: float,
    admin: User,
    ip: str | None,
) -> dict[str, Any]:
    preview = await preview_bulk_questions(db, csv_text=csv_text)
    if preview["errors"]:
        raise RiskProfileError(
            "bulk_preview_failed",
            "Fix CSV validation errors before submitting.",
        )

    categories = await _category_by_slug(db)
    created_categories = 0
    created_questions = 0
    created_question_ids: list[str] = []

    for row in preview["rows"]:
        category = categories.get(row["category_slug"])
        if not category:
            raise RiskProfileError(
                "category_not_found",
                f"Category '{row['category_slug']}' does not exist (line {row['line']}).",
            )

        question = RiskQuestion(
            category_id=category.id,
            prompt=row["prompt"],
            help_text=row["help_text"],
            sort_order=row["sort_order"],
            is_active=True,
        )
        db.add(question)
        await db.flush()

        for option in row["options"]:
            db.add(
                RiskQuestionOption(
                    question_id=question.id,
                    label=option["label"],
                    score_value=option["score_value"],
                    sort_order=option["sort_order"],
                )
            )
        await db.flush()
        created_questions += 1
        created_question_ids.append(str(question.id))

    await write_audit(
        db,
        event_type=AuditEventType.risk_question_bulk_imported,
        user_id=admin.id,
        ip=ip,
        metadata={
            "admin_id": str(admin.id),
            "row_count": preview["row_count"],
            "created_categories": created_categories,
            "created_questions": created_questions,
            "question_ids": created_question_ids,
        },
    )

    return {
        "row_count": preview["row_count"],
        "created_categories": created_categories,
        "created_questions": created_questions,
        "question_ids": created_question_ids,
    }
