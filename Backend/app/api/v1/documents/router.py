from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.api.v1.auth.deps import get_client_ip, get_current_user
from app.application.auth.account_service import kyc_eligibility_status
from app.application.documents.document_worm_policy import is_kyc_doc_type
from app.application.documents.document_download_service import (
    issue_document_download,
    read_document_content_for_token,
    read_public_document_content,
)
from app.application.documents.document_service import (
    get_latest_document,
    get_user_document,
    list_user_documents,
    upload_user_document,
)
from app.application.documents.errors import DocumentError
from app.core.database import get_db
from app.infrastructure.persistence.models import DocumentType, User
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/documents", tags=["documents"])


class DocumentResponse(BaseModel):
    id: UUID
    client_id: str
    doc_type: str
    version: int
    original_filename: str
    mime_type: str
    size_bytes: int
    sha256: str
    status: str
    immutable_at: datetime | None = None
    legal_hold: bool = False
    created_at: datetime


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]


class DocumentDownloadResponse(BaseModel):
    download_url: str
    expires_in: int = Field(ge=0)
    mime_type: str
    filename: str
    delivery: Literal["cdn", "signed"] = "signed"
    cache_max_age: Optional[int] = Field(default=None, ge=0)


def _handle_document_error(exc: DocumentError) -> HTTPException:
    return HTTPException(
        status_code=exc.status_code,
        detail={"code": exc.code, "message": exc.message},
    )


def _ensure_kyc_upload_allowed(user: User, doc_type: DocumentType) -> None:
    if not is_kyc_doc_type(doc_type):
        return

    eligibility = kyc_eligibility_status(user)
    if eligibility["eligible"]:
        return

    raise HTTPException(
        status_code=403,
        detail={
            "code": (
                "mfa_required"
                if "mfa_required" in eligibility["reasons"]
                else "not_eligible"
            ),
            "message": (
                "Enable MFA before uploading KYC documents."
                if "mfa_required" in eligibility["reasons"]
                else "KYC uploads are not available for this account."
            ),
            "reasons": eligibility["reasons"],
        },
    )


@router.post("/upload", response_model=DocumentResponse)
async def post_document_upload(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    doc_type: Annotated[str, Form()],
    file: Annotated[UploadFile, File()],
) -> DocumentResponse:
    try:
        parsed_type = DocumentType(doc_type)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_doc_type", "message": "Unsupported document type."},
        ) from exc

    content = await file.read()
    mime_type = file.content_type or "application/octet-stream"

    _ensure_kyc_upload_allowed(current_user, parsed_type)

    try:
        document = await upload_user_document(
            db,
            user=current_user,
            doc_type=parsed_type,
            filename=file.filename or f"{parsed_type.value}",
            mime_type=mime_type,
            content=content,
            ip=get_client_ip(request),
        )
    except DocumentError as exc:
        raise _handle_document_error(exc) from exc

    await db.commit()
    return DocumentResponse(**document)


@router.get("", response_model=DocumentListResponse)
async def get_documents(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> DocumentListResponse:
    documents = await list_user_documents(db, user=current_user)
    return DocumentListResponse(documents=[DocumentResponse(**item) for item in documents])


@router.get("/content/{token}")
async def get_document_content(
    token: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    try:
        content, mime_type, filename = await read_document_content_for_token(db, token=token)
    except DocumentError as exc:
        raise _handle_document_error(exc) from exc

    safe_filename = filename.replace('"', "")
    return Response(
        content=content,
        media_type=mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{safe_filename}"',
            "Cache-Control": "private, no-store",
        },
    )


@router.get("/public/{document_id}")
async def get_public_document_content(
    document_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    try:
        content, mime_type, filename, cache_max_age = await read_public_document_content(
            db,
            document_id=document_id,
        )
    except DocumentError as exc:
        raise _handle_document_error(exc) from exc

    safe_filename = filename.replace('"', "")
    return Response(
        content=content,
        media_type=mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{safe_filename}"',
            "Cache-Control": f"public, max-age={cache_max_age}, immutable",
        },
    )


@router.get("/{doc_type}/latest", response_model=DocumentResponse | None)
async def get_document_latest(
    doc_type: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> DocumentResponse | None:
    try:
        parsed_type = DocumentType(doc_type)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_doc_type", "message": "Unsupported document type."},
        ) from exc

    document = await get_latest_document(db, user=current_user, doc_type=parsed_type)
    if not document:
        return None
    return DocumentResponse(**document)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> DocumentResponse:
    document = await get_user_document(db, user=current_user, document_id=document_id)
    if not document:
        raise HTTPException(
            status_code=404,
            detail={"code": "document_not_found", "message": "Document not found."},
        )
    return DocumentResponse(**document)


@router.get("/{document_id}/download", response_model=DocumentDownloadResponse)
async def get_document_download(
    document_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> DocumentDownloadResponse:
    try:
        payload = await issue_document_download(
            db,
            user=current_user,
            document_id=document_id,
            ip=get_client_ip(request),
        )
    except DocumentError as exc:
        raise _handle_document_error(exc) from exc

    await db.commit()
    return DocumentDownloadResponse(**payload)
